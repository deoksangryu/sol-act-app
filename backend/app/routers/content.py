"""배움 탭 콘텐츠 — 상식퀴즈(하루1문제)·읽을거리·시청각·면접질문. 빈 테이블은 lazy-seed."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from datetime import datetime, date
import uuid
import random

from app.database import get_db
from app.models.user import User
from app.models.content import QuizQuestion, QuizAnswer, ReadingContent, MediaResource, InterviewQuestion
from app.models.gamification import PointLedger
from app.utils.auth import get_current_user
from app.services import gamify
from app.utils.timezone import today_kst, kst_day_start_utc

router = APIRouter()

QUIZ_REWARD = 5
WATCH_REWARD = 5

_SEED_QUIZ = [
    {"category": "연극사", "question": "『갈매기』를 쓴 러시아 극작가는?", "options": ["톨스토이", "체호프", "고리키", "스타니슬랍스키"], "answer_index": 1, "explanation": "안톤 체호프의 4대 장막극 중 하나예요."},
    {"category": "연기술", "question": "'주어진 상황(given circumstances)' 개념을 정립한 사람은?", "options": ["브레히트", "스타니슬랍스키", "메이어홀드", "그로토프스키"], "answer_index": 1, "explanation": "스타니슬랍스키 시스템의 핵심 개념이에요."},
    {"category": "희곡", "question": "『햄릿』에서 '사느냐 죽느냐'의 독백이 등장하는 막은?", "options": ["1막", "2막", "3막", "5막"], "answer_index": 2, "explanation": "3막 1장의 유명한 독백이에요."},
    {"category": "뮤지컬", "question": "뮤지컬에서 극의 감정을 노래로 폭발시키는 넘버를 부르는 말은?", "options": ["리프라이즈", "쇼스토퍼", "언더스코어", "아이 원트 송"], "answer_index": 3, "explanation": "주인공의 욕망을 드러내는 'I want' 송이에요."},
]
_SEED_READING = [
    {"title": "『갈매기』 딥리딩 3화", "sub": "니나는 왜 무대로 돌아왔나 · 5분", "minutes": 5},
    {"title": "서브텍스트란 무엇인가", "sub": "대사분석 워크북 · 카드 12장", "minutes": 8},
]
_SEED_MEDIA = [
    {"title": "니나 독백 레퍼런스 공연", "sub": "김쏠 선생님 추천", "duration": "4분 12초"},
    {"title": "복식호흡 발성 시범", "sub": "기초 발성", "duration": "3분 05초"},
]
_SEED_INTERVIEW = [
    {"question": "연기를 하면서 가장 크게 실패했던 경험은 무엇인가요?", "category": "자기성찰"},
    {"question": "당신에게 좋은 배우란 어떤 배우인가요?", "category": "가치관"},
    {"question": "10년 뒤 당신은 어떤 배우가 되어 있을까요?", "category": "비전"},
]


def _seed_if_empty(db: Session):
    # 고정 시드 PK — 동시 최초요청이 겹쳐도 PK 충돌로 중복 INSERT가 무해히 막힌다.
    if db.query(QuizQuestion).count() == 0:
        for i, q in enumerate(_SEED_QUIZ):
            db.add(QuizQuestion(id=f"qz_seed_{i}", sort=i, active=True, **q))
    if db.query(ReadingContent).count() == 0:
        for i, r in enumerate(_SEED_READING):
            db.add(ReadingContent(id=f"rd_seed_{i}", sort=i, **r))
    if db.query(MediaResource).count() == 0:
        for i, m in enumerate(_SEED_MEDIA):
            db.add(MediaResource(id=f"md_seed_{i}", sort=i, url=None, **m))
    if db.query(InterviewQuestion).count() == 0:
        for i, q in enumerate(_SEED_INTERVIEW):
            db.add(InterviewQuestion(id=f"iv_seed_{i}", sort=i, **q))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # 다른 요청이 먼저 시드함 — 정상


@router.get("/quiz/today")
def quiz_today(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _seed_if_empty(db)
    qs = db.query(QuizQuestion).filter(QuizQuestion.active == True).order_by(QuizQuestion.sort.asc(), QuizQuestion.id.asc()).all()  # noqa: E712
    if not qs:
        return {"question": None}
    q = qs[today_kst().toordinal() % len(qs)]  # 한국 날짜 기준 일일 순환
    today0 = kst_day_start_utc()
    prev = db.query(QuizAnswer).filter(
        QuizAnswer.student_id == current_user.id, QuizAnswer.question_id == q.id, QuizAnswer.created_at >= today0,
    ).order_by(QuizAnswer.created_at.desc()).first()
    out = {"question": {"id": q.id, "category": q.category, "question": q.question, "options": q.options}, "answered": prev is not None}
    if prev is not None:
        out["chosen_index"] = prev.chosen_index
        out["correct"] = prev.correct
        out["answer_index"] = q.answer_index
        out["explanation"] = q.explanation
    return out


class QuizAnswerBody(BaseModel):
    question_id: str
    chosen_index: int


@router.post("/quiz/answer")
def answer_quiz(body: QuizAnswerBody, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sid = current_user.id
    db.query(User).filter(User.id == sid).with_for_update().first()  # 동시요청 이중지급 방지(행잠금)
    q = db.query(QuizQuestion).filter(QuizQuestion.id == body.question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없어요")
    correct = int(body.chosen_index) == q.answer_index
    today0 = kst_day_start_utc()  # 한국 자정 기준
    # 오늘 이미 '정답'을 맞춘 적 있는지로 판정 — 오답→정답 재시도도 최초 정답에 1회 지급.
    already_correct = db.query(QuizAnswer).filter(
        QuizAnswer.student_id == sid, QuizAnswer.question_id == q.id,
        QuizAnswer.correct == True, QuizAnswer.created_at >= today0,  # noqa: E712
    ).first()
    db.add(QuizAnswer(id=f"qa{uuid.uuid4().hex[:10]}", student_id=sid, question_id=q.id, chosen_index=int(body.chosen_index), correct=correct))
    granted = 0
    if correct and already_correct is None:
        granted, _ = gamify.record_action(db, sid, "quiz", QUIZ_REWARD, ref=q.id)
    db.commit()
    return {"correct": correct, "answer_index": q.answer_index, "explanation": q.explanation, "granted": granted}


@router.get("/reading")
def reading(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _seed_if_empty(db)
    rows = db.query(ReadingContent).order_by(ReadingContent.sort.asc()).all()
    return [{"id": r.id, "title": r.title, "sub": r.sub, "minutes": r.minutes} for r in rows]


@router.get("/media")
def media(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _seed_if_empty(db)
    rows = db.query(MediaResource).order_by(MediaResource.sort.asc()).all()
    return [{"id": r.id, "title": r.title, "sub": r.sub, "url": r.url, "duration": r.duration} for r in rows]


@router.post("/media/{media_id}/watch")
def watch_media(media_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """시청 완료 → +5👏 (하루 상한은 서버가 강제)."""
    today0 = kst_day_start_utc()  # 한국 자정 기준
    db.query(User).filter(User.id == current_user.id).with_for_update().first()  # 행 잠금: 동시 탭 중복 지급 방지
    # 같은 영상은 오늘 이미 시청 보상을 받았으면 재지급 금지(중복 방지)
    dup = db.query(PointLedger).filter(
        PointLedger.student_id == current_user.id, PointLedger.reason == "watch",
        PointLedger.ref == media_id, PointLedger.created_at >= today0,
    ).first()
    if dup is not None:
        return {"granted": 0}
    granted, _ = gamify.record_action(db, current_user.id, "watch", WATCH_REWARD, ref=media_id)
    db.commit()
    return {"granted": granted}


@router.get("/interview/random")
def interview_random(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _seed_if_empty(db)
    rows = db.query(InterviewQuestion).all()
    if not rows:
        return {"question": None}
    q = random.choice(rows)
    return {"question": {"id": q.id, "question": q.question, "category": q.category}}
