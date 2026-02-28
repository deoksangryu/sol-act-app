import React from 'react';
import { Notification } from '../types';

interface NotificationsProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkAllRead: () => void;
}

export const Notifications: React.FC<NotificationsProps> = ({ notifications, onClose, onMarkAllRead }) => {
  return (
    <div className="fixed top-16 left-4 right-4 md:absolute md:top-12 md:right-0 md:left-auto md:w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up shadow-slate-300 ring-1 ring-black/5">
      <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-bold text-slate-800 text-sm">알림 센터</h3>
        <div className="flex gap-2">
            <button onClick={onMarkAllRead} className="text-[10px] font-bold text-orange-500 hover:underline">모두 읽음</button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
      </div>
      <div className="max-h-[60vh] md:max-h-80 overflow-y-auto">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${notif.read ? 'opacity-60' : 'bg-orange-50/30'}`}
            >
              <div className="flex gap-3">
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${notif.read ? 'bg-slate-300' : 'bg-orange-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-snug break-keep">{notif.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(notif.date).toLocaleDateString()} {new Date(notif.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            새로운 알림이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};