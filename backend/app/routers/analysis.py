"""작품분석(Work Analysis) — 학생 GOTE 구조 분석 → 제출 → 강사 첨삭 → 개정.

- 학생: 작품 생성/초안 저장(자동저장)/제출/내 목록/상세/개정(새 버전).
- 강사·원장: 상세 열람/칸별 코멘트/첨삭(루브릭+3분할 요약).
- 제출은 통합 인박스(Submission kind='analysis')에 편승 → 교사가 쓰던 v2Inbox에 자동 노출.
  기존 테이블 무접촉(신규 테이블 + Submission INSERT/UPDATE만).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.models.analysis import WorkAnalysis, AnalysisVersion, AnalysisFeedback, AnalysisFieldComment
from app.models.submission import Submission
from app.utils.auth import get_current_user
from app.services.notification_service import (
    notify_users, notify_user, get_teacher_ids_for_student,
)

router = APIRouter()

TYPE_LABEL = {"monologue": "독백 대사분석", "play": "희곡 작품 전체분석", "musical": "뮤지컬 넘버 분석"}
# 한예종 2000자 게이지 대상 서술 필드(payload 안)
_TEXT_KEYS = ["oneLine", "goal", "other", "obstacle", "expectation", "given", "subtext",
              "theme", "structure", "intent", "why", "trigger", "change", "vocal",
              "momentBefore", "opposites", "partnerWho", "partnerDo", "catchPoint"]


def _uid(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def _count_chars(payload: Dict[str, Any]) -> int:
    n = 0
    for k in _TEXT_KEYS:
        v = payload.get(k)
        if isinstance(v, str):
            n += len(v)
    for row_key in ("beats", "musicMap", "relations", "qa"):
        rows = payload.get(row_key)
        if isinstance(rows, list):
            for r in rows:
                if isinstance(r, dict):
                    n += sum(len(x) for x in r.values() if isinstance(x, str))
    return n


def _require_staff(user: User) -> None:
    if user.role not in (UserRole.TEACHER, UserRole.DIRECTOR):
        raise HTTPException(status_code=403, detail="강사/원장 전용")


def _ver_dict(v: AnalysisVersion, with_feedback: bool = True) -> Dict[str, Any]:
    d = {
        "id": v.id, "versionNo": v.version_no, "payload": v.payload or {},
        "charCount": v.char_count, "status": v.status,
        "submittedAt": v.submitted_at.isoformat() if v.submitted_at else None,
        "createdAt": v.created_at.isoformat() if v.created_at else None,
    }
    if with_feedback:
        fb = v.feedback
        d["feedback"] = None if not fb else {
            "rubric": fb.rubric or {}, "good": fb.summary_good,
            "fix": fb.summary_fix, "next": fb.summary_next,
            "createdAt": fb.created_at.isoformat() if fb.created_at else None,
        }
        d["comments"] = [{
            "id": c.id, "fieldKey": c.field_key, "content": c.content,
            "createdAt": c.created_at.isoformat() if c.created_at else None,
        } for c in v.comments]
    return d


def _analysis_dict(a: WorkAnalysis, with_versions: bool = False) -> Dict[str, Any]:
    d = {
        "id": a.id, "type": a.type, "typeLabel": TYPE_LABEL.get(a.type, a.type),
        "title": a.title, "author": a.author, "character": a.character,
        "scene": a.scene, "targetSchool": a.target_school,
        "currentVersion": a.current_version, "status": a.status,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
        "updatedAt": a.updated_at.isoformat() if a.updated_at else None,
    }
    if with_versions:
        d["versions"] = [_ver_dict(v) for v in a.versions]
    return d


def _get_owned(db: Session, analysis_id: str, uid: str) -> WorkAnalysis:
    a = db.query(WorkAnalysis).filter(WorkAnalysis.id == analysis_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="분석을 찾을 수 없어요")
    if a.student_id != uid:
        raise HTTPException(status_code=403, detail="본인 분석만 접근할 수 있어요")
    return a


def _current_version(db: Session, a: WorkAnalysis) -> AnalysisVersion:
    return db.query(AnalysisVersion).filter(
        AnalysisVersion.analysis_id == a.id,
        AnalysisVersion.version_no == a.current_version,
    ).first()


# ---------------------------- 학생 ----------------------------

class CreateAnalysis(BaseModel):
    type: str                      # monologue | play | musical
    title: str
    author: Optional[str] = None
    character: Optional[str] = None
    scene: Optional[str] = None
    targetSchool: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


@router.post("")
def create_analysis(data: CreateAnalysis, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.type not in TYPE_LABEL:
        raise HTTPException(status_code=400, detail="분석 종류가 올바르지 않아요")
    if not (data.title or "").strip():
        raise HTTPException(status_code=400, detail="작품명을 입력해주세요")
    a = WorkAnalysis(
        id=_uid("wa"), student_id=current_user.id, type=data.type,
        title=data.title.strip(), author=data.author, character=data.character,
        scene=data.scene, target_school=data.targetSchool,
        current_version=1, status="draft",
    )
    db.add(a)
    payload = data.payload or {}
    v = AnalysisVersion(
        id=_uid("av"), analysis_id=a.id, version_no=1, payload=payload,
        char_count=_count_chars(payload), status="draft",
    )
    db.add(v)
    db.commit()
    db.refresh(a); db.refresh(v)
    return {"id": a.id, "versionId": v.id, "versionNo": 1}


class SaveVersion(BaseModel):
    payload: Dict[str, Any]
    title: Optional[str] = None
    author: Optional[str] = None
    character: Optional[str] = None
    scene: Optional[str] = None
    targetSchool: Optional[str] = None


@router.put("/{analysis_id}/version")
def save_version(analysis_id: str, data: SaveVersion, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """현재 draft 버전 payload 저장(자동저장). draft가 아니면 409(개정으로 새 버전 만들어야 함)."""
    a = _get_owned(db, analysis_id, current_user.id)
    v = _current_version(db, a)
    if not v:
        raise HTTPException(status_code=404, detail="버전을 찾을 수 없어요")
    if v.status != "draft":
        raise HTTPException(status_code=409, detail="제출된 버전은 수정할 수 없어요. '고쳐서 다시 내기'로 새 버전을 만들어주세요.")
    v.payload = data.payload
    v.char_count = _count_chars(data.payload)
    if data.title is not None and data.title.strip():
        a.title = data.title.strip()
    for attr, val in (("author", data.author), ("character", data.character),
                      ("scene", data.scene), ("target_school", data.targetSchool)):
        if val is not None:
            setattr(a, attr, val)
    a.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "charCount": v.char_count}


@router.post("/{analysis_id}/submit")
async def submit_analysis(analysis_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """현재 버전 제출 → 강사 알림 + 통합 인박스(Submission kind='analysis') 생성."""
    a = _get_owned(db, analysis_id, current_user.id)
    v = _current_version(db, a)
    if not v:
        raise HTTPException(status_code=404, detail="버전을 찾을 수 없어요")
    if v.status == "submitted" and a.status == "submitted":
        return {"ok": True, "already": True}
    now = datetime.utcnow()
    v.status = "submitted"
    v.submitted_at = now
    a.status = "submitted"
    # 통합 인박스 편승 — note에 analysis_id 저장(딥링크·done 매칭용)
    teachers = get_teacher_ids_for_student(db, current_user.id)
    sub = Submission(
        id=f"sub{uuid.uuid4().hex[:12]}", student_id=current_user.id,
        teacher_id=(teachers[0] if teachers else None),
        kind="analysis", title=f"{a.title} · {a.character or ''}".strip(" ·"),
        note=a.id, status="open",
    )
    db.add(sub)
    v.submission_id = sub.id
    db.commit()
    await notify_users(db, teachers, f"{current_user.name}님이 작품분석을 제출했어요", entity="submission")
    return {"ok": True, "versionNo": v.version_no}


@router.get("/mine")
def my_analyses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(WorkAnalysis).filter(
        WorkAnalysis.student_id == current_user.id
    ).order_by(WorkAnalysis.updated_at.desc()).limit(100).all()
    return [_analysis_dict(a) for a in rows]


@router.get("/{analysis_id}")
def get_analysis(analysis_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """상세 — 본인(학생) 또는 강사/원장이 열람. 버전+피드백+코멘트 포함."""
    a = db.query(WorkAnalysis).options(
        joinedload(WorkAnalysis.versions).joinedload(AnalysisVersion.feedback),
        joinedload(WorkAnalysis.versions).joinedload(AnalysisVersion.comments),
    ).filter(WorkAnalysis.id == analysis_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="분석을 찾을 수 없어요")
    is_owner = a.student_id == current_user.id
    is_staff = current_user.role in (UserRole.TEACHER, UserRole.DIRECTOR)
    if not (is_owner or is_staff):
        raise HTTPException(status_code=403, detail="접근 권한이 없어요")
    d = _analysis_dict(a, with_versions=True)
    d["studentId"] = a.student_id
    return d


@router.post("/{analysis_id}/revise")
def revise_analysis(analysis_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """최신 버전을 복제해 새 draft 버전(version_no+1)을 만든다 → 다시 편집·제출 가능."""
    a = _get_owned(db, analysis_id, current_user.id)
    latest = db.query(AnalysisVersion).filter(
        AnalysisVersion.analysis_id == a.id
    ).order_by(AnalysisVersion.version_no.desc()).first()
    if not latest:
        raise HTTPException(status_code=404, detail="버전을 찾을 수 없어요")
    new_no = latest.version_no + 1
    nv = AnalysisVersion(
        id=_uid("av"), analysis_id=a.id, version_no=new_no,
        payload=dict(latest.payload or {}), char_count=latest.char_count, status="draft",
    )
    db.add(nv)
    a.current_version = new_no
    a.status = "draft"
    a.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(nv)
    return {"ok": True, "versionId": nv.id, "versionNo": new_no}


# ---------------------------- 강사·원장 ----------------------------

class FeedbackBody(BaseModel):
    rubric: Optional[Dict[str, int]] = None
    good: Optional[str] = None
    fix: Optional[str] = None
    next: Optional[str] = None


@router.post("/version/{version_id}/feedback")
async def submit_feedback(version_id: str, body: FeedbackBody, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """강사 첨삭 — 루브릭+3분할 요약 저장 → reviewed + 인박스 done + 학생 알림."""
    _require_staff(current_user)
    v = db.query(AnalysisVersion).filter(AnalysisVersion.id == version_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="버전을 찾을 수 없어요")
    a = db.query(WorkAnalysis).filter(WorkAnalysis.id == v.analysis_id).first()
    fb = v.feedback
    if fb is None:
        fb = AnalysisFeedback(id=_uid("af"), version_id=v.id, author_id=current_user.id)
        db.add(fb)
    fb.author_id = current_user.id
    fb.rubric = body.rubric or {}
    fb.summary_good = body.good
    fb.summary_fix = body.fix
    fb.summary_next = body.next
    v.status = "reviewed"
    if a:
        a.status = "reviewed"
    # 통합 인박스 done 처리(리드타임 확정)
    if v.submission_id:
        sub = db.query(Submission).filter(Submission.id == v.submission_id).first()
        if sub and sub.status != "done":
            if sub.first_feedback_at is None:
                sub.first_feedback_at = datetime.utcnow()
            sub.status = "done"
            sub.feedback = (body.fix or body.good or "첨삭 완료")[:500]
            if not sub.teacher_id:
                sub.teacher_id = current_user.id
    db.commit()
    if a:
        await notify_user(db, a.student_id, f"{current_user.name} 선생님이 작품분석을 첨삭했어요", entity="feedback")
    return {"ok": True}


class CommentBody(BaseModel):
    fieldKey: str
    content: str


@router.post("/version/{version_id}/comment")
def add_comment(version_id: str, body: CommentBody, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """강사 칸별 코멘트."""
    _require_staff(current_user)
    v = db.query(AnalysisVersion).filter(AnalysisVersion.id == version_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="버전을 찾을 수 없어요")
    if not (body.content or "").strip():
        raise HTTPException(status_code=400, detail="코멘트를 입력해주세요")
    c = AnalysisFieldComment(
        id=_uid("afc"), version_id=v.id, author_id=current_user.id,
        field_key=body.fieldKey, content=body.content.strip(),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "fieldKey": c.field_key, "content": c.content}


@router.delete("/comment/{comment_id}")
def delete_comment(comment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_staff(current_user)
    c = db.query(AnalysisFieldComment).filter(AnalysisFieldComment.id == comment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="코멘트를 찾을 수 없어요")
    if c.author_id != current_user.id and current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="본인 코멘트만 삭제할 수 있어요")
    db.delete(c)
    db.commit()
    return {"ok": True}
