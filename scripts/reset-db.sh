#!/bin/bash
# ============================================================
# SOL-ACT — 데이터베이스 초기화 스크립트
# 모든 데이터를 삭제하고 빈 DB로 시작합니다.
# Usage: bash scripts/reset-db.sh
# ============================================================

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}╔══════════════════════════════════════╗"
echo "║   데이터베이스 초기화 (전체 삭제)   ║"
echo "╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}경고: 모든 사용자, 수업, 과제, 포트폴리오 등 전체 데이터가 삭제됩니다.${NC}"
echo ""
read -p "계속하시겠습니까? (yes 입력): " confirm

if [ "$confirm" != "yes" ]; then
    echo "취소되었습니다."
    exit 0
fi

cd backend

# DB 파일 삭제
rm -f sol_act.db
echo -e "  ${GREEN}✓ 기존 DB 삭제${NC}"

# 새 DB 생성
python3 -c "
from app.database import engine, Base
from app.models import *
Base.metadata.create_all(bind=engine)
print('  ✓ 빈 DB 생성 완료')
" 2>&1 | grep -v "INFO\|trapped"

cd ..

echo ""
echo -e "${GREEN}데이터베이스 초기화 완료!${NC}"
echo ""
echo "원장 계정 생성: bash scripts/create-user.sh"
echo ""
