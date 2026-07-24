# AI service — temporarily disabled (Gemini API key not configured)
# All functions return placeholder responses. To re-enable:
# 1. Set GEMINI_API_KEY in .env
# 2. Restore the original ai.py from git history

_DISABLED_MSG = "AI 기능은 준비 중입니다."


def analyze_diet(description: str, image_base64: str = None) -> dict:
    return {"calories": 0, "advice": _DISABLED_MSG}


def analyze_monologue(text: str) -> str:
    return _DISABLED_MSG


def ask_ai_tutor(question: str) -> str:
    return _DISABLED_MSG


def generate_journal_feedback(content: str, journal_type: str) -> str:
    return _DISABLED_MSG


def generate_evaluation_summary(evaluations_data: str) -> str:
    return _DISABLED_MSG


def analyze_portfolio(title: str, description: str, category: str) -> str:
    return _DISABLED_MSG


def generate_audition_tips(title: str, description: str, audition_type: str) -> str:
    return _DISABLED_MSG


# ── 면접 질의응답 AI 첨삭 (Gemini 1.5 Flash, 무료 티어) ──────────────────
# 키(GEMINI_API_KEY)가 없거나 호출 실패 시 안전 폴백을 반환한다(예외 전파 없음).
_FALLBACK = {
    "ok": False,
    "revised": "",
    "feedback": ["AI 첨삭 기능이 아직 준비 중이에요. 잠시 후 다시 시도해주세요."],
    "summary": "AI 첨삭 준비 중",
}


def revise_interview_answer(question: str, answer: str) -> dict:
    """입시 면접(연기·뮤지컬) 답변을 첨삭한다.
    반환: {ok, revised(개선 답변), feedback([개선점]), summary(한 줄 총평)}.
    키가 없거나 오류면 _FALLBACK을 반환(호출측은 항상 dict를 받음)."""
    from app.config import settings
    import logging
    log = logging.getLogger(__name__)
    key = (getattr(settings, "GEMINI_API_KEY", "") or "").strip()
    if not key:
        return dict(_FALLBACK)
    try:
        import json
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            "너는 연기·뮤지컬 입시 면접 코치다. 아래 '질문'에 대한 학생의 '답변'을 첨삭하라.\n"
            "학생을 존중하는 따뜻한 말투로, 과장 없이 구체적으로.\n"
            "반드시 아래 JSON 형식으로만 답하라(키: revised, feedback, summary):\n"
            '{"revised": "더 좋은 답변 예시(3~5문장, 학생 원래 취지 유지)",'
            ' "feedback": ["개선점1", "개선점2", "개선점3"],'
            ' "summary": "한 줄 총평"}\n\n'
            f"[질문]\n{question}\n\n[학생 답변]\n{answer}\n"
        )
        resp = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.6,
                "max_output_tokens": 1024,
            },
        )
        data = json.loads(resp.text)
        revised = str(data.get("revised", "")).strip()
        fb = data.get("feedback", [])
        if isinstance(fb, str):
            fb = [fb]
        feedback = [str(x).strip() for x in fb if str(x).strip()][:5]
        summary = str(data.get("summary", "")).strip()
        if not revised:
            return dict(_FALLBACK)
        return {"ok": True, "revised": revised, "feedback": feedback, "summary": summary}
    except Exception as e:
        log.warning(f"revise_interview_answer failed: {e}")
        return dict(_FALLBACK)
