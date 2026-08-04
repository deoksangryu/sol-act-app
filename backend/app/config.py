import os
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "SOL-ACT API"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database (SQLite by default — no installation needed)
    DATABASE_URL: str = "sqlite:///./sol_act.db"

    # JWT Authentication
    SECRET_KEY: str = os.environ.get("SECRET_KEY", os.urandom(32).hex())
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7일(모바일 세션). env로 override 가능. 학생 개인정보 앱이라 과거 60일은 보안상 축소.

    # AI (둘 중 하나만 넣으면 됨 — OpenAI 우선, 없으면 Gemini)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"   # 저렴·충분. 원하면 gpt-4o 등으로 변경
    # OpenAI TTS(gpt-4o-mini-tts) 폴백 — 기본 OFF(비용 보호). ElevenLabs 실패 시 OpenAI로 합성하지 않고
    # None 반환 → 앱이 온디바이스 음성으로 폴백. 켜려면 .env에 OPENAI_TTS_FALLBACK=true.
    OPENAI_TTS_FALLBACK: bool = False
    GEMINI_API_KEY: str = ""
    # TTS: ElevenLabs(한국어 캐릭터 보이스 우수) 우선, 없으면 OpenAI TTS 폴백
    ELEVENLABS_API_KEY: str = ""

    # AWS S3 (Optional)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = "sol-act-files"

    # External SSD name (leave empty to use local storage)
    EXTERNAL_DRIVE_NAME: str = ""

    # Admin dashboard password — 반드시 .env(미추적)의 ADMIN_PASSWORD로 주입. 코드 하드코딩 금지(유출 위험).
    ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "change_me_in_env")

    # Redis (Optional)
    REDIS_URL: str = "redis://localhost:6379"

    # Web Push (VAPID)
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "mailto:admin@sol-manager.com"

    # Native Push — 미설정 시 자동으로 비활성(앱은 정상 구동, 웹푸시/실시간만 동작)
    # Android: Firebase 서비스계정 JSON 경로
    FCM_CREDENTIALS_FILE: str = ""
    # iOS: Apple APNs 키(.p8) — 직접 발송용
    APNS_KEY_FILE: str = ""
    APNS_KEY_ID: str = ""
    APNS_TEAM_ID: str = ""
    APNS_BUNDLE_ID: str = "com.solact.academy"
    APNS_USE_SANDBOX: bool = False  # 개발 빌드는 True (api.sandbox.push.apple.com)

    # CORS — localhost origins only active when DEBUG=True
    CORS_ORIGINS: List[str] = [
        "https://sol-manager.com",
        "https://www.sol-manager.com",
    ]

    @property
    def effective_cors_origins(self) -> List[str]:
        origins = list(self.CORS_ORIGINS)
        if self.DEBUG:
            origins.extend([
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:5173",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://127.0.0.1:5173",
            ])
        return origins

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
