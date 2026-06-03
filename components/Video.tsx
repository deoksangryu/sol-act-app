import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, PortfolioItem } from '../types';
import { portfolioApi, uploadApi, resolveFileUrl } from '../services/api';
import { useDataRefresh } from '../services/useWebSocket';
import { TOSS } from '../services/category';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, Tag,
  Cta, Empty, InfoBox, ChipSelect, Chevron,
} from './toss/kit';

const VIDEO_CATS = [
  { value: 'acting', label: '자유연기' },
  { value: 'monologue', label: '독백' },
  { value: 'musical', label: '뮤지컬 넘버' },
  { value: 'dance', label: '자유무용' },
  { value: 'basics', label: '발성 연습' },
];
const catLabel = (v: string) => VIDEO_CATS.find(c => c.value === v)?.label || v;

const PlayThumb: React.FC = () => (
  <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: TOSS.surf }}>
    <svg className="w-5 h-5" fill={TOSS.sub} viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
  </div>
);

export const Video: React.FC<{ user: User }> = ({ user }) => {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const data = await portfolioApi.list(isStaff ? undefined : { studentId: user.id });
      setItems(data);
    } catch (e: any) {
      toast.error(e.message || '영상을 불러오지 못했어요');
    }
  };
  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);
  useDataRefresh(['portfolios'], load);

  if (loading) return <Empty>불러오는 중…</Empty>;

  const open = openId ? items.find(i => i.id === openId) : null;
  if (open) return <VideoDetail item={open} user={user} isStaff={isStaff} onBack={() => setOpenId(null)} onReload={load} onDeleted={async () => { setOpenId(null); await load(); }} />;
  if (uploading) return <UploadScreen onBack={() => setUploading(false)} onDone={async () => { setUploading(false); await load(); }} />;

  // ── 선생님: 학생 영상 피드백 ──
  if (isStaff) {
    const pending = items.filter(v => (v.comments?.length ?? 0) === 0);
    const done = items.filter(v => (v.comments?.length ?? 0) > 0);
    return (
      <Screen>
        <BigTitle title={<>학생 영상에<br />피드백을 남겨요</>} />
        <Scroll className="px-1">
          <SectionLabel>피드백 기다리는 영상 {pending.length}개</SectionLabel>
          {[...pending, ...done].length === 0 ? <Empty>아직 올라온 영상이 없어요</Empty> : [...pending, ...done].map(v => (
            <ListRow key={v.id} left={<PlayThumb />} title={v.title}
              sub={`${v.studentName} · ${(v.date || '').slice(5, 10)}`}
              right={(v.comments?.length ?? 0) > 0 ? <Tag bg={TOSS.successBg} fg={TOSS.success}>완료</Tag> : <Tag bg={TOSS.warnBg} fg={TOSS.warn}>피드백 필요</Tag>}
              onClick={() => setOpenId(v.id)} />
          ))}
        </Scroll>
      </Screen>
    );
  }

  // ── 학생: 내 영상 + 업로드 ──
  return (
    <Screen>
      <BigTitle title={<>연습 영상을<br />{items.length}개 모았어요</>} />
      <Scroll className="px-1">
        <SectionLabel>내 연습 영상 {items.length}개</SectionLabel>
        {items.length === 0 ? <Empty>아직 올린 영상이 없어요</Empty> : items.map(v => (
          <ListRow key={v.id} left={<PlayThumb />} title={v.title}
            sub={`${catLabel(v.category)} · ${(v.date || '').slice(5, 10)}`}
            right={(v.comments?.length ?? 0) > 0 ? <Tag bg={TOSS.successBg} fg={TOSS.success}>피드백 완료</Tag> : <Tag bg={TOSS.warnBg} fg={TOSS.warn}>피드백 대기</Tag>}
            onClick={() => setOpenId(v.id)} />
        ))}
      </Scroll>
      <Cta onClick={() => setUploading(true)}>새 영상 올리기</Cta>
    </Screen>
  );
};

// 영상 상세 (플레이어 + 피드백)
const VideoDetail: React.FC<{ item: PortfolioItem; user: User; isStaff: boolean; onBack: () => void; onReload: () => Promise<void>; onDeleted: () => Promise<void> }> = ({ item, user, isStaff, onBack, onReload, onDeleted }) => {
  const [fb, setFb] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [desc, setDesc] = useState(item.description || '');
  const comments = item.comments || [];
  const isOwner = !isStaff && item.studentId === user.id;

  const send = async () => {
    if (!fb.trim()) return;
    setBusy(true);
    try {
      await portfolioApi.addComment(item.id, fb.trim());
      toast.success('피드백을 보냈어요');
      setFb('');
      await onReload();
    } catch (e: any) {
      toast.error(e.message || '보내지 못했어요');
    } finally { setBusy(false); }
  };
  const saveEdit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await portfolioApi.update(item.id, { title: title.trim(), description: desc.trim() });
      toast.success('수정했어요');
      setEditing(false);
      await onReload();
    } catch (e: any) { toast.error(e.message || '수정하지 못했어요'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('이 영상을 삭제할까요?')) return;
    try { await portfolioApi.delete(item.id); toast.success('삭제했어요'); await onDeleted(); }
    catch (e: any) { toast.error(e.message || '삭제하지 못했어요'); }
  };

  return (
    <Screen>
      <BackHeader title="영상" onBack={onBack} right={isOwner ? (
        <button onClick={() => setEditing(v => !v)} className="text-[13px] font-semibold text-toss-blue px-1">{editing ? '취소' : '수정'}</button>
      ) : undefined} />
      <Scroll>
        <div className="bg-black aspect-video flex items-center justify-center">
          {item.videoUrl
            ? <video src={resolveFileUrl(item.videoUrl)} controls playsInline className="w-full h-full" />
            : <svg className="w-11 h-11 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
        </div>
        <div className="px-1 pt-4">
          {editing ? (
            <div className="space-y-2">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-toss-blue" />
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="설명" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-toss-blue" />
              <button onClick={saveEdit} disabled={busy || !title.trim()} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white" style={{ background: TOSS.blue }}>저장하기</button>
            </div>
          ) : (
            <>
              <div className="text-[19px] font-bold text-toss-ink">{item.title}</div>
              <div className="text-[13px] text-toss-sub mt-1.5">{item.studentName} · {catLabel(item.category)} · {(item.date || '').slice(5, 10)}</div>
              {item.description && item.description !== item.title && (
                <div className="text-sm text-toss-ink leading-relaxed mt-3">{item.description}</div>
              )}
            </>
          )}

          <div className="h-px my-4" style={{ background: TOSS.line }} />
          <div className="text-[13px] font-medium text-toss-sub mb-2.5">강사 피드백 {comments.length}개</div>
          {comments.length === 0 && !isStaff && <InfoBox tone="warn">24시간 안에 피드백이 와요</InfoBox>}
          {comments.map(c => (
            <div key={c.id} className="rounded-xl p-3 mb-2 text-sm leading-relaxed" style={{ background: TOSS.surf }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-toss-ink">{c.authorName}</span>
                <span className="text-[11px] text-toss-faint">{(c.date || '').slice(5, 10)}</span>
              </div>
              {c.content}
            </div>
          ))}
          {isStaff && (
            <textarea value={fb} onChange={e => setFb(e.target.value)} placeholder="구체적으로 알려주세요" className="w-full min-h-[90px] mt-2 rounded-xl border border-slate-200 p-3 text-base outline-none focus:border-toss-blue resize-none" />
          )}
          {isOwner && !editing && (
            <button onClick={remove} className="mt-4 text-[13px] text-toss-warn font-medium">이 영상 삭제하기</button>
          )}
        </div>
      </Scroll>
      {isStaff && <Cta onClick={send} disabled={!fb.trim()} loading={busy}>피드백 보내기</Cta>}
    </Screen>
  );
};

// 영상 업로드
const UploadScreen: React.FC<{ onBack: () => void; onDone: () => Promise<void> }> = ({ onBack, onDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file || !cat || !title.trim()) return;
    setBusy(true);
    try {
      setPhase('업로드 중');
      const { url } = await uploadApi.upload(file, p => setProgress(p), 'portfolios', undefined, undefined,
        (ph, p) => { setPhase(ph === 'compressing' || ph === 'client_compressing' ? '영상 변환 중' : '업로드 중'); setProgress(p); });
      await portfolioApi.create({ title: title.trim(), description: desc.trim() || title.trim(), videoUrl: url, category: cat as any });
      toast.success('선생님께 알림이 갔어요');
      await onDone();
    } catch (e: any) {
      toast.error(e.message || '올리지 못했어요');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Screen>
      <BackHeader title="영상 올리기" onBack={onBack} />
      <Scroll className="px-1">
        <div className="text-[21px] font-bold leading-[1.4] text-toss-ink mt-2">어떤 연습<br />영상인가요?</div>

        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        <div onClick={() => fileRef.current?.click()} className="rounded-2xl h-28 mt-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
          style={{ background: file ? '#D9E6CC' : TOSS.surf }}>
          <svg className="w-7 h-7" fill="none" stroke={file ? TOSS.success : TOSS.faint} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={file ? 'M5 13l4 4L19 7' : 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'} /></svg>
          <span className="text-[13px]" style={{ color: file ? TOSS.success : TOSS.sub }}>{file ? file.name : '영상을 선택하세요'}</span>
        </div>

        <div className="text-[13px] font-medium text-toss-sub mt-4 mb-2">제목</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 자유연기 3차" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-toss-blue" />

        <div className="text-[13px] font-medium text-toss-sub mt-4 mb-2">설명 <span className="text-toss-faint font-normal">(선택)</span></div>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="예: 복식호흡 중점 연습" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-toss-blue" />

        <div className="text-[13px] font-medium text-toss-sub mt-4 mb-2">카테고리</div>
        <ChipSelect wrap options={VIDEO_CATS} value={cat} onChange={setCat} />

        {progress != null && (
          <div className="mt-4">
            <div className="text-[13px] text-toss-sub mb-1">{phase} {Math.round(progress)}%</div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: TOSS.surf }}>
              <div className="h-full" style={{ width: `${progress}%`, background: TOSS.blue }} />
            </div>
          </div>
        )}
      </Scroll>
      <Cta onClick={submit} disabled={!file || !cat || !title.trim()} loading={busy}>영상 올리기</Cta>
    </Screen>
  );
};
