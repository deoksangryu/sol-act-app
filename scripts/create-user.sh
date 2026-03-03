#!/bin/bash
# ============================================================
# SOL-ACT — 사용자 계정 생성 스크립트
# Usage: bash scripts/create-user.sh
# ============================================================

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${YELLOW}SOL-ACT 사용자 계정 생성${NC}"
echo ""

# 역할 선택
echo -e "${CYAN}역할을 선택하세요:${NC}"
echo "  1) 원장 (director)"
echo "  2) 선생님 (teacher)"
echo "  3) 수강생 (student)"
read -p "선택 (1-3): " role_choice

case $role_choice in
    1) ROLE="director"; PREFIX="d" ;;
    2) ROLE="teacher"; PREFIX="t" ;;
    3) ROLE="student"; PREFIX="s" ;;
    *) echo -e "${RED}잘못된 선택입니다.${NC}"; exit 1 ;;
esac

# 이름 입력
read -p "이름: " NAME
if [ -z "$NAME" ]; then
    echo -e "${RED}이름을 입력해주세요.${NC}"; exit 1
fi

# 이메일(아이디) 입력
read -p "이메일(아이디): " EMAIL
if [ -z "$EMAIL" ]; then
    echo -e "${RED}이메일을 입력해주세요.${NC}"; exit 1
fi

# 비밀번호 입력
read -s -p "비밀번호 (8자 이상, 영문+숫자+특수문자): " PASSWORD
echo ""
if [ -z "$PASSWORD" ]; then
    echo -e "${RED}비밀번호를 입력해주세요.${NC}"; exit 1
fi

# 계정 생성
cd backend
python3 -c "
import sys
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.utils.auth import get_password_hash
from app.schemas.user import validate_password_rules
import uuid

db = SessionLocal()

# 이메일 중복 체크
existing = db.query(User).filter(User.email == '${EMAIL}').first()
if existing:
    print('\033[0;31m이미 존재하는 이메일입니다.\033[0m')
    db.close()
    sys.exit(1)

# 비밀번호 규칙 검증
try:
    validate_password_rules('${PASSWORD}')
except ValueError as e:
    print(f'\033[0;31m{e}\033[0m')
    db.close()
    sys.exit(1)

# 사용자 생성
user = User(
    id='${PREFIX}' + uuid.uuid4().hex[:7],
    name='${NAME}',
    email='${EMAIL}',
    hashed_password=get_password_hash('${PASSWORD}'),
    role=UserRole('${ROLE}'),
    avatar=f'https://api.dicebear.com/7.x/avataaars/svg?seed={uuid.uuid4().hex[:8]}'
)
db.add(user)
db.commit()
print(f'\033[0;32m계정 생성 완료!\033[0m')
print(f'  ID: {user.id}')
print(f'  이름: {user.name}')
print(f'  이메일: {user.email}')
print(f'  역할: {user.role.value}')
db.close()
" 2>&1 | grep -v "INFO\|trapped"
cd ..
