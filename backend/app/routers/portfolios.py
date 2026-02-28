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
        "comments": [
            {
                "id": c.id,
                "author_id": c.author_id,
                "author_name": c.author.name if c.author else "",
                "content": c.content,
                "created_at": c.created_at,
            }
            for c in p.comments
        ],
        "created_at": p.created_at,
    }


@router.get("/", response_model=List[PortfolioResponse])
def list_portfolios(
    student_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Portfolio).options(
        joinedload(Portfolio.student),
        joinedload(Portfolio.comments).joinedload(PortfolioComment.author)
    )
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
def get_portfolio(portfolio_id: str, db: Session = Depends(get_db)):
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
def create_portfolio(
    data: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    portfolio = Portfolio(
        id=f"ptf{uuid.uuid4().hex[:7]}",
        student_id=current_user.id,
        title=data.title,
        description=data.description,
        video_url=data.video_url,
        category=data.category,
        tags=data.tags,
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
    return portfolio_to_response(p)


@router.put("/{portfolio_id}", response_model=PortfolioResponse)
def update_portfolio(
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
    return portfolio_to_response(p)


@router.post("/{portfolio_id}/ai-feedback")
def request_ai_feedback(
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
    return {"ai_feedback": feedback}


@router.post("/{portfolio_id}/comments", response_model=PortfolioCommentResponse, status_code=status.HTTP_201_CREATED)
def add_comment(
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
        content=data.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    c = db.query(PortfolioComment).options(joinedload(PortfolioComment.author)).filter(PortfolioComment.id == comment.id).first()
    return {
        "id": c.id,
        "author_id": c.author_id,
        "author_name": c.author.name if c.author else "",
        "content": c.content,
        "created_at": c.created_at,
    }


@router.delete("/{portfolio_id}/comments/{comment_id}")
def delete_comment(
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

    db.delete(c)
    db.commit()
    return {"message": "Comment deleted"}


@router.delete("/{portfolio_id}")
def delete_portfolio(
    portfolio_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    if current_user.id != p.student_id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    db.delete(p)
    db.commit()
    return {"message": "Portfolio deleted"}
