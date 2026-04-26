from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.portfolio import Portfolio, PortfolioComment, PortfolioVideo, PortfolioAttachment, PracticeJournal, PortfolioCategory
from app.models.user import User, UserRole
from app.schemas.portfolio import (
    PortfolioCreate, PortfolioUpdate, PortfolioResponse,
    PortfolioCommentCreate, PortfolioCommentResponse,
    PracticeJournalCreate, PracticeJournalUpdate, PracticeJournalResponse
)
from app.utils.auth import get_current_user
from app.services.ai import analyze_portfolio
from app.services.notification_service import notify_user, notify_users, emit_data_changed, get_teacher_ids_for_student, get_teacher_student_ids
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def portfolio_to_response(p: Portfolio) -> dict:
    return {
        "id": p.id,
        "student_id": p.student_id,
        "student_name": p.student.name if p.student else "",
        "title": p.title,
        "description": p.description,
        "video_url": p.video_url,
        "category": p.category,
        "tags": p.tags,
        "ai_feedback": p.ai_feedback,
        "practice_group": p.practice_group,
        "video_duration": p.video_duration,
        "comments": [
            {
                "id": c.id,
                "author_id": c.author_id,
                "author_name": c.author.name if c.author else "",
                "content": c.content,
                "timestamp_sec": c.timestamp_sec,
                "created_at": c.created_at,
            }
            for c in p.comments
        ],
        "videos": [
            {
                "id": v.id,
                "portfolio_id": v.portfolio_id,
                "video_url": v.video_url,
                "thumbnail_url": v.thumbnail_url,
                "sort_order": v.sort_order,
                "created_at": v.created_at,
            }
            for v in (p.videos if p.videos else [])
        ],
        "attachments": [
            {
                "id": a.id,
                "file_url": a.file_url,
                "file_name": a.file_name,
                "file_size": a.file_size,
                "created_at": a.created_at,
            }
            for a in (p.attachments if p.attachments else [])
        ],
        "created_at": p.created_at,
    }


def _journal_to_response(j: PracticeJournal) -> dict:
    return {
        "id": j.id,
        "student_id": j.student_id,
        "student_name": j.student.name if j.student else "",
        "title": j.title,
        "content": j.content,
        "attachment_url": j.attachment_url,
        "created_at": j.created_at,
        "updated_at": j.updated_at,
    }


@router.get("/journals")
def list_practice_journals(
    student_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List practice journals (independent of portfolios)."""
    query = db.query(PracticeJournal).options(
        joinedload(PracticeJournal.student)
    )
    if current_user.role == UserRole.TEACHER:
        my_student_ids = get_teacher_student_ids(db, current_user.id)
        query = query.filter(PracticeJournal.student_id.in_(my_student_ids))
    elif current_user.role == UserRole.STUDENT:
        query = query.filter(PracticeJournal.student_id == current_user.id)

    if student_id:
        query = query.filter(PracticeJournal.student_id == student_id)

    journals = query.order_by(PracticeJournal.created_at.desc()).limit(100).all()
    return [_journal_to_response(j) for j in journals]


@router.post("/journals", response_model=PracticeJournalResponse, status_code=status.HTTP_201_CREATED)
async def create_practice_journal(
    data: PracticeJournalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a practice journal entry (student only)."""
    journal = PracticeJournal(
        id=f"pj{uuid.uuid4().hex[:8]}",
        student_id=current_user.id,
        title=data.title,
        content=data.content,
        attachment_url=data.attachment_url,
    )
    db.add(journal)
    db.commit()
    db.refresh(journal)

    # 학생이 작성 → 선생님에게 알림
    teacher_ids = get_teacher_ids_for_student(db, current_user.id)
    if teacher_ids:
        await notify_users(
            db, teacher_ids,
            f"{current_user.name}님이 연습일지를 작성했습니다: {data.title}",
            entity="practice_journals",
        )

    j = db.query(PracticeJournal).options(joinedload(PracticeJournal.student)).filter(PracticeJournal.id == journal.id).first()
    return _journal_to_response(j)


@router.put("/journals/{journal_id}", response_model=PracticeJournalResponse)
async def update_practice_journal(
    journal_id: str,
    data: PracticeJournalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    journal = db.query(PracticeJournal).options(joinedload(PracticeJournal.student)).filter(PracticeJournal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Practice journal not found")
    if journal.student_id != current_user.id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(journal, field, value)
    db.commit()
    db.refresh(journal)
    return _journal_to_response(journal)


@router.delete("/journals/{journal_id}")
async def delete_practice_journal(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    journal = db.query(PracticeJournal).filter(PracticeJournal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Practice journal not found")
    if journal.student_id != current_user.id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    db.delete(journal)
    db.commit()
    return {"message": "Practice journal deleted"}


@router.get("/practice-groups")
def list_practice_groups(
    student_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get portfolios grouped by practice_group for timeline view."""
    query = db.query(Portfolio).options(
        joinedload(Portfolio.student),
        joinedload(Portfolio.comments).joinedload(PortfolioComment.author),
        joinedload(Portfolio.videos),
        joinedload(Portfolio.attachments),
    ).filter(Portfolio.practice_group.isnot(None))
    # Teacher: only see portfolios for students in their classes
    if current_user.role == UserRole.TEACHER:
        my_student_ids = get_teacher_student_ids(db, current_user.id)
        query = query.filter(Portfolio.student_id.in_(my_student_ids))
    # Student: only see own portfolios
    elif current_user.role == UserRole.STUDENT:
        query = query.filter(Portfolio.student_id == current_user.id)
    if student_id:
        query = query.filter(Portfolio.student_id == student_id)
    portfolios = query.order_by(Portfolio.created_at.asc()).all()

    groups = {}
    for p in portfolios:
        key = p.practice_group
        if key not in groups:
            groups[key] = {"group_name": key, "items": []}
        groups[key]["items"].append(portfolio_to_response(p))
    return list(groups.values())


@router.get("/", response_model=List[PortfolioResponse])
def list_portfolios(
    student_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Portfolio).options(
        joinedload(Portfolio.student),
        joinedload(Portfolio.comments).joinedload(PortfolioComment.author),
        joinedload(Portfolio.videos),
        joinedload(Portfolio.attachments),
    )
    # Teacher: only see portfolios for students in their classes
    if current_user.role == UserRole.TEACHER:
        my_student_ids = get_teacher_student_ids(db, current_user.id)
        query = query.filter(Portfolio.student_id.in_(my_student_ids))
    # Student: only see own portfolios
    elif current_user.role == UserRole.STUDENT:
        query = query.filter(Portfolio.student_id == current_user.id)
    if student_id:
        query = query.filter(Portfolio.student_id == student_id)
    if category:
        try:
            cat = PortfolioCategory(category)
            query = query.filter(Portfolio.category == cat)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    portfolios = query.order_by(Portfolio.created_at.desc()).offset(skip).limit(limit).all()
    return [portfolio_to_response(p) for p in portfolios]


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
def get_portfolio(portfolio_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = (
        db.query(Portfolio)
        .options(
            joinedload(Portfolio.student),
            joinedload(Portfolio.comments).joinedload(PortfolioComment.author),
        )
        .filter(Portfolio.id == portfolio_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    # Student: can only view own portfolios
    if current_user.role == UserRole.STUDENT and p.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    # Teacher: can only view portfolios for students in their classes
    if current_user.role == UserRole.TEACHER:
        my_student_ids = get_teacher_student_ids(db, current_user.id)
        if p.student_id not in my_student_ids:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    return portfolio_to_response(p)


@router.post("/", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    data: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Log upload metadata
    mode_info = ""
    if data.upload_mode:
        mode_info = f" [mode={data.upload_mode}, videos={data.total_videos or '?'}, idx={data.video_index or '?'}]"
    logger.warning(f"Portfolio create by {current_user.name}({current_user.id}): '{data.title}'{mode_info}")

    portfolio = Portfolio(
        id=f"ptf{uuid.uuid4().hex[:7]}",
        student_id=current_user.id,
        title=data.title,
        description=data.description,
        video_url=data.video_url or '',
        category=data.category,
        tags=data.tags,
        practice_group=data.practice_group,
        video_duration=data.video_duration,
    )
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    p = (
        db.query(Portfolio)
        .options(
            joinedload(Portfolio.student),
            joinedload(Portfolio.comments).joinedload(PortfolioComment.author),
        )
        .filter(Portfolio.id == portfolio.id)
        .first()
    )

    teacher_ids = get_teacher_ids_for_student(db, current_user.id)
    if teacher_ids:
        await notify_users(
            db, teacher_ids,
            f"{current_user.name}님이 새 포트폴리오를 등록했습니다: {data.title}",
            entity="portfolios",
        )

    return portfolio_to_response(p)


@router.put("/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(
    portfolio_id: str,
    update_data: PortfolioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    p = (
        db.query(Portfolio)
        .options(
            joinedload(Portfolio.student),
            joinedload(Portfolio.comments).joinedload(PortfolioComment.author),
        )
        .filter(Portfolio.id == portfolio_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    if current_user.id != p.student_id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(p, field, value)

    db.commit()
    db.refresh(p)

    if current_user.id == p.student_id:
        teacher_ids = get_teacher_ids_for_student(db, p.student_id)
        if teacher_ids:
            await emit_data_changed(teacher_ids, "portfolios")
    else:
        await emit_data_changed([p.student_id], "portfolios")

    return portfolio_to_response(p)


@router.post("/{portfolio_id}/ai-feedback")
async def request_ai_feedback(
    portfolio_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Students can only request AI feedback on their own portfolios
    if current_user.role == UserRole.STUDENT and p.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    feedback = analyze_portfolio(p.title, p.description, p.category.value)
    p.ai_feedback = feedback
    db.commit()

    if p.student_id != current_user.id:
        await notify_user(
            db, p.student_id,
            "포트폴리오에 AI 피드백이 생성되었습니다.",
            entity="portfolios",
        )

    return {"ai_feedback": feedback}


@router.post("/{portfolio_id}/comments", response_model=PortfolioCommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(
    portfolio_id: str,
    data: PortfolioCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    comment = PortfolioComment(
        id=f"pcmt{uuid.uuid4().hex[:7]}",
        portfolio_id=portfolio_id,
        author_id=current_user.id,
        timestamp_sec=data.timestamp_sec,
        content=data.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    if p.student_id != current_user.id:
        await notify_user(
            db, p.student_id,
            f"{current_user.name}님이 포트폴리오 '{p.title}'에 댓글을 남겼습니다.",
            entity="portfolios",
        )

    c = db.query(PortfolioComment).options(joinedload(PortfolioComment.author)).filter(PortfolioComment.id == comment.id).first()
    return {
        "id": c.id,
        "author_id": c.author_id,
        "author_name": c.author.name if c.author else "",
        "content": c.content,
        "timestamp_sec": c.timestamp_sec,
        "created_at": c.created_at,
    }


@router.delete("/{portfolio_id}/comments/{comment_id}")
async def delete_comment(
    portfolio_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(PortfolioComment).filter(
        PortfolioComment.id == comment_id,
        PortfolioComment.portfolio_id == portfolio_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")

    if current_user.id != c.author_id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    db.delete(c)
    db.commit()

    if p:
        await emit_data_changed([p.student_id], "portfolios")

    return {"message": "Comment deleted"}


@router.delete("/{portfolio_id}")
async def delete_portfolio(
    portfolio_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    if current_user.id != p.student_id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    student_id = p.student_id
    db.delete(p)
    db.commit()

    await emit_data_changed([student_id], "portfolios")

    return {"message": "Portfolio deleted"}


# ── Portfolio Videos (multi-video support) ──

from app.schemas.portfolio import PortfolioVideoResponse
from app.services.file_upload import extract_thumbnail, UPLOAD_DIR


@router.post("/{portfolio_id}/videos", status_code=status.HTTP_201_CREATED)
async def add_portfolio_video(
    portfolio_id: str,
    video_url: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a video to an existing portfolio."""
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    if p.student_id != current_user.id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Determine sort order
    max_order = db.query(PortfolioVideo).filter(
        PortfolioVideo.portfolio_id == portfolio_id
    ).count()

    # Extract thumbnail
    thumbnail_url = None
    if video_url.startswith("/uploads/"):
        file_path = str(UPLOAD_DIR / video_url.removeprefix("/uploads/"))
        thumbnail_url = extract_thumbnail(file_path)

    video = PortfolioVideo(
        id=f"pv{uuid.uuid4().hex[:8]}",
        portfolio_id=portfolio_id,
        video_url=video_url,
        thumbnail_url=thumbnail_url,
        sort_order=max_order,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    return {
        "id": video.id,
        "portfolio_id": video.portfolio_id,
        "video_url": video.video_url,
        "thumbnail_url": video.thumbnail_url,
        "sort_order": video.sort_order,
        "created_at": video.created_at,
    }


@router.delete("/{portfolio_id}/videos/{video_id}")
async def delete_portfolio_video(
    portfolio_id: str,
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    if p.student_id != current_user.id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    video = db.query(PortfolioVideo).filter(
        PortfolioVideo.id == video_id,
        PortfolioVideo.portfolio_id == portfolio_id
    ).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    db.delete(video)
    db.commit()

    await emit_data_changed([p.student_id], "portfolios")
    return {"message": "Video deleted"}


# ── Portfolio Attachments ──

@router.post("/{portfolio_id}/attachments", status_code=status.HTTP_201_CREATED)
async def add_portfolio_attachment(
    portfolio_id: str,
    file_url: str = Query(...),
    file_name: str = Query(...),
    file_size: int = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a file attachment to an existing portfolio."""
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    if p.student_id != current_user.id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    attachment = PortfolioAttachment(
        id=f"pa{uuid.uuid4().hex[:8]}",
        portfolio_id=portfolio_id,
        file_url=file_url,
        file_name=file_name,
        file_size=file_size,
    )
    db.add(attachment)
    db.commit()

    logger.warning(f"Attachment added to {portfolio_id} by {current_user.name}({current_user.id}): {file_name}")
    return {
        "id": attachment.id,
        "file_url": attachment.file_url,
        "file_name": attachment.file_name,
        "file_size": attachment.file_size,
        "created_at": attachment.created_at,
    }


@router.delete("/{portfolio_id}/attachments/{attachment_id}")
async def delete_portfolio_attachment(
    portfolio_id: str,
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a file attachment from a portfolio."""
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    if p.student_id != current_user.id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    att = db.query(PortfolioAttachment).filter(
        PortfolioAttachment.id == attachment_id,
        PortfolioAttachment.portfolio_id == portfolio_id
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    db.delete(att)
    db.commit()

    await emit_data_changed([p.student_id], "portfolios")
    return {"message": "Attachment deleted"}
