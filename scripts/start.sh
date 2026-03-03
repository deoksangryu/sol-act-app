#!/bin/bash
# ============================================================
# SOL-ACT Academy — Service Start Script
# 백엔드 서버를 실행하고 ngrok으로 외부 접속을 엽니다.
# Usage: bash scripts/start.sh
# ============================================================

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKEND_PORT=8000

echo -e "${YELLOW}"
echo "╔══════════════════════════════════════╗"
echo "║       SOL-ACT 서비스 시작           ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# ── 사전 확인 ──
if [ ! -f backend/.env ]; then
    echo -e "${RED}backend/.env가 없습니다. 먼저 setup.sh를 실행하세요.${NC}"
    echo "  bash scripts/setup.sh"
    exit 1
fi

# ── 기존 프로세스 정리 ──
echo -e "${GREEN}[1/3] 기존 프로세스 확인...${NC}"
if lsof -i :$BACKEND_PORT -t &> /dev/null; then
    echo -e "  ${YELLOW}포트 $BACKEND_PORT 사용 중 — 종료합니다.${NC}"
    kill $(lsof -i :$BACKEND_PORT -t) 2>/dev/null || true
    sleep 1
fi

# ── 백엔드 시작 ──
echo -e "${GREEN}[2/3] 백엔드 서버 시작 (포트 $BACKEND_PORT)...${NC}"
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
BACKEND_PID=$!
cd ..
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}백엔드 서버 시작 실패!${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ 백엔드 실행 중 (PID: $BACKEND_PID)${NC}"
echo -e "  ${CYAN}  로컬: http://localhost:$BACKEND_PORT${NC}"
echo -e "  ${CYAN}  API 문서: http://localhost:$BACKEND_PORT/docs${NC}"

# ── ngrok 시작 ──
echo -e "${GREEN}[3/3] ngrok 터널 시작...${NC}"
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}  ngrok이 설치되어 있지 않습니다.${NC}"
    echo -e "  ${CYAN}설치: https://ngrok.com/download${NC}"
    echo -e "  ${CYAN}또는: brew install ngrok (macOS)${NC}"
    echo ""
    echo -e "${GREEN}ngrok 없이 로컬에서만 접속 가능합니다.${NC}"
    echo -e "  백엔드: http://localhost:$BACKEND_PORT"
    echo -e "  프론트: npx vite (별도 터미널에서 실행)"
    echo ""
    echo -e "${YELLOW}종료: Ctrl+C${NC}"
    wait $BACKEND_PID
    exit 0
fi

ngrok http $BACKEND_PORT --log=stdout &
NGROK_PID=$!
sleep 3

# ngrok URL 가져오기
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for t in data.get('tunnels', []):
        if t.get('proto') == 'https':
            print(t['public_url'])
            break
except:
    pass
" 2>/dev/null)

echo ""
echo -e "${YELLOW}╔══════════════════════════════════════════════╗"
echo -e "║            SOL-ACT 서비스 실행 중!           ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}백엔드 (로컬):${NC}  http://localhost:$BACKEND_PORT"
echo -e "  ${CYAN}API 문서:${NC}       http://localhost:$BACKEND_PORT/docs"
if [ -n "$NGROK_URL" ]; then
    echo -e "  ${CYAN}백엔드 (외부):${NC}  $NGROK_URL"
    echo ""
    echo -e "  ${YELLOW}프론트엔드에서 이 URL을 사용하세요:${NC}"
    echo -e "  ${GREEN}VITE_API_URL=$NGROK_URL${NC}"
fi
echo ""
echo -e "${YELLOW}종료: Ctrl+C${NC}"
echo ""

# 종료 시 정리
cleanup() {
    echo ""
    echo -e "${YELLOW}서비스 종료 중...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $NGROK_PID 2>/dev/null || true
    echo -e "${GREEN}종료 완료.${NC}"
}
trap cleanup EXIT INT TERM

wait $BACKEND_PID
