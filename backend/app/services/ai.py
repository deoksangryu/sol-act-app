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


_SYSTEM = "너는 연기·뮤지컬 입시 면접 코치다. 학생을 존중하는 따뜻한 말투로, 과장 없이 구체적으로 첨삭한다."


def _user_prompt(question: str, answer: str) -> str:
    return (
        "아래 '질문'에 대한 학생의 '답변'을 첨삭하라.\n"
        "반드시 아래 JSON 형식으로만 답하라(키: revised, feedback, summary):\n"
        '{"revised": "더 좋은 답변 예시(3~5문장, 학생 원래 취지 유지)",'
        ' "feedback": ["개선점1", "개선점2", "개선점3"],'
        ' "summary": "한 줄 총평"}\n\n'
        f"[질문]\n{question}\n\n[학생 답변]\n{answer}\n"
    )


def _parse(text: str) -> dict:
    import json
    data = json.loads(text)
    revised = str(data.get("revised", "")).strip()
    fb = data.get("feedback", [])
    if isinstance(fb, str):
        fb = [fb]
    feedback = [str(x).strip() for x in fb if str(x).strip()][:5]
    summary = str(data.get("summary", "")).strip()
    if not revised:
        return dict(_FALLBACK)
    return {"ok": True, "revised": revised, "feedback": feedback, "summary": summary}


def revise_interview_answer(question: str, answer: str) -> dict:
    """입시 면접(연기·뮤지컬) 답변을 첨삭한다.
    반환: {ok, revised(개선 답변), feedback([개선점]), summary(한 줄 총평)}.
    OpenAI 키가 있으면 OpenAI, 없으면 Gemini, 둘 다 없으면 _FALLBACK(항상 dict 반환)."""
    from app.config import settings
    import logging
    log = logging.getLogger(__name__)
    openai_key = (getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    gemini_key = (getattr(settings, "GEMINI_API_KEY", "") or "").strip()
    user = _user_prompt(question, answer)

    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            resp = client.chat.completions.create(
                model=(getattr(settings, "OPENAI_MODEL", "") or "gpt-4o-mini"),
                messages=[{"role": "system", "content": _SYSTEM}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.6,
                max_tokens=1024,
            )
            return _parse(resp.choices[0].message.content or "")
        except Exception as e:
            log.warning(f"revise_interview_answer(openai) failed: {e}")
            return dict(_FALLBACK)

    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            resp = model.generate_content(
                _SYSTEM + "\n\n" + user,
                generation_config={"response_mime_type": "application/json", "temperature": 0.6, "max_output_tokens": 1024},
            )
            return _parse(resp.text)
        except Exception as e:
            log.warning(f"revise_interview_answer(gemini) failed: {e}")
            return dict(_FALLBACK)

    return dict(_FALLBACK)


# ── AI 상대역 대사 생성 ────────────────────────────────────────────────────
# 입시 독백은 원래 상대 대사가 있던 장면을 혼자 하는 것. 학생이 자기 대사(고정)를 쓰고
# 사이사이 '상대 등장' 자리만 표시하면, AI가 '부재하는 상대'의 대사를 흐름에 맞게 채운다.
# - 상대는 처음부터 끝까지 한 인물(일관성)로, 전체를 1회 호출로 생성.
# - 각 상대 대사는 앞 학생 대사에 반응 + 뒤 학생 대사로 이어지는 '다리'.
# - 매 호출마다 다르게(temperature 높음) → 학생이 매번 새롭게 듣고 반응하는 연습.
_SCENE_SYSTEM = (
    "너는 연기 입시(연극영화과) 장면의 '상대역' 대사를 쓰는 극작 보조다. "
    "학생의 대사(고정, 절대 수정 금지) 사이에 등장하는 '부재하는 상대'의 대사를 채운다. "
    "규칙: (1) 상대는 처음부터 끝까지 '한 인물'로 일관되게 유지한다. "
    "(2) 각 상대 대사는 바로 앞 학생 대사에 자연스럽게 반응하고, 바로 뒤 학생 대사가 매끄럽게 이어지도록 '다리'를 놓는다. "
    "(3) 짧게 — 보통 1~2문장. 장면을 늘어뜨리지 않는다. "
    "(4) 자연스러운 한국어 구어체. 10~20대 인물에 어울리게. "
    "(5) 100% 창작 — 기존 희곡·영화·드라마의 실제 대사를 복제하지 않는다. "
    "(6) 입시장에 적절하게 — 과도한 욕설·성적·폭력 표현 금지."
)


def _scene_user_prompt(turns, partner_hint: str) -> str:
    lines, slot = [], 0
    for t in turns:
        if t.get("speaker") == "상대":
            slot += 1
            h = (t.get("hint") or "").strip()
            lines.append(f"[상대 대사 #{slot}]" + (f" (힌트: {h})" if h else ""))
        else:
            lines.append(f"나: {(t.get('text') or '').strip()}")
    seq = "\n".join(lines)
    who = f"\n상대 인물 설정: {partner_hint.strip()}\n" if (partner_hint or "").strip() else "\n"
    return (
        "아래는 학생이 혼자 연기할 장면이다. '나:'는 학생의 고정 대사이고, "
        "[상대 대사 #n]은 네가 채워야 할 '부재하는 상대'의 자리다." + who + "\n"
        f"{seq}\n\n"
        "[상대 대사 #1]부터 순서대로 각 자리를 채워라. 반드시 아래 JSON만 출력하라:\n"
        '{"partner": ["#1 자리 상대 대사", "#2 자리 상대 대사", ...], "gender": "남|여|중성"}\n'
        "partner 배열 길이는 상대 자리 개수와 정확히 같아야 한다. gender는 상대 인물의 성별(남/여/중성)이다."
    )


def _scene_fallback(turns) -> dict:
    return {"ok": False, "turns": turns, "message": "AI 상대역 생성이 아직 준비 중이에요. 잠시 후 다시 시도해주세요."}


def generate_scene_partner(turns, partner_hint: str = "") -> dict:
    """학생 대사(고정) 사이의 '상대 등장' 자리를 AI가 채운다.
    turns: [{"speaker": "나"|"상대", "text": str, "hint": str}] — '상대' 자리는 text 비어있음.
    반환: {ok, turns:[{speaker,text}]} — '상대' 자리가 채워진 전체 시퀀스. 실패 시 ok=False + message.
    OpenAI 우선, 없으면 Gemini, 둘 다 없으면 폴백."""
    from app.config import settings
    import logging, json
    log = logging.getLogger(__name__)
    slots = [i for i, t in enumerate(turns) if t.get("speaker") == "상대"]
    if not slots:
        return {"ok": True, "turns": [{"speaker": "나", "text": (t.get("text") or "").strip()} for t in turns]}

    def _apply(partner_list) -> list:
        pl = [str(x).strip() for x in (partner_list or [])]
        out = []
        si = 0
        for t in turns:
            if t.get("speaker") == "상대":
                txt = pl[si] if si < len(pl) and pl[si] else "…"
                out.append({"speaker": "상대", "text": txt})
                si += 1
            else:
                out.append({"speaker": "나", "text": (t.get("text") or "").strip()})
        return out

    openai_key = (getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    gemini_key = (getattr(settings, "GEMINI_API_KEY", "") or "").strip()
    user = _scene_user_prompt(turns, partner_hint)

    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            resp = client.chat.completions.create(
                model=(getattr(settings, "OPENAI_MODEL", "") or "gpt-4o-mini"),
                messages=[{"role": "system", "content": _SCENE_SYSTEM}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.9,
                max_tokens=800,
            )
            data = json.loads(resp.choices[0].message.content or "{}")
            partner = data.get("partner") or data.get("lines") or []
            if isinstance(partner, str):
                partner = [partner]
            if not partner:
                return _scene_fallback(turns)
            return {"ok": True, "turns": _apply(partner), "voice_gender": str(data.get("gender") or "중성").strip()}
        except Exception as e:
            log.warning(f"generate_scene_partner(openai) failed: {e}")
            return _scene_fallback(turns)

    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            resp = model.generate_content(
                _SCENE_SYSTEM + "\n\n" + user,
                generation_config={"response_mime_type": "application/json", "temperature": 0.9, "max_output_tokens": 800},
            )
            data = json.loads(resp.text)
            partner = data.get("partner") or []
            if isinstance(partner, str):
                partner = [partner]
            if not partner:
                return _scene_fallback(turns)
            return {"ok": True, "turns": _apply(partner), "voice_gender": str(data.get("gender") or "중성").strip()}
        except Exception as e:
            log.warning(f"generate_scene_partner(gemini) failed: {e}")
            return _scene_fallback(turns)

    return _scene_fallback(turns)


# ── 클라우드 TTS (OpenAI) — 상대 대사를 성별에 맞는 보이스로 음성 합성 ──────────
# 상대 성별(남/여/중성)에 맞춰 OpenAI 보이스를 고르고 mp3 바이트를 반환한다.
# 키 없음/실패 시 None(호출측이 온디바이스 TTS로 폴백).
_VOICE_BY_GENDER = {"남": "onyx", "여": "nova", "중성": "alloy"}


def voice_for_gender(gender: str) -> str:
    return _VOICE_BY_GENDER.get((gender or "").strip(), "alloy")


def synthesize_tts(text: str, voice: str = "alloy"):
    """텍스트를 OpenAI TTS로 음성 합성해 mp3 bytes를 반환. 실패/키없음 시 None."""
    from app.config import settings
    import logging
    log = logging.getLogger(__name__)
    text = (text or "").strip()
    if not text:
        return None
    openai_key = (getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    if not openai_key:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=openai_key)
        resp = client.audio.speech.create(
            model="gpt-4o-mini-tts",
            voice=voice if voice in _VOICE_BY_GENDER.values() else "alloy",
            input=text[:600],
            response_format="mp3",
        )
        return resp.read()
    except Exception as e:
        log.warning(f"synthesize_tts failed: {e}")
        return None
