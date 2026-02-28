
import React, { useState } from 'react';
import { User, ClassInfo, UserRole, Subject, SUBJECT_LABELS } from '../types';
import toast from 'react-hot-toast';

interface ClassesProps {
  user: User;
  classes: ClassInfo[];
  setClasses: (classes: ClassInfo[]) => void;
  allUsers: User[];
}

export const Classes: React.FC<ClassesProps> = ({ user, classes, setClasses, allUsers }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [subjectTeachers, setSubjectTeachers] = useState<Partial<Record<Subject, string>>>({});

  if (user.role === UserRole.STUDENT) {
    return <div className="p-4 text-center text-slate-500">접근 권한이 없습니다.</div>;
  }

  // Teacher sees their own classes, Director sees all
  const displayedClasses = user.role === UserRole.DIRECTOR
      ? classes
      : classes.filter(c => Object.values(c.subjectTeachers).includes(user.id));

  const students = allUsers.filter(u => u.role === UserRole.STUDENT);
  const teachers = allUsers.filter(u => u.role === UserRole.TEACHER);

  const handleOpenModal = (cls?: ClassInfo) => {
    if (cls) {
      setEditingClass(cls);
      setName(cls.name);
      setDescription(cls.description);
      setSchedule(cls.schedule);
      setSelectedStudentIds(cls.studentIds);
      setSubjectTeachers(cls.subjectTeachers || {});
    } else {
      setEditingClass(null);
      setName('');
      setDescription('');
      setSchedule('');
      setSelectedStudentIds([]);
      setSubjectTeachers({});
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (editingClass) {
      // Edit
      const updated: ClassInfo = {
        ...editingClass,
        name,
        description,
        schedule,
        subjectTeachers,
        studentIds: selectedStudentIds
      };
      setClasses(classes.map(c => c.id === editingClass.id ? updated : c));
      toast.success('클래스가 수정되었습니다.');
    } else {
      // Create
      const newClass: ClassInfo = {
        id: Date.now().toString(),
        name,
        description,
        schedule,
        subjectTeachers,
        studentIds: selectedStudentIds
      };
      setClasses([...classes, newClass]);
      toast.success('새 클래스가 생성되었습니다.');
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('정말로 이 클래스를 삭제하시겠습니까?')) {
      setClasses(classes.filter(c => c.id !== id));
      toast.success('클래스가 삭제되었습니다.');
    }
  };

  const toggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(prev => prev.filter(sid => sid !== id));
    } else {
      setSelectedStudentIds(prev => [...prev, id]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">클래스 관리</h2>
           <p className="text-sm text-slate-500">수업 일정과 수강생을 관리하세요.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          새 클래스
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedClasses.map(cls => (
          <div key={cls.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group relative">
             <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleOpenModal(cls)}
                  className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button 
                  onClick={() => handleDelete(cls.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
             </div>

             <div className="mb-4">
                <span className="inline-block px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded mb-2">
                  {cls.schedule || '일정 미정'}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
             <button 
               onClick={() => setIsModalOpen(false)}
               className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>

             <h3 className="text-xl font-bold text-slate-800 mb-6">
               {editingClass ? '클래스 수정' : '새 클래스 등록'}
             </h3>

             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">클래스 이름</label>
                   <input 
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500 transition-colors"
                     placeholder="예: 입시 A반"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">수업 시간</label>
                   <input 
                     value={schedule}
                     onChange={(e) => setSchedule(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500 transition-colors"
                     placeholder="예: 월/수/금 18:00"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">설명</label>
                   <textarea 
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500 transition-colors resize-none h-20"
                     placeholder="클래스에 대한 설명을 입력하세요."
                   />
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
                           className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-orange-500 transition-colors"
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
                   <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                     {students.map(s => (
                       <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                          <input 
                            type="checkbox" 
                            checked={selectedStudentIds.includes(s.id)}
                            onChange={() => toggleStudent(s.id)}
                            className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500 border-gray-300"
                          />
                          <img src={s.avatar} alt={s.name} className="w-8 h-8 rounded-full bg-slate-200" />
                          <span className="text-sm font-medium text-slate-700">{s.name}</span>
                       </label>
                     ))}
                   </div>
                </div>

                <button 
                  onClick={handleSave}
                  className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 mt-4"
                >
                  저장하기
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
