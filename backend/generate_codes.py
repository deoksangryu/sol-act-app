"""
인증코드 생성 스크립트
서버 PC에서 실행하여 회원가입용 인증코드를 생성합니다.

사용법:
  python generate_codes.py --role student --count 5
  python generate_codes.py --role teacher --count 2 --memo "3월 신규 강사"
  python generate_codes.py --list              # 전체 코드 목록
  python generate_codes.py --list --unused      # 미사용 코드만
"""
import argparse
import secrets
import string
import sys
import os

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.invite_code import InviteCode
from app.models.user import UserRole


def generate_code(length=8) -> str:
    """영문 대문자 + 숫자로 구성된 읽기 쉬운 코드 생성 (혼동 문자 제외)"""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # O/0, I/1 제외
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def create_codes(role: str, count: int, memo: str | None = None):
    db = SessionLocal()
    try:
        codes = []
        for _ in range(count):
            while True:
                code = generate_code()
                if not db.query(InviteCode).filter(InviteCode.code == code).first():
                    break
            invite = InviteCode(
                code=code,
                role=UserRole(role),
                memo=memo,
            )
            db.add(invite)
            codes.append(code)
        db.commit()

        role_label = "수강생" if role == "student" else "선생님"
        print(f"\n{'='*40}")
        print(f"  인증코드 {count}개 생성 완료 ({role_label})")
        if memo:
            print(f"  메모: {memo}")
        print(f"{'='*40}")
        for c in codes:
            print(f"  {c}")
        print(f"{'='*40}\n")
    finally:
        db.close()


def list_codes(unused_only: bool = False):
    db = SessionLocal()
    try:
        query = db.query(InviteCode).order_by(InviteCode.created_at.desc())
        if unused_only:
            query = query.filter(InviteCode.used == False)
        codes = query.all()

        if not codes:
            print("\n등록된 코드가 없습니다.\n")
            return

        print(f"\n{'코드':<12} {'역할':<8} {'상태':<8} {'사용자':<12} {'메모':<20} {'생성일'}")
        print("-" * 80)
        for c in codes:
            role_label = "수강생" if c.role == UserRole.STUDENT else "선생님"
            status = "사용됨" if c.used else "미사용"
            used_by = c.used_by or ""
            memo = c.memo or ""
            created = c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else ""
            print(f"  {c.code:<10} {role_label:<8} {status:<8} {used_by:<12} {memo:<20} {created}")
        print(f"\n총 {len(codes)}개\n")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SOL-ACT 인증코드 생성")
    parser.add_argument("--role", choices=["student", "teacher"], help="역할 (student 또는 teacher)")
    parser.add_argument("--count", type=int, default=1, help="생성 개수 (기본: 1)")
    parser.add_argument("--memo", type=str, default=None, help="메모 (선택)")
    parser.add_argument("--list", action="store_true", help="코드 목록 조회")
    parser.add_argument("--unused", action="store_true", help="미사용 코드만 (--list와 함께)")

    args = parser.parse_args()

    if args.list:
        list_codes(unused_only=args.unused)
    elif args.role:
        create_codes(args.role, args.count, args.memo)
    else:
        parser.print_help()
