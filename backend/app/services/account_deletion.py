"""사용자 계정 완전삭제 — 앱스토어/구글플레이 '인앱 계정 삭제' 요건 + 개인정보법(PIPA/GDPR) 삭제권.

users.id를 참조하는 44개 FK를 FK 안전순으로 처리:
- 주체 데이터(본인 소유·작성)는 삭제
- nullable 스태프 참조(lessons.teacher_id·exam.created_by·music_tracks.created_by 등)는 NULL로
  두어 학원 공용기록(수업·시험일정·음원)은 보존하되 삭제된 사용자만 떼어낸다.
파일(외장SSD/로컬 uploads/*/user_id/)도 함께 제거. 커밋은 호출자 책임.
검증: 롤백 트랜잭션으로 전 문장 유효성·FK순서 확인 완료(2026-07-22).
"""
import logging
import shutil
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.file_upload import UPLOAD_DIR

logger = logging.getLogger(__name__)

# FK 안전순(손자→자식→주체→사용자). :uid 파라미터.
_PURGE_SQL = [
    # 손자: 내 콘텐츠를 참조하는 것 먼저
    "DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE author_id=:uid)",
    "DELETE FROM audition_checklists WHERE audition_id IN (SELECT id FROM auditions WHERE creator_id=:uid)",
    "DELETE FROM plan_items WHERE plan_id IN (SELECT id FROM plans WHERE student_id=:uid)",
    "DELETE FROM lesson_journal_comments WHERE author_id=:uid OR journal_id IN (SELECT id FROM lesson_journals WHERE author_id=:uid)",
    "DELETE FROM portfolio_attachments WHERE portfolio_id IN (SELECT id FROM portfolios WHERE student_id=:uid)",
    "DELETE FROM portfolio_videos WHERE portfolio_id IN (SELECT id FROM portfolios WHERE student_id=:uid)",
    "DELETE FROM portfolio_comments WHERE author_id=:uid OR portfolio_id IN (SELECT id FROM portfolios WHERE student_id=:uid)",
    "DELETE FROM routine_completions WHERE student_id=:uid",
    # 주체 데이터
    "DELETE FROM attendances WHERE student_id=:uid OR marked_by=:uid",
    "DELETE FROM evaluations WHERE student_id=:uid OR evaluator_id=:uid",
    "DELETE FROM lesson_journals WHERE author_id=:uid",
    "DELETE FROM questions WHERE author_id=:uid",
    "DELETE FROM auditions WHERE creator_id=:uid",
    "DELETE FROM plans WHERE student_id=:uid",
    "DELETE FROM assignments WHERE student_id=:uid",
    "UPDATE assignments SET assigned_by=NULL WHERE assigned_by=:uid",
    "DELETE FROM submissions WHERE student_id=:uid",
    "UPDATE submissions SET teacher_id=NULL WHERE teacher_id=:uid",
    "DELETE FROM private_lesson_requests WHERE student_id=:uid OR teacher_id=:uid",
    "DELETE FROM routine_items WHERE student_id=:uid",
    "DELETE FROM exchange_orders WHERE student_id=:uid",
    "DELETE FROM music_download_requests WHERE student_id=:uid",
    "DELETE FROM quiz_answers WHERE student_id=:uid",
    "DELETE FROM practice_draws WHERE student_id=:uid",
    "DELETE FROM practice_requests WHERE student_id=:uid",
    "DELETE FROM practice_sessions WHERE student_id=:uid",
    "DELETE FROM practice_journals WHERE student_id=:uid",
    "DELETE FROM diet_logs WHERE student_id=:uid",
    "DELETE FROM weight_logs WHERE student_id=:uid",
    "DELETE FROM chat_messages WHERE sender_id=:uid",
    "DELETE FROM chat_read_status WHERE user_id=:uid",
    "DELETE FROM praise_stickers WHERE sender_id=:uid OR recipient_id=:uid",
    "DELETE FROM portfolios WHERE student_id=:uid",
    "DELETE FROM user_badges WHERE student_id=:uid",
    "UPDATE user_badges SET granted_by=NULL WHERE granted_by=:uid",
    "DELETE FROM point_ledger WHERE student_id=:uid",
    "DELETE FROM streaks WHERE student_id=:uid",
    "DELETE FROM user_activity WHERE student_id=:uid",
    "DELETE FROM notifications WHERE user_id=:uid",
    "DELETE FROM device_tokens WHERE user_id=:uid",
    "DELETE FROM push_subscriptions WHERE user_id=:uid",
    "DELETE FROM class_students WHERE student_id=:uid",
    # 학원 공용기록 보존(삭제된 사용자만 떼어냄)
    "UPDATE lessons SET teacher_id=NULL WHERE teacher_id=:uid",
    "UPDATE exam_schedules SET created_by=NULL WHERE created_by=:uid",
    "UPDATE music_tracks SET created_by=NULL WHERE created_by=:uid",
    # 마지막: 사용자
    "DELETE FROM users WHERE id=:uid",
]


def purge_user_data(db: Session, uid: str) -> None:
    """사용자와 연관 데이터 전부 삭제(FK 안전순). 커밋은 호출자. 파일은 별도(purge_user_files)."""
    for stmt in _PURGE_SQL:
        db.execute(text(stmt), {"uid": uid})


def purge_user_files(uid: str) -> None:
    """사용자 업로드 파일 폴더(uploads/*/user_id/) 삭제 — 실패해도 삭제 흐름을 막지 않음."""
    try:
        base = Path(UPLOAD_DIR)
        for sub in base.iterdir() if base.exists() else []:
            d = sub / uid
            if d.is_dir():
                shutil.rmtree(d, ignore_errors=True)
            meta = sub / f"._{uid}"  # macOS 메타
            if meta.exists():
                meta.unlink(missing_ok=True)
    except Exception as e:
        logger.warning(f"Failed to purge files for {uid}: {e}")
