#!/bin/bash
# ============================================================
# SOL-ACT Academy — Service Stop Script
# 실행 중인 백엔드 + ngrok 프로세스를 종료합니다.
# Usage: bash scripts/stop.sh
# ============================================================

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}SOL-ACT 서비스 종료 중...${NC}"

# 백엔드 (uvicorn)
if lsof -i :8000 -t &> /dev/null; then
    kill $(lsof -i :8000 -t) 2>/dev/null
    echo -e "  ${GREEN}✓ 백엔드 서버 종료${NC}"
else
    echo -e "  백엔드 서버가 실행 중이 아닙니다."
fi

# ngrok
if pgrep -x ngrok &> /dev/null; then
    pkill ngrok
    echo -e "  ${GREEN}✓ ngrok 종료${NC}"
else
    echo -e "  ngrok이 실행 중이 아닙니다."
fi

echo -e "${GREEN}완료.${NC}"
