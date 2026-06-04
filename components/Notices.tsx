import React, { useEffect, useState } from 'react';
import { User, UserRole, Notice, ClassInfo } from '../types';
import { noticeApi } from '../services/api';
import { useDataRefresh } from '../services/useWebSocket';
import { useAppData } from '../services/AppContext';
import { TOSS } from '../services/category';
import { BackHeader, ListRow, Cta, Tag, Empty, ListSkeleton, FlowTitle } from './toss/kit';
import toast from 'react-hot-toast';

// YYYY-MM-DD... → 2026.06.04
const fmtDate = (s: string) => (s || '').slice(0, 10).replace(/-/g, '.');

// 전체화면 오버레이 래퍼 — 모듈 레벨(재마운트로 입력 포커스 잃지 않도록)
const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#fff', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
    {children}
  </div>
);

/** 공지사항 — 헤더 확성기 진입(전체화면). 읽기는 전원, 작성/수정/삭제는 원장만. */
export const Notices: React.FC<{ user: User; onClose?: () => void }> = ({ user, onClose = () => {} }) => {
  const canWrite = user.role === UserRole.DIRECTOR;
  const { classes } = useAppData();
  const targetLabel = (n: Notice) => {
    const ids = n.targetClassIds || [];
    if (!ids.length) return '전체';
    const names = classes.filter(c => ids.includes(c.id)).map(c => c.name);
    return names.length ? names.join(', ') : `${ids.length}개 반`;
  };
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Notice | 'new' | null>(null);

  const load = async () => {
    try { setNotices(await noticeApi.list()); }
    catch (e: any) { toast.error(e.message || '공지를 불러오지 못했어요'); }
  };
  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);
  useDataRefresh(['notices'], load);

  // 작성/수정
  if (editing) return (
    <Overlay>
      <NoticeForm user={user} classes={classes} notice={editing === 'new' ? null : editing}
        onBack={() => setEditing(null)}
        onDone={async () => { setEditing(null); setOpenId(null); await load(); }} />
    </Overlay>
  );

  // 상세
  const open = openId ? notices.find(n => n.id === openId) : null;
  if (open) return (
    <Overlay>
      <BackHeader title="공지" onBack={() => setOpenId(null)} right={canWrite ? (
        <button onClick={() => setEditing(open)} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: TOSS.blue, padding: 4, cursor: 'pointer' }}>수정</button>
      ) : undefined} />
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 24px' }}>
        {open.important && <Tag bg={TOSS.warnBg} fg={TOSS.warn}>중요</Tag>}
        <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.34, letterSpacing: '-.02em', color: TOSS.ink, marginTop: open.important ? 10 : 0 }}>{open.title}</div>
        <div style={{ fontSize: 13, color: TOSS.sub, marginTop: 6 }}>{open.author} · 대상 {targetLabel(open)} · {fmtDate(open.date)}</div>
        <div style={{ fontSize: 15, lineHeight: 1.8, color: TOSS.ink, marginTop: 16, whiteSpace: 'pre-wrap' }}>{open.content}</div>
        {canWrite && (
          <button
            onClick={async () => {
              if (!window.confirm('이 공지를 삭제할까요?')) return;
              try { await noticeApi.delete(open.id); toast.success('삭제했어요'); setOpenId(null); await load(); }
              catch (e: any) { toast.error(e.message || '삭제하지 못했어요'); }
            }}
            style={{ background: 'none', border: 'none', padding: 0, marginTop: 24, fontSize: 13, fontWeight: 500, color: TOSS.warn, cursor: 'pointer' }}
          >이 공지 삭제하기</button>
        )}
      </div>
    </Overlay>
  );

  // 목록
  return (
    <Overlay>
      <BackHeader title="공지사항" onBack={onClose} right={canWrite ? (
        <button onClick={() => setEditing('new')} style={{ background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: TOSS.blue, padding: '4px 6px', cursor: 'pointer' }}>작성</button>
      ) : undefined} />
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? <ListSkeleton /> : notices.length === 0 ? <Empty>아직 공지사항이 없어요</Empty> : notices.map(n => (
          <ListRow
            key={n.id}
            left={
              <div style={{ width: 44, height: 44, borderRadius: 13, background: n.important ? TOSS.warnBg : TOSS.surf, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ti ti-speakerphone" style={{ fontSize: 21, color: n.important ? TOSS.warn : TOSS.sub }} />
              </div>
            }
            title={n.title}
            sub={`${targetLabel(n)} · ${fmtDate(n.date)}`}
            right={n.important ? <Tag bg={TOSS.warnBg} fg={TOSS.warn}>중요</Tag> : undefined}
            onClick={() => setOpenId(n.id)}
          />
        ))}
      </div>
    </Overlay>
  );
};

// 작성/수정 폼 (원장)
const chipStyle = (on: boolean): React.CSSProperties => ({ flexShrink: 0, background: on ? TOSS.ink : '#fff', border: `1px solid ${on ? TOSS.ink : TOSS.inputLine}`, borderRadius: 999, padding: '8px 13px', fontSize: 13, fontWeight: 500, color: on ? '#fff' : TOSS.sub, cursor: 'pointer' });

const NoticeForm: React.FC<{ user: User; classes: ClassInfo[]; notice: Notice | null; onBack: () => void; onDone: () => Promise<void> }> = ({ user, classes, notice, onBack, onDone }) => {
  const [title, setTitle] = useState(notice?.title || '');
  const [content, setContent] = useState(notice?.content || '');
  const [important, setImportant] = useState(notice?.important || false);
  const [selected, setSelected] = useState<string[]>(notice?.targetClassIds || []);  // [] = 전체
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    try {
      const payload = { title: title.trim(), content: content.trim(), important, targetClassIds: selected };
      if (notice) await noticeApi.update(notice.id, payload);
      else await noticeApi.create({ ...payload, author: user.name });
      toast.success(notice ? '수정했어요' : '공지를 올렸어요');
      await onDone();
    } catch (e: any) { toast.error(e.message || '저장하지 못했어요'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <BackHeader title={notice ? '공지 수정' : '새 공지'} onBack={onBack} />
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
        <FlowTitle pad="0">{notice ? <>공지를<br />수정해요</> : <>무엇을<br />알릴까요?</>}</FlowTitle>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 16, border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: '12px 13px', fontSize: 15, color: TOSS.ink, outline: 'none' }} />
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="공지 내용을 적어요"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, minHeight: 140, border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: 12, fontSize: 15, fontFamily: 'inherit', resize: 'none', color: TOSS.ink, outline: 'none' }} />

        {/* 받는 대상 — 전체 또는 반 다중 선택 */}
        <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, margin: '16px 0 8px' }}>받는 대상</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button onClick={() => setSelected([])} style={chipStyle(selected.length === 0)}>전체</button>
          {classes.map(c => {
            const on = selected.includes(c.id);
            return (
              <button key={c.id} onClick={() => setSelected(s => on ? s.filter(x => x !== c.id) : [...s, c.id])} style={chipStyle(on)}>{c.name}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: TOSS.sub, marginTop: 8 }}>{selected.length === 0 ? '전체 학생에게 알림이 가요' : `${selected.length}개 반 학생에게만 알림이 가요`}</div>

        <button onClick={() => setImportant(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <div style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${important ? TOSS.warn : TOSS.inputLine}`, background: important ? TOSS.warn : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {important && <i className="ti ti-check" style={{ fontSize: 14, color: '#fff' }} />}
          </div>
          <span style={{ fontSize: 14, color: TOSS.ink }}>중요 공지로 표시</span>
        </button>
      </div>
      <Cta onClick={submit} disabled={!title.trim() || !content.trim()} loading={busy}>{notice ? '수정 저장하기' : '공지 올리기'}</Cta>
    </>
  );
};
