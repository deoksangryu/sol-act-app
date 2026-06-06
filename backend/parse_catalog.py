"""대사_통합카탈로그_엄격중복제거.md → backend/data/catalog_scripts.json (제시대사 시드 소스).

마크다운 5개 섹션 형식이 제각각이라 섹션별 파서를 둔다:
  §1 한예종 독백      : '### YYYY학년도 · 성별 (N편)' + 'N. [N일차] 텍스트'
  §2 한예종 2인대화   : '### YYYY학년도' + ```코드블록```(화자 줄분리/인라인 혼재, 첫줄 날짜헤더)
  §3 한예종 보고읽기  : '- **YYYY N일차 N타임** — 텍스트'
  §4 한예종 당일대사  : 'N. 텍스트' (여자 독백)
  §5 상명대 지정연기  : '### YYYY 전형 (N편)' + 'N. 텍스트(멀티라인·괄호지문·말미 학과라벨)'

출력 포맷은 기존 seed_practice.py가 읽는 {"meta":..., "pieces":[...]} 구조.
괄호 지문은 보존(학생 노출 시 라우터의 _PAREN이 제거). 학과/전형 말미 라벨은 대사에서 제거.
"""
import re
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD = os.path.join(ROOT, "대사_통합카탈로그_엄격중복제거.md")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "catalog_scripts.json")

raw = open(MD, encoding="utf-8").read()
lines = raw.split("\n")

pieces = []
seq = 0

def add(type_, text_or_script, *, gender=None, source, tags, title):
    global seq
    seq += 1
    if isinstance(text_or_script, list):
        script = text_or_script
        joined = " ".join(t["text"] for t in script)
    else:
        script = [{"speaker": "나", "text": text_or_script}]
        joined = text_or_script
    dur = max(15, min(90, round(len(joined) / 5)))
    pieces.append({
        "id": f"cat{seq:04d}",
        "title": title,
        "type": type_,
        "genre": None,
        "emotions": None,
        "characterAge": None,
        "characterGender": gender,
        "situation": None,
        "script": script,
        "direction": None,
        "durationSec": dur,
        "difficulty": None,
        "tags": tags,
        "active": True,
    })

# ── 텍스트 정리 헬퍼 ────────────────────────────────────────────────
DEPT_TAIL = re.compile(
    r"\s*(연극전공|영화영상전공|사진영상\s*\S*전공|사진영상\s*\S*학과|연기전공|뮤지컬전공)"
    r".*$"
)
REEXAM = re.compile(r"`?\[재출제:[^\]]*\]`?")
EXTRA_TAIL = re.compile(r"\s*(실기\s*고사|\[지정\s*연기\]|\[화술\]|사진\s*촬영\s*실기)\s*$")
SCHOOL_TAIL = re.compile(r"\s*(상명대학교|한국예술종합학교|한예종)[^\n]*?(기출문제|실기\s*고사|모집)\s*$")
LEAD_LABEL = re.compile(r"^\s*독백대사\s*")

def clean_line(t):
    t = REEXAM.sub("", t)
    t = SCHOOL_TAIL.sub("", t)
    t = DEPT_TAIL.sub("", t)
    for _ in range(3):
        t = EXTRA_TAIL.sub("", t)
    t = LEAD_LABEL.sub("", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t.strip()

# ── 섹션 순회 ──────────────────────────────────────────────────────
section = 0          # 1..5
subhead = ""         # 현재 ### 헤딩 원문
sub_year = ""
sub_gender = None
sub_track = ""       # 전형(수시/정시)

i = 0
N = len(lines)
counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

# 누적 중인 번호항목(§1,4,5)
pending = None       # {"buf": [...], "day": str|None}

def flush_pending():
    global pending
    if pending is None:
        return
    text = clean_line(" ".join(pending["buf"]).strip())
    if not text:
        pending = None
        return
    if section == 1:
        day = pending.get("day")
        tags = ["한예종", sub_year] + ([day] if day else [])
        add("독백", text, gender=sub_gender, source="한예종",
            tags=tags, title=f"[한예종] {sub_year}·{sub_gender or '무관'} 독백 {counts[1]+1}")
        counts[1] += 1
    elif section == 4:
        add("독백", text, gender="여", source="한예종",
            tags=["한예종", "당일대사", "여"], title=f"[한예종] 당일대사 여 {counts[4]+1}")
        counts[4] += 1
    elif section == 5:
        add("지정연기", text, gender=None, source="상명대",
            tags=["상명대", sub_year] + ([sub_track] if sub_track else []),
            title=f"[상명대] {sub_year} {sub_track} 지정연기 {counts[5]+1}")
        counts[5] += 1
    pending = None

ITEM = re.compile(r"^\s*(\d+)\.\s*(.*)$")
DAY = re.compile(r"^\[(\d+일차)\]\s*")
BULLET = re.compile(r"^-\s*\*\*(.+?)\*\*\s*[—–-]\s*(.*)$")

while i < N:
    ln = lines[i]
    s = ln.strip()

    # 섹션 헤딩
    m = re.match(r"^##\s+(\d)\.", ln)
    if m:
        flush_pending()
        section = int(m.group(1))
        subhead = ""
        i += 1
        continue

    # 서브헤딩
    if ln.startswith("### "):
        flush_pending()
        subhead = ln[4:].strip()
        sub_gender = "남" if "남" in subhead else ("여" if "여" in subhead else None)
        ym = re.search(r"(\d{4})학년도", subhead)
        sub_year = ym.group(1) if ym else ""
        sub_track = ""
        if "수시" in subhead:
            sub_track = "수시"
        elif "정시" in subhead:
            sub_track = "정시"
        i += 1
        continue

    if s == "---":
        flush_pending()
        i += 1
        continue

    # ── §2: 코드블록 2인대화 ──
    if section == 2 and s == "```":
        block = []
        i += 1
        while i < N and lines[i].strip() != "```":
            block.append(lines[i])
            i += 1
        i += 1  # closing fence
        # 화자 파싱
        turns = []
        cur = None
        BARE = {"가", "나", "A", "B", "a", "b", "남", "여", "다", "라"}
        INLINE = re.compile(r"^([가나다라ABab])\s{1,}(.+)$")
        for bl in block:
            t = bl.strip()
            if not t:
                continue
            if t in BARE:
                cur = {"speaker": t, "text": ""}
                turns.append(cur)
                continue
            im = INLINE.match(t)
            if im:
                cur = {"speaker": im.group(1), "text": clean_line(im.group(2))}
                turns.append(cur)
                continue
            # 연속/날짜헤더
            if cur is None:
                continue  # 첫 날짜헤더 skip
            cur["text"] = (cur["text"] + " " + t).strip()
        turns = [t for t in turns if t["text"].strip()]
        if len(turns) >= 2:
            for t in turns:
                t["text"] = clean_line(t["text"])
            add("2인대사", turns, gender=None, source="한예종",
                tags=["한예종", "2인대화", sub_year],
                title=f"[한예종] {sub_year} 2인대화 {counts[2]+1}")
            counts[2] += 1
        # turns<2(글쓰기 제시/지시문 블록)은 스킵
        continue

    # ── §3: 보고읽기 불릿 ──
    if section == 3:
        bm = BULLET.match(s)
        if bm:
            label = bm.group(1).strip()
            text = clean_line(bm.group(2))
            if text:
                add("보고읽기", text, gender=None, source="한예종",
                    tags=["한예종", "보고읽기", label],
                    title=f"[한예종] 보고읽기 {label}")
                counts[3] += 1
        i += 1
        continue

    # ── §1,4,5: 번호 항목 ──
    if section in (1, 4, 5):
        im = ITEM.match(ln)
        if im:
            flush_pending()
            body = im.group(2)
            day = None
            if section == 1:
                dm = DAY.match(body)
                if dm:
                    day = dm.group(1)
                    body = body[dm.end():]
            pending = {"buf": [body], "day": day}
            i += 1
            continue
        # 연속 라인(빈 줄/헤딩 아님)
        if pending is not None and s:
            pending["buf"].append(s)
        i += 1
        continue

    i += 1

flush_pending()

# ── 출력 ───────────────────────────────────────────────────────────
by_type = {}
for p in pieces:
    by_type[p["type"]] = by_type.get(p["type"], 0) + 1

meta = {
    "version": "2.0",
    "source": "대사_통합카탈로그_엄격중복제거.md (한예종+상명대 입시 기출)",
    "count": len(pieces),
    "stats": {"byType": by_type, "bySection": counts},
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"meta": meta, "pieces": pieces}, f, ensure_ascii=False, indent=2)

# ── 리포트 ─────────────────────────────────────────────────────────
print(f"총 {len(pieces)}편 → {OUT}")
print(f"섹션별: §1독백 {counts[1]} / §2-2인 {counts[2]} / §3보고읽기 {counts[3]} / §4당일대사 {counts[4]} / §5지정연기 {counts[5]}")
print(f"유형별: {by_type}")
print("\n── 샘플 ──")
def sample(idx):
    p = pieces[idx]
    sc = " / ".join(f"{t['speaker']}: {t['text'][:40]}" for t in p["script"][:2])
    print(f"  {p['id']} [{p['type']}] {p['title']}\n     {sc}")
for s_no in range(1, 6):
    for idx, p in enumerate(pieces):
        if (s_no == 1 and p["type"] == "독백" and "한예종" in p["title"]) or \
           (s_no == 2 and p["type"] == "2인대사") or \
           (s_no == 3 and p["type"] == "보고읽기") or \
           (s_no == 4 and "당일대사" in p["title"]) or \
           (s_no == 5 and p["type"] == "지정연기"):
            sample(idx)
            break
