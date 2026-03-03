#!/bin/bash
# ============================================================
# SOL-ACT Academy — Initial Setup Script
# Clone 받은 후 최초 1회 실행
# Usage: bash scripts/setup.sh
# ============================================================

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}"
echo "╔══════════════════════════════════════╗"
echo "║       SOL-ACT 초기 설정 시작        ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Python 확인 ──
echo -e "${GREEN}[1/6] Python 확인...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python3가 설치되어 있지 않습니다. https://python.org 에서 설치하세요.${NC}"
    exit 1
fi
python3 --version

# ── 2. Node.js 확인 ──
echo -e "${GREEN}[2/6] Node.js 확인...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치하세요.${NC}"
    exit 1
fi
node --version

# ── 3. 프론트엔드 의존성 설치 ──
echo -e "${GREEN}[3/6] 프론트엔드 의존성 설치...${NC}"
npm install

# ── 4. 백엔드 의존성 설치 ──
echo -e "${GREEN}[4/6] 백엔드 의존성 설치...${NC}"
cd backend
pip3 install -r requirements.txt
cd ..

# ── 5. 백엔드 .env 생성 ──
echo -e "${GREEN}[5/6] 백엔드 환경변수 설정...${NC}"
if [ ! -f backend/.env ]; then
    SECRET=$(python3 -c "import os; print(os.urandom(32).hex())")
    cat > backend/.env << EOF
SECRET_KEY=${SECRET}
GEMINI_API_KEY=
EOF
    echo -e "  ${GREEN}✓ backend/.env 생성 완료 (SECRET_KEY 자동 생성)${NC}"
    echo -e "  ${YELLOW}→ Gemini AI를 사용하려면 backend/.env에 GEMINI_API_KEY를 설정하세요.${NC}"
else
    echo -e "  ${GREEN}✓ backend/.env 이미 존재${NC}"
fi

# ── 6. DB 초기화 + 시드 데이터 ──
echo -e "${GREEN}[6/6] 데이터베이스 초기화...${NC}"
cd backend
python3 -c "
from app.database import engine, Base
from app.models import *
Base.metadata.create_all(bind=engine)
print('  ✓ 테이블 생성 완료')
"

# 시드 데이터 삽입 (이미 있으면 스킵)
python3 -c "
from app.database import SessionLocal
from app.models.user import User
db = SessionLocal()
if db.query(User).count() == 0:
    db.close()
    import subprocess
    subprocess.run(['python3', 'seed_data.py'], check=True)
    print('  ✓ 시드 데이터 삽입 완료')
else:
    db.close()
    print('  ✓ 데이터 이미 존재 (스킵)')
"
cd ..

echo ""
echo -e "${YELLOW}╔══════════════════════════════════════╗"
echo "║         초기 설정 완료! 🎉          ║"
echo "╚══════════════════════════════════════╝${NC}"
echo ""
echo "서비스 실행: bash scripts/start.sh"
echo ""
