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
  getDocs,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db, ADMIN_EMAIL } from '@/lib/firebase/config';
import EmojiPicker from './EmojiPicker';
import GifModal from './GifModal';
import Toast from './Toast';
import LinkModal from './LinkModal';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';

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
  mentions?: string[]; // Mention edilen kullanıcı UID'leri
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

interface TypingUser {
  uid: string;
  name: string;
  photoURL: string;
}

export default function ChatArea({ currentUser, channel, usersMap }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifModal, setShowGifModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const { settings, updateLastReadMessage, getChannelNotificationLevel } = useNotificationSettings(currentUser);
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    message: Message | null;
  }>({ show: false, x: 0, y: 0, message: null });
  const [editModal, setEditModal] = useState<{ show: boolean; message: Message | null; text: string }>({
    show: false,
    message: null,
    text: '',
  });
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; message: Message | null; isStack: boolean }>({
    show: false,
    message: null,
    isStack: false,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const notifySoundRef = useRef<HTMLAudioElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingStatusRef = useRef<any>(null);
  const typingUnsubscribeRef = useRef<(() => void) | null>(null);

  // Ses bildirimi için audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      notifySoundRef.current = new Audio('/notification.mp3');
      notifySoundRef.current.preload = 'auto';
    }
  }, []);

  const scrollToBottom = useCallback((instant = false) => {
    if (instant) {
      // Anında scroll (animasyon yok)
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else {
      // Yumuşak scroll (sadece kullanıcı scroll yapmışsa)
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, []);

  // Mesajları dinle
  useEffect(() => {
    if (!channel || !db) return;

    const q = query(
      collection(db, 'channels', channel.id, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      let wasAtBottom = false;
      const previousMessageCount = messages.length;
      
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        const threshold = 150; // Biraz daha fazla tolerans
        wasAtBottom =
          container.scrollHeight - container.scrollTop <= container.clientHeight + threshold;
      }

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
      
      const isNewMessage = msgs.length > previousMessageCount;
      const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const isMyMessage = lastMessage ? lastMessage.uid === currentUser.uid : false;
      
      setMessages(msgs);
      
      // Son okunan mesajı güncelle (kendi mesajımızı gönderdiğimizde veya kanalı açtığımızda)
      if (lastMessage && (isMyMessage || msgs.length === previousMessageCount + 1)) {
        updateLastReadMessage(channel.id, lastMessage.id);
      }
      
      // Yeni mesaj geldiğinde bildirim kontrolü
      if (isNewMessage && lastMessage && !isMyMessage && channel) {
        const notificationLevel = getChannelNotificationLevel(channel.id);
        const isMentioned = lastMessage.mentions?.includes(currentUser.uid);
        const shouldNotify = 
          notificationLevel === 'all' || 
          (notificationLevel === 'mentions' && isMentioned) ||
          (settings.mentionNotifications && isMentioned);
        
        if (shouldNotify && notifySoundRef.current && settings.notificationSound !== 'none') {
          notifySoundRef.current.currentTime = 0;
          notifySoundRef.current.play().catch(() => {});
        }
      }

      // Scroll kontrolü: Eğer kullanıcı en alttaysa veya kendi mesajını gönderdiyse scroll yap
      if (wasAtBottom || (isNewMessage && isMyMessage)) {
        // Kendi mesajını gönderdiğinde anında scroll, diğer durumlarda smooth
        requestAnimationFrame(() => {
          scrollToBottom(isMyMessage);
        });
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id, currentUser.uid]);

  // Typing indicator
  useEffect(() => {
    if (!channel || !db || !currentUser) return;

    typingStatusRef.current = doc(db, 'channels', channel.id, 'typing', currentUser.uid);
    setDoc(typingStatusRef.current, { isTyping: false, uid: currentUser.uid }, { merge: true });

    const q = query(
      collection(db, 'channels', channel.id, 'typing'),
      where('isTyping', '==', true)
    );

    typingUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const typing = new Set<string>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.uid !== currentUser.uid && data.isTyping) {
          const userData = usersMap[data.uid];
          if (userData) {
            typing.add(JSON.stringify({
              uid: data.uid,
              name: userData.displayName || 'Kullanıcı',
              photoURL: userData.photoURL || '',
            }));
          }
        }
      });
      setTypingUsers(typing);
    });

    return () => {
      if (typingUnsubscribeRef.current) {
        typingUnsubscribeRef.current();
      }
      if (typingStatusRef.current) {
        setDoc(typingStatusRef.current, { isTyping: false }, { merge: true });
      }
    };
  }, [channel, currentUser, usersMap]);

  // Code highlighting
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).hljs) {
      const codeBlocks = document.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        (window as any).hljs.highlightElement(block);
      });
    }
  }, [messages]);

  const startTyping = async () => {
    if (!typingStatusRef.current) return;
    await setDoc(typingStatusRef.current, { isTyping: true, uid: currentUser.uid }, { merge: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  };

  const stopTyping = async () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (typingStatusRef.current) {
      await setDoc(typingStatusRef.current, { isTyping: false, uid: currentUser.uid }, { merge: true });
    }
  };

  // Mention algılama fonksiyonu
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionedName = match[1].toLowerCase();
      // Kullanıcı adına göre UID bul (tam eşleşme veya kısmi)
      Object.keys(usersMap).forEach((uid) => {
        const user = usersMap[uid];
        const displayName = user.displayName?.toLowerCase() || '';
        // Tam eşleşme veya başlangıçta eşleşme
        if (displayName === mentionedName || displayName.startsWith(mentionedName + ' ')) {
          if (!mentions.includes(uid)) {
            mentions.push(uid);
          }
        }
      });
    }
    
    return mentions;
  };

  const handleSendMessage = async () => {
    if (!channel || !messageText.trim() || !db) return;
    await stopTyping();

    const messageTextToSend = messageText.trim();
    const mentions = extractMentions(messageTextToSend);
    setMessageText(''); // Önce input'u temizle (daha hızlı UX)

    const messageData: any = {
      text: messageTextToSend,
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      email: currentUser.email,
      timestamp: serverTimestamp(),
      isEdited: false,
    };

    // Sadece mentions varsa ekle (undefined göndermeyelim)
    if (mentions.length > 0) {
      messageData.mentions = mentions;
    }

    await addDoc(collection(db, 'channels', channel.id, 'messages'), messageData);

    // Mesaj gönderildikten sonra scroll yap (Firestore snapshot gelmeden önce)
    requestAnimationFrame(() => {
      scrollToBottom(true); // Anında scroll
    });
  };

  const handleSendGif = async (gifUrl: string, gifTitle: string) => {
    if (!channel || !db) return;
    setShowGifModal(false);
    await stopTyping();

    await addDoc(collection(db, 'channels', channel.id, 'messages'), {
      text: `[GIF] ${gifTitle}`,
      gifUrl: gifUrl,
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      email: currentUser.email,
      timestamp: serverTimestamp(),
      isEdited: false,
      isGif: true,
    });

    // GIF gönderildikten sonra scroll yap
    requestAnimationFrame(() => {
      scrollToBottom(true); // Anında scroll
    });
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await stopTyping();
      handleSendMessage();
    } else {
      await startTyping();
    }
  };

  const handleInput = async () => {
    await startTyping();
  };

  const insertEmoji = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const formatText = (text: string, mentions?: string[]) => {
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks
    formatted = formatted.replace(
      /```(\w+)?\n?([\s\S]*?)```/g,
      (m, lang, code) =>
        `<div class="code-wrapper"><div class="code-header">${lang || 'text'}</div><pre><code class="language-${lang || 'text'}">${code}</code></pre></div>`
    );

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Mention'ları vurgula (code block'lardan sonra, ama code içinde değilse)
    if (mentions && mentions.length > 0) {
      mentions.forEach((uid) => {
        const user = usersMap[uid];
        if (user && user.displayName) {
          const escapedName = user.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const mentionRegex = new RegExp(`@${escapedName}`, 'gi');
          formatted = formatted.replace(mentionRegex, (match, offset) => {
            // Code block veya inline code içinde değilse vurgula
            const beforeMatch = formatted.substring(0, offset);
            const codeBlockStart = beforeMatch.lastIndexOf('<code');
            const codeBlockEnd = beforeMatch.lastIndexOf('</code>');
            const inlineCodeStart = beforeMatch.lastIndexOf('<code class="inline-code">');
            const inlineCodeEnd = beforeMatch.lastIndexOf('</code>');
            
            const isInCodeBlock = codeBlockStart !== -1 && (codeBlockEnd === -1 || codeBlockEnd < codeBlockStart);
            const isInInlineCode = inlineCodeStart !== -1 && (inlineCodeEnd === -1 || inlineCodeEnd < inlineCodeStart);
            
            if (!isInCodeBlock && !isInInlineCode) {
              return `<span class="mention ${uid === currentUser.uid ? 'mention-self' : ''}">${match}</span>`;
            }
            return match;
          });
        }
      });
    }

    // Links
    const linkRegex = /(https?:\/\/[^\s<]+)/g;
    formatted = formatted.replace(linkRegex, (match) => {
      const displayText = match.length > 35 ? match.substring(0, 35) + '...' : match;
      return `<a href="${match}" target="_blank" class="text-blue-400 hover:underline" data-link="${match}">${displayText}</a>`;
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

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.pageX,
      y: e.pageY,
      message,
    });
  };

  const handleCopy = () => {
    if (contextMenu.message) {
      navigator.clipboard.writeText(contextMenu.message.text || '');
      setContextMenu({ show: false, x: 0, y: 0, message: null });
      setToast('Kopyalandı!');
    }
  };

  const handleEdit = () => {
    if (contextMenu.message) {
      setEditModal({
        show: true,
        message: contextMenu.message,
        text: contextMenu.message.text || '',
      });
      setContextMenu({ show: false, x: 0, y: 0, message: null });
    }
  };

  const handleDelete = () => {
    if (contextMenu.message) {
      setDeleteModal({
        show: true,
        message: contextMenu.message,
        isStack: false,
      });
      setContextMenu({ show: false, x: 0, y: 0, message: null });
    }
  };

  const handleDeleteStack = async () => {
    if (!contextMenu.message || !channel || !db) return;
    setContextMenu({ show: false, x: 0, y: 0, message: null });

    const q = query(
      collection(db, 'channels', channel.id, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const snapshot = await getDocs(q);
    const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
    const targetIndex = msgs.findIndex((m) => m.id === contextMenu.message!.id);
    if (targetIndex === -1) return;

    const targetUid = msgs[targetIndex].uid;
    let idsToDelete = [msgs[targetIndex].id];

    for (let i = targetIndex - 1; i >= 0; i--) {
      if (msgs[i].uid === targetUid) {
        idsToDelete.push(msgs[i].id);
      } else {
        break;
      }
    }

    for (let i = targetIndex + 1; i < msgs.length; i++) {
      if (msgs[i].uid === targetUid) {
        idsToDelete.push(msgs[i].id);
      } else {
        break;
      }
    }

    setDeleteModal({
      show: true,
      message: contextMenu.message,
      isStack: true,
    });
  };

  const confirmDelete = async () => {
    if (!deleteModal.message || !channel || !db) return;

    if (deleteModal.isStack) {
      const q = query(
        collection(db, 'channels', channel.id, 'messages'),
        orderBy('timestamp', 'asc')
      );
      const snapshot = await getDocs(q);
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      const targetIndex = msgs.findIndex((m) => m.id === deleteModal.message!.id);
      if (targetIndex === -1) {
        setDeleteModal({ show: false, message: null, isStack: false });
        return;
      }

      const targetUid = msgs[targetIndex].uid;
      let idsToDelete = [msgs[targetIndex].id];

      for (let i = targetIndex - 1; i >= 0; i--) {
        if (msgs[i].uid === targetUid) {
          idsToDelete.push(msgs[i].id);
        } else {
          break;
        }
      }

      for (let i = targetIndex + 1; i < msgs.length; i++) {
        if (msgs[i].uid === targetUid) {
          idsToDelete.push(msgs[i].id);
        } else {
          break;
        }
      }

      if (!db || !channel) {
        setDeleteModal({ show: false, message: null, isStack: false });
        return;
      }
      const dbInstance = db; // TypeScript için
      const channelId = channel.id; // TypeScript için
      const batch = writeBatch(dbInstance);
      idsToDelete.forEach((mid) => {
        batch.delete(doc(dbInstance, 'channels', channelId, 'messages', mid));
      });
      await batch.commit();
    } else {
      if (!db || !channel) {
        setDeleteModal({ show: false, message: null, isStack: false });
        return;
      }
      const dbInstance = db; // TypeScript için
      const channelId = channel.id; // TypeScript için
      await deleteDoc(doc(dbInstance, 'channels', channelId, 'messages', deleteModal.message.id));
    }

    setDeleteModal({ show: false, message: null, isStack: false });
  };

  const confirmEdit = async () => {
    if (!editModal.message || !channel || !db) return;
    const text = editModal.text.trim();
    if (text) {
      await updateDoc(doc(db, 'channels', channel.id, 'messages', editModal.message.id), {
        text: text,
        isEdited: true,
      });
    }
    setEditModal({ show: false, message: null, text: '' });
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      e.preventDefault();
      const link = target.getAttribute('data-link') || target.getAttribute('href') || '';
      setLinkUrl(link);
      setShowLinkModal(true);
    }
  };

  const handleLinkConfirm = () => {
    window.open(linkUrl, '_blank');
    setShowLinkModal(false);
    setLinkUrl('');
  };

  const isAdmin = currentUser.email === ADMIN_EMAIL;

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

  const typingUsersArray = Array.from(typingUsers).map((u) => {
    try {
      return typeof u === 'string' ? JSON.parse(u) : u;
    } catch {
      return u;
    }
  }) as TypingUser[];

  return (
    <div className="flex-1 flex flex-col bg-[#313338] relative min-w-0">
      {/* Header */}
      <div className="h-12 border-b border-[#26272d] flex items-center px-4 bg-[#313338] z-10 shadow-sm">
        {channel.type === 'dm' && channel.participants ? (
          <>
            <div className="relative mr-2">
              <img
                src={usersMap[channel.participants.find((uid) => uid !== currentUser.uid) || '']?.photoURL || ''}
                className="w-8 h-8 rounded-full object-cover"
                alt=""
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#313338] rounded-full"></div>
            </div>
            <h3 className="font-bold text-white">{channelDisplayName}</h3>
          </>
        ) : (
          <>
            <i className="fas fa-hashtag text-gray-400 mr-2"></i>
            <h3 className="font-bold text-white">{channelDisplayName}</h3>
          </>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 pb-4 pt-2 bg-[#313338]"
        onClick={handleLinkClick}
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
              onContextMenu={(e) => handleContextMenu(e, msg)}
              className={`flex w-full px-4 py-0.5 group hover:bg-[#2e3035]/80 message-enter ${
                isConsecutive ? '-mt-1.5' : 'mt-5'
              } ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex max-w-[85%] sm:max-w-[75%] ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {isConsecutive ? (
                  <div
                    className={`w-10 flex-shrink-0 flex items-start ${
                      isMe ? 'ml-4 justify-start' : 'mr-4 justify-end'
                    }`}
                  >
                    <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 mt-1 select-none w-full text-center">
                      {timeStr}
                    </span>
                  </div>
                ) : (
                  <img
                    src={msg.photoURL}
                    className={`w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 object-cover shadow-sm ${
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
                      <span className={`text-xs text-gray-500 select-none ${isMe ? 'ml-2' : 'mr-4'}`}>
                        {timeStr}
                      </span>
                    </div>
                  )}
                  {msg.isGif && msg.gifUrl ? (
                    <div className="my-2">
                      <img
                        src={msg.gifUrl}
                        alt={msg.text || 'GIF'}
                        className="max-w-[200px] rounded cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(msg.gifUrl, '_blank')}
                      />
                    </div>
                  ) : (
                    <div
                      className="text-[#dbdee1] leading-relaxed whitespace-pre-wrap break-words msg-content text-[0.95rem]"
                      dangerouslySetInnerHTML={{ __html: formatText(msg.text, msg.mentions) }}
                    />
                  )}
                  {msg.isEdited && !msg.isGif && (
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
      {typingUsersArray.length > 0 && (
        <div className="px-4 pb-2 text-sm text-gray-400 flex items-center gap-2">
          {typingUsersArray.length === 1 ? (
            <>
              <img
                src={typingUsersArray[0].photoURL}
                className="w-5 h-5 rounded-full object-cover typing-avatar"
                alt=""
              />
              <span>
                {typingUsersArray[0].name}
                <span className="typing-dots">...</span>
              </span>
            </>
          ) : typingUsersArray.length === 2 ? (
            <span>
              {typingUsersArray[0].name} ve {typingUsersArray[1].name}
              <span className="typing-dots">...</span>
            </span>
          ) : (
            <span>
              {typingUsersArray[0].name} ve {typingUsersArray.length - 1} kişi daha
              <span className="typing-dots">...</span>
            </span>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-5 pt-1 bg-[#313338]">
        <div className="bg-[#383a40] rounded-lg px-4 py-2 flex items-end relative">
          <EmojiPicker
            show={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
            onSelect={insertEmoji}
          />
          <button
            onClick={() => setShowGifModal(true)}
            className="text-gray-400 hover:text-purple-400 text-xl mr-2 mb-1.5"
            title="GIF"
          >
            <i className="fas fa-image"></i>
          </button>
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-gray-400 hover:text-yellow-400 text-xl mr-3 mb-1.5"
          >
            <i className="fas fa-smile"></i>
          </button>
          <textarea
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyPress}
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

      {/* Context Menu */}
      {contextMenu.show && contextMenu.message && (
        <>
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setContextMenu({ show: false, x: 0, y: 0, message: null })}
          />
          <div
            className="fixed z-[100] bg-[#111214] rounded w-52 py-1 text-sm shadow-xl border border-[#1e1f22]"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
          >
            {contextMenu.message.uid === currentUser.uid && (
              <div
                onClick={handleEdit}
                className="px-3 py-2 hover:bg-[#5865F2] text-gray-300 cursor-pointer flex gap-2 items-center"
              >
                <i className="fas fa-pen w-4"></i> Düzenle
              </div>
            )}
            <div
              onClick={handleCopy}
              className="px-3 py-2 hover:bg-[#5865F2] text-gray-300 cursor-pointer flex gap-2 items-center"
            >
              <i className="fas fa-copy w-4"></i> Kopyala
            </div>
            <div className="h-[1px] bg-[#2b2d31] my-1"></div>
            {(contextMenu.message.uid === currentUser.uid || isAdmin) && (
              <>
                <div
                  onClick={handleDelete}
                  className="px-3 py-2 hover:bg-red-500 text-red-400 cursor-pointer flex gap-2 items-center"
                >
                  <i className="fas fa-trash w-4"></i> Sil
                </div>
                <div
                  onClick={handleDeleteStack}
                  className="px-3 py-2 hover:bg-red-800 text-red-400 cursor-pointer flex gap-2 items-center"
                >
                  <i className="fas fa-layer-group w-4"></i> Bu Grubu Sil
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editModal.show && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
          <div className="bg-[#313338] rounded p-4 w-full max-w-lg shadow-lg">
            <h3 className="font-bold text-white mb-2">Düzenle</h3>
            <textarea
              value={editModal.text}
              onChange={(e) => setEditModal({ ...editModal, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) confirmEdit();
                if (e.key === 'Escape') setEditModal({ show: false, message: null, text: '' });
              }}
              className="w-full bg-[#1e1f22] text-white rounded p-3 focus:outline-none min-h-[80px] mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditModal({ show: false, message: null, text: '' })}
                className="text-sm text-white hover:underline"
              >
                İptal
              </button>
              <button
                onClick={confirmEdit}
                className="bg-[#5865F2] text-white px-4 py-2 rounded text-sm"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
          <div className="bg-[#313338] rounded p-5 w-80 shadow-lg">
            <h3 className="font-bold text-white mb-2">Siliniyor</h3>
            <p className="text-gray-400 text-sm">
              {deleteModal.isStack ? 'Bu gruptaki mesajlar silinecek.' : 'Bu işlem geri alınamaz.'}
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setDeleteModal({ show: false, message: null, isStack: false })}
                className="text-sm text-white hover:underline"
              >
                İptal
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-500 text-white px-4 py-2 rounded text-sm"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GIF Modal */}
      {showGifModal && (
        <GifModal
          currentUser={currentUser}
          onClose={() => setShowGifModal(false)}
          onSend={handleSendGif}
        />
      )}

      {/* Link Modal */}
      <LinkModal
        show={showLinkModal}
        url={linkUrl}
        onConfirm={handleLinkConfirm}
        onCancel={() => {
          setShowLinkModal(false);
          setLinkUrl('');
        }}
      />

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
