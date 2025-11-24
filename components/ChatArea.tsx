'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface Message {
  id: string;
  text: string;
  uid: string;
  displayName: string;
  photoURL: string;
  timestamp: any;
  isEdited?: boolean;
  isGif?: boolean;
  gifUrl?: string;
}

interface Channel {
  id: string;
  name: string;
  type?: 'text' | 'voice' | 'dm';
  participants?: string[];
  bitrate?: number;
}

interface ChatAreaProps {
  currentUser: User;
  channel: Channel | null;
  usersMap: Record<string, any>;
}

export default function ChatArea({ currentUser, channel, usersMap }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    if (!channel || !db) return;

    // Mesajları dinle
    const q = query(
      collection(db, 'channels', channel.id, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // DM mesajlarında participants kontrolü
        if (channel.type === 'dm' && channel.participants) {
          if (!channel.participants.includes(data.uid)) {
            return;
          }
        }
        msgs.push({ id: doc.id, ...data } as Message);
      });
      setMessages(msgs);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [channel, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!channel || !messageText.trim() || !db) return;

    await addDoc(collection(db, 'channels', channel.id, 'messages'), {
      text: messageText.trim(),
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      email: currentUser.email,
      timestamp: serverTimestamp(),
      isEdited: false,
    });

    setMessageText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatText = (text: string) => {
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Code blocks
    formatted = formatted.replace(
      /```(\w+)?\n?([\s\S]*?)```/g,
      (m, lang, code) =>
        `<div class="code-wrapper"><div class="code-header">${lang || 'text'}</div><pre><code>${code}</code></pre></div>`
    );
    
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Links
    const linkRegex = /(https?:\/\/[^\s<]+)/g;
    formatted = formatted.replace(linkRegex, (match) => {
      const displayText = match.length > 35 ? match.substring(0, 35) + '...' : match;
      return `<a href="${match}" target="_blank" class="text-blue-400 hover:underline">${displayText}</a>`;
    });
    
    return formatted;
  };

  const getUserColor = (uid: string) => {
    let h = 0;
    for (let i = 0; i < uid.length; i++) {
      h = uid.charCodeAt(i) + ((h << 5) - h);
    }
    return `hsl(${Math.abs(h % 360)}, 70%, 75%)`;
  };

  if (!channel) {
    return (
      <div className="flex-1 flex flex-col bg-[#313338] items-center justify-center">
        <div className="text-center text-gray-400">
          <i className="fas fa-hashtag text-6xl mb-4 opacity-20"></i>
          <p>Bir kanal seçin</p>
        </div>
      </div>
    );
  }

  const channelDisplayName =
    channel.type === 'dm' && channel.participants
      ? usersMap[channel.participants.find((uid) => uid !== currentUser.uid) || '']?.displayName ||
        channel.name
      : channel.name;

  return (
    <div className="flex-1 flex flex-col bg-[#313338] relative min-w-0">
      {/* Header */}
      <div className="h-12 border-b border-[#26272d] flex items-center px-4 bg-[#313338] z-10 shadow-sm">
        <i className="fas fa-hashtag text-gray-400 mr-2"></i>
        <h3 className="font-bold text-white">{channelDisplayName}</h3>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 pb-4 pt-2 bg-[#313338]"
      >
        {messages.map((msg, index) => {
          const isMe = msg.uid === currentUser.uid;
          const prevMsg = messages[index - 1];
          const isConsecutive = prevMsg?.uid === msg.uid;
          const date = (msg.timestamp && typeof msg.timestamp.toDate === 'function') 
            ? msg.timestamp.toDate() 
            : new Date();
          const timeStr = date.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={msg.id}
              className={`flex w-full px-4 py-0.5 group hover:bg-[#2e3035]/80 ${
                isConsecutive ? '-mt-1.5' : 'mt-5'
              } ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex max-w-[85%] sm:max-w-[75%] ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {!isConsecutive && (
                  <img
                    src={msg.photoURL}
                    className={`w-10 h-10 rounded-full flex-shrink-0 object-cover shadow-sm ${
                      isMe ? 'ml-4' : 'mr-4'
                    }`}
                    alt={msg.displayName}
                  />
                )}
                <div className={`flex-1 min-w-0 ${isMe ? 'text-right' : 'text-left'}`}>
                  {!isConsecutive && (
                    <div
                      className={`flex items-baseline gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <span
                        className="font-medium hover:underline cursor-pointer text-base"
                        style={{ color: isMe ? '#fff' : getUserColor(msg.uid) }}
                      >
                        {msg.displayName}
                      </span>
                      <span className="text-xs text-gray-500 select-none">{timeStr}</span>
                    </div>
                  )}
                  <div
                    className="text-[#dbdee1] leading-relaxed whitespace-pre-wrap break-words msg-content text-[0.95rem]"
                    dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}
                  />
                  {msg.isEdited && (
                    <span className="text-[10px] text-gray-500 ml-1 italic">(düzenlendi)</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 pb-2 text-sm text-gray-400 flex items-center gap-2">
          <span>
            {typingUsers.length === 1
              ? `${typingUsers[0]} yazıyor...`
              : `${typingUsers.length} kişi yazıyor...`}
          </span>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-5 pt-1 bg-[#313338]">
        <div className="bg-[#383a40] rounded-lg px-4 py-2 flex items-end relative">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            rows={1}
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none resize-none max-h-32 py-2"
            placeholder="Mesaj gönder..."
          />
          <button
            onClick={handleSendMessage}
            className="ml-2 text-[#5865F2] hover:text-[#4752c4]"
            disabled={!messageText.trim()}
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

