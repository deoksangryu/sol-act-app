import json
import re
import google.generativeai as genai
from app.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")


def analyze_diet(description: str, image_base64: str = None) -> dict:
    prompt = (
        f'다음 식사를 분석해주세요. 연기 학생의 에너지와 보컬 건강 유지에 초점을 맞춰주세요.\n'
        f'식사 설명: "{description}"\n'
        f'{"식사 이미지도 함께 제공됩니다." if image_base64 else ""}\n\n'
        f'다음 JSON 형식으로만 응답해주세요 (마크다운 없이):\n'
        f'{{"calories": 숫자, "advice": "한국어 영양 조언 (2문장 이내)"}}'
    )
    try:
        parts = [prompt]
        if image_base64:
            match = re.match(r"^data:(.+);base64,(.+)$", image_base64, re.DOTALL)
            if match:
                mime_type, data = match.groups()
                parts.append({"mime_type": mime_type, "data": data})

        response = model.generate_content(parts)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(text)
    except Exception as e:
        print(f"Diet analysis error: {e}")
        return {"calories": 0, "advice": "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."}


def analyze_monologue(text: str) -> str:
    prompt = (
        f'당신은 전문 연기 코치입니다. 학생이 제출한 다음 독백/대사를 분석해주세요.\n'
        f'대사: "{text}"\n\n'
        f'다음 항목에 대해 한국어로 피드백을 제공해주세요:\n'
        f'1. 감정선 (emotional subtext)\n'
        f'2. 호흡 및 어조 (pacing and tone)\n'
        f'3. 개선을 위한 건설적인 팁\n\n'
        f'격려적이고, 전문적이며, 따뜻한 톤으로 작성해주세요. 최대 200자.'
    )
    try:
        response = model.generate_content(prompt)
        return response.text or "분석 결과를 가져올 수 없습니다."
    except Exception as e:
        print(f"Monologue analysis error: {e}")
        return "AI 분석 중 오류가 발생했습니다."


def ask_ai_tutor(question: str) -> str:
    prompt = (
        f'당신은 연기 학원의 친절하고 지식이 풍부한 멘토 선생님입니다.\n'
        f'학생이 다음 질문을 했습니다:\n'
        f'"{question}"\n\n'
        f'한국어로 도움이 되고, 격려적이며, 실용적인 답변을 해주세요.\n'
        f'연기 기법에 대한 질문이면 구체적인 예시를 들어주세요.\n'
        f'진로나 불안에 대한 질문이면 따뜻하게 지지해주세요.\n'
        f'간결하지만(300자 이내) 유익하게 답변해주세요.'
    )
    try:
        response = model.generate_content(prompt)
        return response.text or "답변을 생성할 수 없습니다."
    except Exception as e:
        print(f"AI tutor error: {e}")
        return "AI 튜터 연결에 실패했습니다."


def generate_journal_feedback(content: str, journal_type: str) -> str:
    if journal_type == "teacher":
        role_prompt = "교사의 수업일지입니다. 수업 구성의 효과성, 학생 참여 유도 방법, 개선 포인트를 제안해주세요."
    else:
        role_prompt = "학생의 수업 회고입니다. 자기 성찰을 격려하고, 구체적인 다음 목표를 제안해주세요."

    prompt = (
        f'당신은 연기 학원의 교육 전문가입니다.\n'
        f'{role_prompt}\n\n'
        f'수업일지 내용:\n"{content}"\n\n'
        f'한국어로 따뜻하고 건설적인 피드백을 200자 이내로 작성해주세요.'
    )
    try:
        response = model.generate_content(prompt)
        return response.text or "피드백을 생성할 수 없습니다."
    except Exception as e:
        print(f"Journal feedback error: {e}")
        return "AI 피드백 생성 중 오류가 발생했습니다."


def generate_evaluation_summary(evaluations_data: str) -> str:
    prompt = (
        f'당신은 연기 학원의 교육 전문가입니다. 다음 학생 평가 데이터를 종합 분석하여 성장 리포트를 작성해주세요.\n\n'
        f'평가 데이터:\n{evaluations_data}\n\n'
        f'다음 항목을 포함하여 한국어로 작성해주세요:\n'
        f'1. 강점 분석\n'
        f'2. 개선이 필요한 영역\n'
        f'3. 성장 추이 (점수 변화가 있는 경우)\n'
        f'4. 추천 학습 방향\n\n'
        f'따뜻하고 격려적인 톤으로 300자 이내로 작성해주세요.'
    )
    try:
        response = model.generate_content(prompt)
        return response.text or "리포트를 생성할 수 없습니다."
    except Exception as e:
        print(f"Evaluation summary error: {e}")
        return "AI 리포트 생성 중 오류가 발생했습니다."


def analyze_portfolio(title: str, description: str, category: str) -> str:
    prompt = (
        f'당신은 전문 연기 코치입니다. 학생의 연습 영상 포트폴리오에 대해 피드백을 제공해주세요.\n\n'
        f'제목: {title}\n'
        f'카테고리: {category}\n'
        f'설명: {description}\n\n'
        f'카테고리에 맞는 구체적인 연기 피드백을 한국어로 200자 이내로 작성해주세요.\n'
        f'격려적이고 실용적인 조언을 포함해주세요.'
    )
    try:
        response = model.generate_content(prompt)
        return response.text or "피드백을 생성할 수 없습니다."
    except Exception as e:
        print(f"Portfolio analysis error: {e}")
        return "AI 피드백 생성 중 오류가 발생했습니다."


def generate_audition_tips(title: str, description: str, audition_type: str) -> str:
    prompt = (
        f'당신은 연기 오디션 전문 코치입니다. 다음 오디션/일정에 대한 준비 팁을 제공해주세요.\n\n'
        f'제목: {title}\n'
        f'유형: {audition_type}\n'
        f'설명: {description}\n\n'
        f'한국어로 실용적인 준비 팁 3-5개를 작성해주세요.\n'
        f'각 팁은 구체적이고 실행 가능해야 합니다. 300자 이내.'
    )
    try:
        response = model.generate_content(prompt)
        return response.text or "팁을 생성할 수 없습니다."
    except Exception as e:
        print(f"Audition tips error: {e}")
        return "AI 팁 생성 중 오류가 발생했습니다."
