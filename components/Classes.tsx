
import React, { useState } from 'react';
import { User, ClassInfo, UserRole, Subject, SUBJECT_LABELS, ScheduleSlot } from '../types';
import { classApi } from '../services/api';
import toast from 'react-hot-toast';
import { ConfirmDialog } from './ConfirmDialog';

const DAY_OPTIONS = ['월', '화', '수', '목', '금', '토', '일'];

function formatSchedule(schedule: ScheduleSlot[] | string): string {
  if (typeof schedule === 'string') return schedule || '일정 미정';
  if (!Array.isArray(schedule) || schedule.length === 0) return '일정 미정';
  return schedule.map(s => `${s.day} ${s.startTime}~${s.endTime}`).join(' | ');
}

interface ClassesProps {
  user: User;
  classes: ClassInfo[];
  setClasses: (classes: ClassInfo[]) => void;
  allUsers: User[];
}

export const Classes: React.FC<ClassesProps> = ({ user, classes, setClasses, allUsers }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [subjectTeachers, setSubjectTeachers] = useState<Partial<Record<Subject, string>>>({});

  if (user.role === UserRole.STUDENT) {
    return <div className="p-4 text-center text-slate-500">접근 권한이 없습니다.</div>;
  }

  const isDirector = user.role === UserRole.DIRECTOR;

  // Teacher sees their own classes, Director sees all
  const displayedClasses = isDirector
      ? classes
      : classes.filter(c => Object.values(c.subjectTeachers).includes(user.id));

  const students = allUsers.filter(u => u.role === UserRole.STUDENT);
  const teachers = allUsers.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.DIRECTOR);

  const handleOpenModal = (cls?: ClassInfo) => {
    if (cls) {
      setEditingClass(cls);
      setName(cls.name);
      setDescription(cls.description);
      // Handle both legacy string and new array format
      if (Array.isArray(cls.schedule)) {
        setScheduleSlots(cls.schedule);
      } else {
        setScheduleSlots([]);
      }
      setSelectedStudentIds(cls.studentIds);
      setSubjectTeachers(cls.subjectTeachers || {});
    } else {
      setEditingClass(null);
      setName('');
      setDescription('');
      setScheduleSlots([]);
      setSelectedStudentIds([]);
      setSubjectTeachers({});
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingClass) {
        const updated = await classApi.update(editingClass.id, {
          name, description, schedule: scheduleSlots, subjectTeachers, studentIds: selectedStudentIds,
        });
        setClasses(classes.map(c => c.id === editingClass.id ? updated : c));
        toast.success('클래스가 수정되었습니다.');
      } else {
        const newClass = await classApi.create({
          name, description, schedule: scheduleSlots, subjectTeachers, studentIds: selectedStudentIds,
        });
        setClasses([...classes, newClass]);
        toast.success('새 클래스가 생성되었습니다.');
      }
      setIsModalOpen(false);
    } catch {
      toast.error('클래스 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const [deleteClassId, setDeleteClassId] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteClassId) return;
    try {
      await classApi.delete(deleteClassId);
      setClasses(classes.filter(c => c.id !== deleteClassId));
      toast.success('클래스가 삭제되었습니다.');
    } catch {
      toast.error('클래스 삭제에 실패했습니다.');
    }
    setDeleteClassId(null);
  };

  const toggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(prev => prev.filter(sid => sid !== id));
    } else {
      setSelectedStudentIds(prev => [...prev, id]);
    }
  };

  // Schedule slot helpers
  const addScheduleSlot = () => {
    setScheduleSlots(prev => [...prev, { day: '월', startTime: '18:00', endTime: '20:00' }]);
  };
  const removeScheduleSlot = (idx: number) => {
    setScheduleSlots(prev => prev.filter((_, i) => i !== idx));
  };
  const updateScheduleSlot = (idx: number, field: keyof ScheduleSlot, value: string) => {
    setScheduleSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">클래스 관리</h2>
           <p className="text-sm text-slate-500">수업 일정과 수강생을 관리하세요.</p>
        </div>
        {isDirector && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            새 클래스
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedClasses.map(cls => (
          <div key={cls.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group relative">
             {isDirector && (
               <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenModal(cls)}
                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button
                    onClick={() => setDeleteClassId(cls.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
               </div>
             )}

             <div className="mb-4">
                <span className="inline-block px-2 py-1 bg-brand-50 text-brand-600 text-[10px] font-bold rounded mb-2">
                  {formatSchedule(cls.schedule)}
                </span>
                <h3 className="text-xl font-bold text-slate-800">{cls.name}</h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2 min-h-[40px]">{cls.description}</p>
             </div>

             {Object.keys(cls.subjectTeachers || {}).length > 0 && (
               <div className="mb-3">
                 <p className="text-xs text-slate-400">
                   {Object.entries(cls.subjectTeachers).map(([subject, teacherId]) => {
                     const teacher = allUsers.find(u => u.id === teacherId);
                     return teacher ? `${SUBJECT_LABELS[subject as Subject]}: ${teacher.name}` : null;
                   }).filter(Boolean).join(' | ')}
                 </p>
               </div>
             )}

             <div className="pt-4 border-t border-slate-50">
               <p className="text-xs font-bold text-slate-400 mb-2">수강생 ({cls.studentIds.length})</p>
               <div className="flex -space-x-2 overflow-hidden">
                 {cls.studentIds.map(sid => {
                    const student = students.find(s => s.id === sid);
                    if (!student) return null;
                    return (
                      <img
                        key={sid}
                        className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-200"
                        src={student.avatar}
                        alt={student.name}
                        title={student.name}
                      />
                    );
                 })}
                 {cls.studentIds.length === 0 && <span className="text-xs text-slate-300">등록된 학생 없음</span>}
               </div>
             </div>
          </div>
        ))}

        {displayedClasses.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400">
                관리 중인 클래스가 없습니다.
            </div>
        )}
      </div>

      {/* Modal — full screen on mobile */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full md:rounded-3xl md:max-w-lg md:max-h-[90vh] h-full md:h-auto flex flex-col shadow-2xl relative">
             {/* Header */}
             <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-slate-100 shrink-0">
               <h3 className="text-xl font-bold text-slate-800">
                 {editingClass ? '클래스 수정' : '새 클래스 등록'}
               </h3>
               <button
                 onClick={() => setIsModalOpen(false)}
                 className="text-slate-400 hover:text-slate-600 p-2"
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             </div>

             {/* Scrollable Content */}
             <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">클래스 이름</label>
                   <input
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500 transition-colors"
                     placeholder="예: 입시 A반"
                   />
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">설명</label>
                   <textarea
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500 transition-colors resize-none h-20"
                     placeholder="클래스에 대한 설명을 입력하세요."
                   />
                </div>

                {/* Schedule — structured day+time picker */}
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-2">수업 일정</label>
                   <div className="space-y-2">
                     {scheduleSlots.map((slot, idx) => (
                       <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                         <select
                           value={slot.day}
                           onChange={(e) => updateScheduleSlot(idx, 'day', e.target.value)}
                           className="p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-brand-500 w-16 shrink-0"
                         >
                           {DAY_OPTIONS.map(d => (
                             <option key={d} value={d}>{d}</option>
                           ))}
                         </select>
                         <input
                           type="time"
                           value={slot.startTime}
                           onChange={(e) => updateScheduleSlot(idx, 'startTime', e.target.value)}
                           className="p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-brand-500 flex-1 min-w-0"
                         />
                         <span className="text-slate-400 text-sm shrink-0">~</span>
                         <input
                           type="time"
                           value={slot.endTime}
                           onChange={(e) => updateScheduleSlot(idx, 'endTime', e.target.value)}
                           className="p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-brand-500 flex-1 min-w-0"
                         />
                         <button
                           onClick={() => removeScheduleSlot(idx)}
                           className="p-1.5 text-slate-400 hover:text-red-500 shrink-0"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                       </div>
                     ))}
                   </div>
                   <button
                     onClick={addScheduleSlot}
                     className="mt-2 text-sm text-brand-500 hover:text-brand-600 font-bold flex items-center gap-1"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     일정 추가
                   </button>
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-2">과목별 담당 선생님</label>
                   <div className="space-y-2">
                     {Object.values(Subject).map(subject => (
                       <div key={subject} className="flex items-center gap-3">
                         <span className="text-sm text-slate-700 w-16 shrink-0">{SUBJECT_LABELS[subject]}</span>
                         <select
                           value={subjectTeachers[subject] || ''}
                           onChange={(e) => {
                             const val = e.target.value;
                             setSubjectTeachers(prev => {
                               const next = { ...prev };
                               if (val) {
                                 next[subject] = val;
                               } else {
                                 delete next[subject];
                               }
                               return next;
                             });
                           }}
                           className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-brand-500 transition-colors"
                         >
                           <option value="">미지정</option>
                           {teachers.map(t => (
                             <option key={t.id} value={t.id}>{t.name}</option>
                           ))}
                         </select>
                       </div>
                     ))}
                   </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-2">수강생 편집</label>
                   <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-52 overflow-y-auto space-y-1">
                     {students.length === 0 && (
                       <p className="text-sm text-slate-400 text-center py-2">등록된 수강생이 없습니다.</p>
                     )}
                     {students.map(s => (
                       <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(s.id)}
                            onChange={() => toggleStudent(s.id)}
                            className="w-5 h-5 text-brand-500 rounded focus:ring-brand-500 border-gray-300"
                          />
                          <img src={s.avatar} alt={s.name} className="w-8 h-8 rounded-full bg-slate-200" />
                          <span className="text-sm font-medium text-slate-700">{s.name}</span>
                       </label>
                     ))}
                   </div>
                </div>
             </div>

             {/* Sticky Save Button */}
             <div className="px-6 py-4 border-t border-slate-100 shrink-0 bg-white md:rounded-b-3xl" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-200 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장하기'}
                </button>
             </div>
          </div>
        </div>
      )}

      {deleteClassId && (
        <ConfirmDialog
          title="클래스 삭제"
          message="정말로 이 클래스를 삭제하시겠습니까? 소속 학생과 수업 데이터에 영향을 줄 수 있습니다."
          confirmLabel="삭제"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteClassId(null)}
        />
      )}
    </div>
  );
};
