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
    "(2) 각 상대 대사는 (a) 바로 앞 학생 대사에 대한 자연스러운 반응이면서, (b) 바로 뒤 학생 대사가 매끄럽게 이어지도록 '다리'를 놓고, (c) 장면 전체의 상황·관계·감정 흐름과 일관돼야 한다. 앞뒤 대사와 전체 맥락을 모두 근거로 삼아라. "
    "(3) 짧게 — 보통 1~2문장. 장면을 늘어뜨리지 않는다. "
    "(4) 자연스러운 한국어 구어체. 10~20대 인물에 어울리게. "
    "(5) 100% 창작 — 기존 희곡·영화·드라마의 실제 대사를 복제하지 않는다. "
    "(6) 입시장에 적절하게 — 과도한 욕설·성적·폭력 표현 금지."
)


def _scene_user_prompt(turns, partner_hint: str, situation: str = "") -> str:
    lines, empty = [], 0
    for t in turns:
        if t.get("speaker") == "상대":
            txt = (t.get("text") or "").strip()
            if txt:
                lines.append(f"상대: {txt}")   # 학생이 직접 쓴 대사(고정 — 바꾸지 말 것)
            else:
                empty += 1
                h = (t.get("hint") or "").strip()
                lines.append(f"[상대 대사 #{empty}] ← 이 빈 자리를 채워라" + (f" (힌트: {h})" if h else ""))
        else:
            lines.append(f"나: {(t.get('text') or '').strip()}")
    seq = "\n".join(lines)
    ctx = ""
    if (situation or "").strip():
        ctx += f"\n■ 장면 상황(가장 중요 — 이 맥락에 반드시 맞춰라): {situation.strip()}"
    if (partner_hint or "").strip():
        ctx += f"\n■ 상대 인물 설정: {partner_hint.strip()}"
    who = (ctx + "\n") if ctx else "\n"
    if empty == 0:
        fill_instr = '채울 빈 자리는 없다. partner는 빈 배열 []로 두고, 상대 인물에 맞는 voice_id·gender·age만 반환하라.'
        json_fmt = '{"partner": [], "gender": "남|여|중성", "age": "young|middle|old", "voice_id": "위 목록의 id"}'
    else:
        fill_instr = ('[상대 대사 #1]부터 순서대로 그 빈 자리들만 채워라. 이미 "상대: ..."로 적힌 대사는 학생이 직접 쓴 것이니 '
                      '절대 바꾸지 말고 맥락으로만 활용하라. partner 배열 길이 = 빈 자리 개수와 정확히 일치.')
        json_fmt = '{"partner": ["#1 자리 대사", ...], "gender": "남|여|중성", "age": "young|middle|old", "voice_id": "위 목록의 id"}'
    return (
        "아래는 학생이 연기할 장면이다. '나:'=학생 고정 대사, '상대: ...'=학생이 직접 쓴 상대 대사(고정), "
        "[상대 대사 #n]=네가 채워야 할 빈 자리다. 장면 전체 맥락(상황·관계·감정 흐름)을 파악해, "
        "각 빈 자리를 바로 앞뒤 대사 및 이미 쓰인 상대 대사와 일관되게 채워라." + who + "\n"
        f"{seq}\n\n"
        f"상대 인물에 가장 어울리는 목소리를 아래 목록에서 하나 골라 voice_id로 반환하라(성별·나이·성격 특성 고려):\n"
        f"{catalog_prompt()}\n\n"
        f"{fill_instr} 반드시 아래 JSON만 출력하라:\n{json_fmt}\n"
        "gender=상대 성별(남/여/중성). age=나이대(young=10~30대 / middle=40~50대 / old=60대 이상). voice_id는 반드시 목록의 id."
    )


def _scene_fallback(turns) -> dict:
    return {"ok": False, "turns": turns, "message": "AI 상대역 생성이 아직 준비 중이에요. 잠시 후 다시 시도해주세요."}


def generate_scene_partner(turns, partner_hint: str = "", situation: str = "") -> dict:
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
        out, si = [], 0
        for t in turns:
            if t.get("speaker") == "상대":
                given = (t.get("text") or "").strip()
                if given:
                    out.append({"speaker": "상대", "text": given})       # 학생이 직접 쓴 대사 유지
                else:
                    out.append({"speaker": "상대", "text": pl[si] if si < len(pl) and pl[si] else "…"})
                    si += 1
            else:
                out.append({"speaker": "나", "text": (t.get("text") or "").strip()})
        return out

    openai_key = (getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    gemini_key = (getattr(settings, "GEMINI_API_KEY", "") or "").strip()
    user = _scene_user_prompt(turns, partner_hint, situation)

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
            return {"ok": True, "turns": _apply(partner), "voice_gender": str(data.get("gender") or "중성").strip(), "voice_age": str(data.get("age") or "middle").strip().lower(), "voice_id": str(data.get("voice_id") or "").strip()}
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
            return {"ok": True, "turns": _apply(partner), "voice_gender": str(data.get("gender") or "중성").strip(), "voice_age": str(data.get("age") or "middle").strip().lower(), "voice_id": str(data.get("voice_id") or "").strip()}
        except Exception as e:
            log.warning(f"generate_scene_partner(gemini) failed: {e}")
            return _scene_fallback(turns)

    return _scene_fallback(turns)


# ── 보이스 카탈로그 (한국어 네이티브, TTS 합성 검증됨) ──────────────────────────
# GPT가 상대 인물 특성에 맞는 voice_id를 이 목록에서 고른다(AI 모드). 커스텀 모드는
# 성별×나이 매칭 중 랜덤. ElevenLabs 실패 시 OpenAI TTS 폴백.
_VOICE_CATALOG = [
    {"id": "Ir7oQcBXWiq4oFGROCfj", "gender": "남", "age": "young", "traits": "친근한 20대"},
    {"id": "3MTvEr8xCMCC2mL9ujrI", "gender": "남", "age": "young", "traits": "맑고 밝은 청년"},
    {"id": "gmRUMzXYROUiUpOrXA0z", "gender": "남", "age": "young", "traits": "깊은 저음의 청년"},
    {"id": "4JJwo477JUAx3HV0T7n7", "gender": "남", "age": "middle", "traits": "권위 있는 30대"},
    {"id": "CxErO97xpQgQXYmapDKX", "gender": "남", "age": "middle", "traits": "편안한 대화체"},
    {"id": "LS3HmRGCXV8wxCAhUbTt", "gender": "남", "age": "middle", "traits": "따뜻한 40대"},
    {"id": "UmYoqGlufKxhJ6NCx5Mv", "gender": "남", "age": "middle", "traits": "허스키한"},
    {"id": "FQ3MuLxZh0jHcZmA5vW1", "gender": "남", "age": "middle", "traits": "저음의 어둡고 위협적인"},
    {"id": "aQzFKIjVemqRAhfd9est", "gender": "남", "age": "middle", "traits": "깊은 베이스"},
    {"id": "5ON5Fnz24cnOozEQfGAm", "gender": "남", "age": "old", "traits": "인자한 할아버지"},
    {"id": "PLfpgtLkFW07fDYbUiRJ", "gender": "남", "age": "old", "traits": "괴팍한 노인"},
    {"id": "9AF5ESbG4ckj76tceOv8", "gender": "남", "age": "old", "traits": "노련하고 무게감 있는"},
    {"id": "uyVNoMrnUku1dZyVEXwD", "gender": "여", "age": "young", "traits": "맑은 젊은 여성"},
    {"id": "0oqpliV6dVSr9XomngOW", "gender": "여", "age": "young", "traits": "청량한"},
    {"id": "iWLjl1zCuqXRkW6494ve", "gender": "여", "age": "young", "traits": "발랄한"},
    {"id": "ZjAPD4f11zlnEnZpKDgo", "gender": "여", "age": "middle", "traits": "차분한 중년 여성"},
    {"id": "o2sPqaz4lRxUCRm2QqQK", "gender": "여", "age": "middle", "traits": "다정하고 친근한"},
    {"id": "8MwPLtBplylvbrksiBOC", "gender": "여", "age": "middle", "traits": "성숙한"},
    {"id": "6yp5xWNuHEXOVkwW5Ghz", "gender": "여", "age": "old", "traits": "정겨운 할머니"},
    {"id": "0IhKyLYnD1w7n6ZVziN1", "gender": "중성", "age": "middle", "traits": "차분한 중성적"},
]
_CATALOG_IDS = {v["id"] for v in _VOICE_CATALOG}
_FALLBACK_VOICE = "0IhKyLYnD1w7n6ZVziN1"  # Ohana
_OPENAI_VOICE = {"남": "onyx", "여": "nova", "중성": "alloy"}


def catalog_prompt() -> str:
    """GPT 프롬프트에 넣을 보이스 목록(voice_id : 특성)."""
    return "\n".join(f'- {v["id"]} : {v["gender"]}/{v["age"]}, {v["traits"]}' for v in _VOICE_CATALOG)


def _norm_gender(g: str) -> str:
    g = (g or "").strip()
    return g if g in ("남", "여", "중성") else "중성"


def _norm_age(a: str) -> str:
    a = (a or "").strip().lower()
    return a if a in ("young", "middle", "old") else "middle"


def pick_voice(gender: str, age: str, preferred_id: str = "") -> str:
    """GPT가 고른 voice_id가 카탈로그에 있으면 그걸, 아니면 성별×나이 매칭 중 랜덤(없으면 성별만/폴백)."""
    import random
    if preferred_id and preferred_id in _CATALOG_IDS:
        return preferred_id
    g, a = _norm_gender(gender), _norm_age(age)
    matches = [v["id"] for v in _VOICE_CATALOG if v["gender"] == g and v["age"] == a]
    if not matches:
        matches = [v["id"] for v in _VOICE_CATALOG if v["gender"] == g]
    return random.choice(matches) if matches else _FALLBACK_VOICE


def _elevenlabs_tts(text: str, voice_id: str, api_key: str):
    import logging, requests
    try:
        r = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
            json={"text": text[:800], "model_id": "eleven_multilingual_v2"},
            timeout=45,
        )
        if r.status_code == 200 and r.content[:1] != b"{":
            return r.content
        logging.getLogger(__name__).warning(f"elevenlabs tts {r.status_code}: {r.text[:120]}")
    except Exception as e:
        logging.getLogger(__name__).warning(f"elevenlabs tts error: {e}")
    return None


def synthesize_tts(text: str, voice_id: str = "", gender: str = "중성"):
    """상대 대사를 지정 voice_id(카탈로그)로 합성 → mp3 bytes. ElevenLabs 우선/OpenAI 폴백(gender)/None."""
    from app.config import settings
    import logging
    log = logging.getLogger(__name__)
    text = (text or "").strip()
    if not text:
        return None
    vid = voice_id if voice_id in _CATALOG_IDS else _FALLBACK_VOICE
    el_key = (getattr(settings, "ELEVENLABS_API_KEY", "") or "").strip()
    if el_key:
        audio = _elevenlabs_tts(text, vid, el_key)
        if audio:
            return audio
        # ElevenLabs 실패 → OpenAI 폴백
    openai_key = (getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            resp = client.audio.speech.create(
                model="gpt-4o-mini-tts", voice=_OPENAI_VOICE.get(_norm_gender(gender), "alloy"),
                input=text[:600], response_format="mp3",
            )
            return resp.read()
        except Exception as e:
            log.warning(f"openai tts failed: {e}")
    return None
