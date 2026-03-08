from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.portfolio import Portfolio, PortfolioComment, PortfolioCategory
from app.models.user import User, UserRole
from app.schemas.portfolio import (
    PortfolioCreate, PortfolioUpdate, PortfolioResponse,
    PortfolioCommentCreate, PortfolioCommentResponse
)
from app.utils.auth import get_current_user
from app.services.ai import analyze_portfolio
from app.services.notification_service import notify_user, notify_users, emit_data_changed, get_teacher_ids_for_student, get_teacher_student_ids
import uuid

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
        "created_at": p.created_at,
    }


@router.get("/practice-groups")
def list_practice_groups(
    student_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get portfolios grouped by practice_group for timeline view."""
    query = db.query(Portfolio).options(
        joinedload(Portfolio.student),
        joinedload(Portfolio.comments).joinedload(PortfolioComment.author)
    ).filter(Portfolio.practice_group.isnot(None))
    # Teacher: only see portfolios for students in their classes
    if current_user.role == UserRole.TEACHER:
        my_student_ids = get_teacher_student_ids(db, current_user.id)
        query = query.filter(Portfolio.student_id.in_(my_student_ids))
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Portfolio).options(
        joinedload(Portfolio.student),
        joinedload(Portfolio.comments).joinedload(PortfolioComment.author)
    )
    # Teacher: only see portfolios for students in their classes
    if current_user.role == UserRole.TEACHER:
        my_student_ids = get_teacher_student_ids(db, current_user.id)
        query = query.filter(Portfolio.student_id.in_(my_student_ids))
    if student_id:
        query = query.filter(Portfolio.student_id == student_id)
    if category:
        try:
            cat = PortfolioCategory(category)
            query = query.filter(Portfolio.category == cat)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    portfolios = query.order_by(Portfolio.created_at.desc()).all()
    return [portfolio_to_response(p) for p in portfolios]


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
def get_portfolio(portfolio_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = (
        db.query(Portfolio)
        .options(
            joinedload(Portfolio.student),
            joinedload(Portfolio.comments).joinedload(PortfolioComment.author)
        )
        .filter(Portfolio.id == portfolio_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio_to_response(p)


@router.post("/", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    data: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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
            joinedload(Portfolio.comments).joinedload(PortfolioComment.author)
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
            joinedload(Portfolio.comments).joinedload(PortfolioComment.author)
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
