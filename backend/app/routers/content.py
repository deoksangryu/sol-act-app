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
_READING_BODIES = {
    "rd_seed_0": (
        "니나는 왜, 모든 것을 잃고도 다시 무대로 돌아왔을까.\n\n"
        "『갈매기』의 마지막 막에서 니나는 트레플레프에게 이렇게 말한다. \"난 갈매기예요… 아니, 그게 아니야. 난 배우예요.\" "
        "1막의 니나는 트리고린의 소설 속 문장처럼, 호숫가에 우연히 나타나 아무 이유 없이 파괴되는 '갈매기'였다. "
        "사랑에 실패하고, 아이를 잃고, 배우로서도 초라하게 지방을 떠돈 그녀는 스스로를 그 갈매기와 동일시하려 한다.\n\n"
        "그러나 대사는 중간에 멈춘다. \"아니, 그게 아니야.\" 이 짧은 자기 정정이 니나라는 인물의 핵심이다. "
        "그녀는 자신을 피해자(갈매기)로 규정하려다가, 그것을 스스로 거부하고 '배우'라는 능동적 정체성으로 옮겨간다. "
        "중요한 건 재능이나 성공이 아니라 '견디는 힘'이라는 것을 그녀는 배웠다. \"난 이제 견딜 줄 알아요. 믿음을 가지면 아프지 않아요.\"\n\n"
        "연기적으로 이 장면의 함정은 니나를 '불쌍하게' 연기하는 것이다. 니나는 동정을 구하지 않는다. "
        "무너진 사람이 아니라, 무너짐을 통과해 자기 일을 찾은 사람으로 접근할 때 이 대사는 살아난다.\n\n"
        "질문: 당신이 연기하는 인물도 '스스로를 무엇이라 규정하려다 멈추는' 순간이 있는가? 그 정정(訂正)의 순간이 곧 캐릭터의 변화점이다."
    ),
    "rd_seed_1": (
        "서브텍스트(subtext)란, 대사의 표면 아래 흐르는 '진짜 하고 싶은 말'이다.\n\n"
        "인물은 좀처럼 자기 속마음을 문자 그대로 말하지 않는다. \"괜찮아\"라는 대사가 실제로는 "
        "\"제발 나를 붙잡아줘\"일 수 있고, \"늦었네요\"가 \"당신을 기다리는 게 지겨워요\"일 수 있다. "
        "관객이 배우에게 빠져드는 순간은 대개 이 표면과 이면의 간극에서 발생한다.\n\n"
        "서브텍스트를 찾는 세 가지 질문:\n"
        "1) 이 인물은 이 대사로 상대에게서 '무엇을 얻어내려' 하는가? (목적/행동동사)\n"
        "2) 왜 그것을 '직접' 말하지 않는가? (장애물/관계)\n"
        "3) 말하지 못한 진짜 문장은 무엇인가? (한 줄로 써보기)\n\n"
        "연습법: 대본의 각 대사 옆에, 인물이 실제로 원하는 문장을 괄호로 적어보라. "
        "그다음 그 '괄호 속 문장'을 마음에 두고 표면 대사를 말해보라. 같은 대사가 전혀 다르게 들릴 것이다.\n\n"
        "주의: 서브텍스트는 '표정으로 티내는 것'이 아니다. 티내면 그건 이미 텍스트다. "
        "속마음은 감추되, 그 감춤이 몸과 호흡에 긴장으로 남아 있어야 한다."
    ),
}
_SEED_READING = [
    {"title": "『갈매기』 딥리딩 3화", "sub": "니나는 왜 무대로 돌아왔나 · 5분", "minutes": 5, "body": _READING_BODIES["rd_seed_0"]},
    {"title": "서브텍스트란 무엇인가", "sub": "대사분석 워크북 · 카드 12장", "minutes": 8, "body": _READING_BODIES["rd_seed_1"]},
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


_reading_body_ensured = False


def _ensure_reading_body(db: Session):
    """reading_contents.body(신규 additive 컬럼) 보장 + 시드 본문 backfill.
    시드 전용 테이블이라 무손실. 프로세스당 1회만 실행."""
    global _reading_body_ensured
    if _reading_body_ensured:
        return
    from sqlalchemy import text
    try:
        db.execute(text("ALTER TABLE reading_contents ADD COLUMN IF NOT EXISTS body TEXT"))
        db.commit()
    except Exception:
        db.rollback()
    for rid, body in _READING_BODIES.items():
        try:
            db.execute(
                text("UPDATE reading_contents SET body=:b WHERE id=:id AND (body IS NULL OR body='')"),
                {"b": body, "id": rid},
            )
            db.commit()
        except Exception:
            db.rollback()
    _reading_body_ensured = True


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
    _ensure_reading_body(db)
    rows = db.query(ReadingContent).order_by(ReadingContent.sort.asc()).all()
    return [{"id": r.id, "title": r.title, "sub": r.sub, "minutes": r.minutes,
             "hasBody": bool((getattr(r, "body", None) or "").strip())} for r in rows]


@router.get("/reading/{reading_id}")
def reading_detail(reading_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """읽을거리 상세(본문). 본문이 아직 없으면 body=None으로 내려 화면이 '준비 중'을 표시."""
    _ensure_reading_body(db)
    r = db.query(ReadingContent).filter(ReadingContent.id == reading_id).first()
    if r is None:
        raise HTTPException(status_code=404, detail="읽을거리를 찾을 수 없어요.")
    return {"id": r.id, "title": r.title, "sub": r.sub, "minutes": r.minutes, "body": getattr(r, "body", None)}


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
