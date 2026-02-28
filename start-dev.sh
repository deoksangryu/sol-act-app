#!/bin/bash

# Muse Academy 개발 환경 시작 스크립트

echo "🚀 Starting Muse Academy Development Environment"
echo "================================================"

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 백엔드 시작
echo -e "\n${BLUE}[1/3] Starting Backend (FastAPI)...${NC}"
cd backend
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating...${NC}"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# 백엔드 서버 백그라운드 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"

cd ..

# 2. 프론트엔드 시작
echo -e "\n${BLUE}[2/3] Starting Frontend (Vite)...${NC}"
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"

# 3. ngrok 터널 시작
echo -e "\n${BLUE}[3/3] Starting ngrok tunnels...${NC}"
ngrok start --all --config ngrok.yml &
NGROK_PID=$!
echo -e "${GREEN}✓ ngrok started (PID: $NGROK_PID)${NC}"

# 완료 메시지
echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}✓ Development environment started successfully!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}Frontend:${NC}  https://sol-manager.ngrok.app"
echo -e "${BLUE}Backend:${NC}   https://sol-backend.ngrok.dev"
echo -e "${BLUE}API Docs:${NC}  https://sol-backend.ngrok.dev/docs"
echo -e "${BLUE}ngrok UI:${NC}  http://localhost:4040"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Ctrl+C 핸들러
trap 'echo -e "\n${YELLOW}Stopping services...${NC}"; kill $BACKEND_PID $FRONTEND_PID $NGROK_PID 2>/dev/null; echo -e "${GREEN}All services stopped${NC}"; exit 0' INT

# 백그라운드 프로세스 대기
wait
