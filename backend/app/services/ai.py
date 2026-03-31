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
