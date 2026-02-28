
import React, { useState } from 'react';
import { User, ClassInfo, ChatMessage } from '../types';
import { Chat } from './Chat';
import { QnA } from './QnA';
import { Notices } from './Notices';

interface CommunityProps {
  user: User;
  classes: ClassInfo[];
  chatMessages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
  setClasses: (classes: ClassInfo[]) => void;
  allUsers: User[];
}

type CommunityTab = 'chat' | 'qna' | 'notices';

export const Community: React.FC<CommunityProps> = ({ user, classes, chatMessages, onSendMessage, setClasses, allUsers }) => {
  const [activeTab, setActiveTab] = useState<CommunityTab>('chat');

  const tabs: { id: CommunityTab; label: string; icon: string }[] = [
    { id: 'chat', label: '채팅', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { id: 'qna', label: '질의응답', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'notices', label: '공지사항', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-slate-100 shrink-0 bg-white rounded-t-2xl px-2 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="h-full">
            <Chat
              user={user}
              classes={classes}
              messages={chatMessages}
              onSendMessage={onSendMessage}
              setClasses={setClasses}
              allUsers={allUsers}
            />
          </div>
        )}

        {activeTab === 'qna' && (
          <div className="h-full overflow-y-auto p-4">
            <QnA user={user} />
          </div>
        )}

        {activeTab === 'notices' && (
          <div className="h-full overflow-y-auto p-4">
            <Notices user={user} />
          </div>
        )}
      </div>
    </div>
  );
};
