"""AI 학습 도구 라우터 — 면접 첨삭 + AI 상대역 대사 생성.

블로킹 AI 호출은 run_in_threadpool로 이벤트 루프 밖에서 실행.
키가 없으면 서비스가 안전 폴백(ok=False)을 반환한다(500 아님).
"""
import uuid as _uuid
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.scene import SceneRehearsal, AppSetting
from app.utils.auth import get_current_user
from app.utils.timezone import kst_day_start_utc
from app.services import ai
from app.services.file_upload import UPLOAD_DIR

router = APIRouter()

_LIMIT_KEY = "scene_daily_limit"
_DEFAULT_LIMIT = 3


def _daily_limit(db: Session) -> int:
    row = db.query(AppSetting).filter(AppSetting.key == _LIMIT_KEY).first()
    try:
        return max(0, int(row.value)) if row else _DEFAULT_LIMIT
    except (TypeError, ValueError):
        return _DEFAULT_LIMIT


def _today_count(db: Session, uid: str) -> int:
    return db.query(SceneRehearsal).filter(
        SceneRehearsal.student_id == uid,
        SceneRehearsal.created_at >= kst_day_start_utc(),
    ).count()


def _scene_title(input_turns: List[Dict[str, Any]], partner_hint: str) -> str:
    if (partner_hint or "").strip():
        base = f"상대: {partner_hint.strip()}"
    else:
        first = next((t.get("text") for t in input_turns if t.get("speaker") == "나" and (t.get("text") or "").strip()), "장면")
        base = (first or "장면").strip()
    return base[:24]


def _save_scene(db: Session, uid: str, input_turns: List[Dict[str, Any]], result: Dict[str, Any], partner_hint: str) -> str:
    """생성 결과를 학생 라이브러리에 저장. 내 대사 sec(연기시간)은 입력 turns에서 순서로 붙인다."""
    saved = []
    for i, t in enumerate(result.get("turns", [])):
        if t.get("speaker") == "나":
            src = input_turns[i] if i < len(input_turns) else {}
            sec = src.get("sec")
            row = {"speaker": "나", "text": t.get("text", "")}
            if isinstance(sec, (int, float)):
                row["sec"] = sec
            saved.append(row)
        else:
            saved.append({"speaker": "상대", "text": t.get("text", ""), "audioUrl": t.get("audioUrl")})
    sid = _uuid.uuid4().hex
    db.add(SceneRehearsal(
        id=sid, student_id=uid, title=_scene_title(input_turns, partner_hint),
        partner_hint=(partner_hint or "").strip() or None, voice=result.get("voice"),
        turns=saved,
    ))
    db.commit()
    return sid


def _build_scene(turns: List[Dict[str, Any]], partner_hint: str, situation: str = "", voice_override: str = "") -> Dict[str, Any]:
    """상대 대사 생성(상황 맥락 반영) + 성별맞춤/선택 보이스로 TTS 합성·저장 → audioUrl 부착.
    (블로킹 — run_in_threadpool로 호출.) TTS 실패 시 audioUrl 없이 반환(클라가 온디바이스 TTS 폴백)."""
    result = ai.generate_scene_partner(turns, partner_hint, situation)
    if not result.get("ok"):
        return result
    gender = result.get("voice_gender", "중성")
    age = result.get("voice_age", "middle")
    vid = ai.pick_voice(gender, age, voice_override or result.get("voice_id", ""))  # 학생 선택 우선, 없으면 GPT
    tts_dir = UPLOAD_DIR / "tts"
    for t in result.get("turns", []):
        if t.get("speaker") == "상대" and (t.get("text") or "").strip():
            audio = ai.synthesize_tts(t["text"], vid, gender)
            if audio:
                try:
                    tts_dir.mkdir(parents=True, exist_ok=True)
                    fname = f"{_uuid.uuid4().hex}.mp3"
                    (tts_dir / fname).write_bytes(audio)
                    t["audioUrl"] = f"/uploads/tts/{fname}"
                except Exception:
                    pass
    result["voice"] = vid
    return result


def _build_custom_scene(turns: List[Dict[str, Any]], gender: str, age: str, voice_override: str = "") -> Dict[str, Any]:
    """커스텀 모드: 학생이 직접 쓴 상대 대사를 학생이 고른 보이스(또는 성별×나이 매칭 랜덤)로 TTS만 합성.
    (LLM 생성 없음 — 진짜 대본 그대로 연습.) 블로킹 → run_in_threadpool."""
    g, a = ai._norm_gender(gender), ai._norm_age(age)
    vid = ai.pick_voice(g, a, voice_override)  # 학생이 보이스 직접 고르면 그것, 아니면 매칭 랜덤
    tts_dir = UPLOAD_DIR / "tts"
    out: List[Dict[str, Any]] = []
    for t in turns:
        if t.get("speaker") == "상대":
            text = (t.get("text") or "").strip()
            row: Dict[str, Any] = {"speaker": "상대", "text": text}
            if text:
                audio = ai.synthesize_tts(text, vid, g)
                if audio:
                    try:
                        tts_dir.mkdir(parents=True, exist_ok=True)
                        fname = f"{_uuid.uuid4().hex}.mp3"
                        (tts_dir / fname).write_bytes(audio)
                        row["audioUrl"] = f"/uploads/tts/{fname}"
                    except Exception:
                        pass
            out.append(row)
        else:
            out.append({"speaker": "나", "text": (t.get("text") or "").strip()})
    return {"ok": True, "turns": out, "voice": vid}


class ReviseReq(BaseModel):
    question: str
    answer: str


class ScenePartnerReq(BaseModel):
    turns: List[Dict[str, Any]]   # [{speaker:"나"|"상대", text?:str, hint?:str}]
    partner: str = ""             # (선택) 상대 인물 설정 힌트
    situation: str = ""           # (선택) 장면 상황·맥락 설명 → 대사 정확도↑
    mode: str = "ai"              # "ai"=AI가 상대 대사 생성 / "custom"=학생이 직접 작성
    gender: str = ""              # custom 모드: 학생이 고른 성별(남/여/중성)
    age: str = ""                 # custom 모드: 학생이 고른 나이(young/middle/old)
    voiceId: str = ""             # (선택) 학생이 직접 고른 보이스 id → GPT 자동선택 대신 사용


@router.post("/interview-revise")
async def interview_revise(data: ReviseReq, current_user: User = Depends(get_current_user)):
    q = (data.question or "").strip()[:1000]
    a = (data.answer or "").strip()
    if len(a) < 5:
        raise HTTPException(status_code=400, detail="답변을 조금 더 작성해주세요(5자 이상).")
    if len(a) > 2000:
        raise HTTPException(status_code=400, detail="답변이 너무 길어요(2000자 이내로 줄여주세요).")
    # 블로킹 AI 호출을 스레드풀로 오프로드
    return await run_in_threadpool(ai.revise_interview_answer, q, a)


@router.post("/scene-partner")
async def scene_partner(data: ScenePartnerReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """학생 대사(고정) 사이의 '상대 등장' 자리를 AI가 채우고 성별×나이 맞춤 TTS 합성.
    하루 생성 횟수 제한(원장 조절). 성공 시 학생 라이브러리에 자동 저장(불러오기 가능)."""
    turns = data.turns or []
    if len(turns) > 40:
        raise HTTPException(status_code=400, detail="대사가 너무 많아요(40줄 이내).")
    my_lines = [t for t in turns if t.get("speaker") == "나" and (t.get("text") or "").strip()]
    slots = [t for t in turns if t.get("speaker") == "상대"]
    if len(my_lines) < 1:
        raise HTTPException(status_code=400, detail="내 대사를 한 줄 이상 입력해주세요.")
    if len(slots) < 1:
        raise HTTPException(status_code=400, detail="상대가 등장하는 지점을 한 곳 이상 표시해주세요.")
    is_custom = (data.mode or "ai") == "custom"
    if is_custom and any(not (t.get("text") or "").strip() for t in slots):
        raise HTTPException(status_code=400, detail="커스텀 모드에선 상대 대사를 직접 입력해주세요.")
    total = sum(len((t.get("text") or "")) for t in turns)
    if total > 4000:
        raise HTTPException(status_code=400, detail="장면이 너무 길어요(전체 4000자 이내).")

    # 하루 생성 제한 (저장된 장면 불러오기는 무제한 — 여긴 '새 생성'만 카운트. 커스텀도 TTS 비용이라 포함)
    limit = _daily_limit(db)
    used = _today_count(db, current_user.id)
    if used >= limit:
        raise HTTPException(status_code=429, detail=f"오늘 새 상대역 생성 한도({limit}회)를 다 썼어요. 저장된 장면을 불러와 연습하거나 내일 다시 시도해주세요.")

    if is_custom:
        result = await run_in_threadpool(_build_custom_scene, turns, data.gender, data.age, (data.voiceId or "").strip())
    else:
        result = await run_in_threadpool(_build_scene, turns, (data.partner or "")[:100], (data.situation or "")[:500], (data.voiceId or "").strip())
    if result.get("ok"):
        try:
            result["sceneId"] = _save_scene(db, current_user.id, turns, result, (data.partner or "")[:100])
        except Exception:
            db.rollback()
        result["limit"] = limit
        result["remaining"] = max(0, limit - _today_count(db, current_user.id))
    return result


# ── 저장된 장면 라이브러리 (불러오기 = 크레딧 0) ──────────────────────────────
def _tts_path(url: str):
    # /uploads/tts/xxx.mp3 → UPLOAD_DIR/tts/xxx.mp3
    if not url or "/uploads/tts/" not in url:
        return None
    name = url.split("/uploads/tts/", 1)[1].split("/")[0]
    p = (UPLOAD_DIR / "tts" / name).resolve()
    return p if str(p).startswith(str((UPLOAD_DIR / "tts").resolve())) else None


@router.get("/scenes")
def list_scenes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """내가 저장한 장면 목록(최신순)."""
    rows = db.query(SceneRehearsal).filter(SceneRehearsal.student_id == current_user.id).order_by(SceneRehearsal.created_at.desc()).limit(100).all()
    return [{
        "id": r.id, "title": r.title, "partnerHint": r.partner_hint, "voice": r.voice,
        "lineCount": len(r.turns or []), "createdAt": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]


@router.get("/scenes/{scene_id}")
def get_scene(scene_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """저장 장면 불러오기(본인 것만). turns를 그대로 재생 — 재생성 없음(크레딧 0)."""
    r = db.query(SceneRehearsal).filter(SceneRehearsal.id == scene_id, SceneRehearsal.student_id == current_user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="장면을 찾을 수 없어요.")
    return {"id": r.id, "title": r.title, "partnerHint": r.partner_hint, "voice": r.voice, "turns": r.turns or []}


@router.delete("/scenes/{scene_id}")
def delete_scene(scene_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """저장 장면 삭제(본인 것만) + 음성 mp3 파일 제거."""
    r = db.query(SceneRehearsal).filter(SceneRehearsal.id == scene_id, SceneRehearsal.student_id == current_user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="장면을 찾을 수 없어요.")
    for t in (r.turns or []):
        p = _tts_path(t.get("audioUrl") or "")
        if p:
            try:
                p.unlink(missing_ok=True)
            except Exception:
                pass
    db.delete(r)
    db.commit()
    return {"ok": True}


@router.get("/voices")
def list_voices(current_user: User = Depends(get_current_user)):
    """상대 보이스 카탈로그 + 미리듣기 샘플 URL(사전 생성 = 무료). 학생이 듣고 고른다."""
    return [{
        "id": v["id"], "gender": v["gender"], "age": v["age"], "traits": v["traits"],
        "sampleUrl": f"/uploads/voice-samples/{v['id']}.mp3",
    } for v in ai._VOICE_CATALOG]


@router.get("/scene-quota")
def scene_quota(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """오늘 새 생성 사용량/한도."""
    limit = _daily_limit(db)
    used = _today_count(db, current_user.id)
    return {"limit": limit, "used": used, "remaining": max(0, limit - used)}


# ── 원장: 하루 생성 제한 조절 ────────────────────────────────────────────────
class LimitReq(BaseModel):
    limit: int


@router.get("/scene-limit")
def get_scene_limit(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"limit": _daily_limit(db)}


@router.put("/scene-limit")
def set_scene_limit(data: LimitReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="원장만 변경할 수 있어요.")
    n = max(0, min(50, int(data.limit)))
    row = db.query(AppSetting).filter(AppSetting.key == _LIMIT_KEY).first()
    if row:
        row.value = str(n)
    else:
        db.add(AppSetting(key=_LIMIT_KEY, value=str(n)))
    db.commit()
    return {"limit": n}
