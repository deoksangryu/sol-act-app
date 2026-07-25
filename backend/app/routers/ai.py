"""AI 학습 도구 라우터 — 면접 첨삭 + AI 상대역 대사 생성.

블로킹 AI 호출은 run_in_threadpool로 이벤트 루프 밖에서 실행.
키가 없으면 서비스가 안전 폴백(ok=False)을 반환한다(500 아님).
"""
import uuid as _uuid
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.models.user import User
from app.utils.auth import get_current_user
from app.services import ai
from app.services.file_upload import UPLOAD_DIR

router = APIRouter()


def _build_scene(turns: List[Dict[str, Any]], partner_hint: str) -> Dict[str, Any]:
    """상대 대사 생성 + 각 상대 대사를 성별맞춤 OpenAI TTS로 합성·저장 → audioUrl 부착.
    (블로킹 — run_in_threadpool로 호출.) TTS 실패 시 audioUrl 없이 반환(클라가 온디바이스 TTS 폴백)."""
    result = ai.generate_scene_partner(turns, partner_hint)
    if not result.get("ok"):
        return result
    gender = result.get("voice_gender", "중성")
    age = result.get("voice_age", "middle")
    tts_dir = UPLOAD_DIR / "tts"
    for t in result.get("turns", []):
        if t.get("speaker") == "상대" and (t.get("text") or "").strip():
            audio = ai.synthesize_tts(t["text"], gender, age)
            if audio:
                try:
                    tts_dir.mkdir(parents=True, exist_ok=True)
                    fname = f"{_uuid.uuid4().hex}.mp3"
                    (tts_dir / fname).write_bytes(audio)
                    t["audioUrl"] = f"/uploads/tts/{fname}"
                except Exception:
                    pass
    result["voice"] = f"{gender}/{age}"
    return result


class ReviseReq(BaseModel):
    question: str
    answer: str


class ScenePartnerReq(BaseModel):
    turns: List[Dict[str, Any]]   # [{speaker:"나"|"상대", text?:str, hint?:str}]
    partner: str = ""             # (선택) 상대 인물 설정 힌트


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
async def scene_partner(data: ScenePartnerReq, current_user: User = Depends(get_current_user)):
    """학생 대사(고정) 사이의 '상대 등장' 자리를 AI가 채운다.
    입력: turns=[{speaker,text?,hint?}] (상대 자리는 text 비움). 반환: {ok, turns:[{speaker,text}]}."""
    turns = data.turns or []
    if len(turns) > 40:
        raise HTTPException(status_code=400, detail="대사가 너무 많아요(40줄 이내).")
    my_lines = [t for t in turns if t.get("speaker") == "나" and (t.get("text") or "").strip()]
    slots = [t for t in turns if t.get("speaker") == "상대"]
    if len(my_lines) < 1:
        raise HTTPException(status_code=400, detail="내 대사를 한 줄 이상 입력해주세요.")
    if len(slots) < 1:
        raise HTTPException(status_code=400, detail="상대가 등장하는 지점을 한 곳 이상 표시해주세요.")
    total = sum(len((t.get("text") or "")) for t in turns)
    if total > 4000:
        raise HTTPException(status_code=400, detail="장면이 너무 길어요(전체 4000자 이내).")
    return await run_in_threadpool(_build_scene, turns, (data.partner or "")[:100])
