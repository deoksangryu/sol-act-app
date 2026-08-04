#!/bin/bash
# ============================================================
# SOL-ACT 백엔드 — launchd 감독용 포그라운드 실행기
# launchd(LaunchAgent)가 이 스크립트를 감독한다. Postgres(5432) 준비를
# 기다린 뒤 uvicorn을 exec로 띄워, launchd가 uvicorn 프로세스를 직접
# 감독(KeepAlive로 크래시 시 자동 재시작)하게 한다.
# 수동 개발 실행은 기존 scripts/start.sh를 계속 쓰면 된다.
# ============================================================
cd "$(dirname "$0")/../backend" || exit 1

# ── Postgres(5432) 준비 대기 ── (로그인 직후 DB보다 먼저 떠서 크래시-루프 나는 레이스 방지)
for _ in $(seq 1 30); do
    if (exec 3<>/dev/tcp/127.0.0.1/5432) 2>/dev/null; then
        exec 3>&-   # 연결 닫기
        break
    fi
    sleep 1
done

# ── uvicorn 포그라운드 실행 (start.sh와 동일 플래그) ──
# exec: 셸을 uvicorn으로 대체 → launchd가 uvicorn을 직접 감독(정상 종료/재시작 신호 처리)
PY="venv/bin/python"
[ -x "$PY" ] || PY="python3"
exec "$PY" -m uvicorn app.main:app \
    --host 0.0.0.0 --port 8000 \
    --no-access-log --log-level warning \
    --limit-concurrency 256 --timeout-keep-alive 75
