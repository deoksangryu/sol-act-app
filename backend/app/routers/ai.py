"""AI 학습 도구 라우터 — 면접 질의응답 첨삭.

Gemini 호출은 블로킹이므로 run_in_threadpool로 이벤트 루프 밖에서 실행.
키가 없으면 ai.revise_interview_answer가 안전 폴백(ok=False)을 반환한다(500 아님).
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.models.user import User
from app.utils.auth import get_current_user
from app.services import ai

router = APIRouter()


class ReviseReq(BaseModel):
    question: str
    answer: str


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
