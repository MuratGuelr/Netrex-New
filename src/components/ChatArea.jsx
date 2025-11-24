import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import Message from './Message';
import TypingIndicator from './TypingIndicator';
import MessageInput from './MessageInput';
import VoiceChannel from './VoiceChannel';
import { useNotificationSound } from '../hooks/useNotificationSound';

export default function ChatArea({ currentUser, channel, usersMap }) {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const unsubscribeRef = useRef(null);
  
  useNotificationSound(currentUser, messages);

  useEffect(() => {
    if (!channel) return;

    const q = query(
      collection(db, 'channels', channel.id, 'messages'),
      orderBy('timestamp', 'asc')
    );

    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const messagesData = [];
      snapshot.forEach((doc) => {
        const msg = doc.data();
        // DM mesajlarında participants kontrolü
        if (channel.type === 'dm' && channel.participants?.length > 0) {
          if (!channel.participants.includes(msg.uid)) {
            return; // Bu mesajı gösterme
          }
        }
        messagesData.push({ id: doc.id, ...msg });
      });
      setMessages(messagesData);

      // Scroll to bottom
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);

      // Highlight code blocks
      if (window.hljs) {
        setTimeout(() => {
          document.querySelectorAll('pre code').forEach((el) => {
            window.hljs.highlightElement(el);
          });
        }, 200);
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [channel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getChannelHeader = () => {
    if (channel.type === 'dm' && channel.participants?.length > 0) {
      const otherUid = channel.participants.find((uid) => uid !== currentUser.uid);
      if (otherUid && usersMap[otherUid]) {
        const otherUser = usersMap[otherUid];
        return (
          <div className="flex items-center">
            <div className="relative mr-2">
              <img
                src={otherUser.photoURL}
                className="w-8 h-8 rounded-full object-cover"
                alt=""
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#313338] rounded-full"></div>
            </div>
            <h3 className="font-bold text-white ml-2">{otherUser.displayName}</h3>
          </div>
        );
      }
    }
    return (
      <>
        <i className="fas fa-hashtag text-gray-400 mr-2 text-lg"></i>
        <h3 className="font-bold text-white">{channel.name}</h3>
      </>
    );
  };

  if (!channel) {
    return (
      <div className="flex-1 flex flex-col bg-[#313338] relative min-w-0">
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Bir kanal seçin
        </div>
      </div>
    );
  }

  // Show voice channel if channel type is voice
  if (channel.type === 'voice') {
    return <VoiceChannel currentUser={currentUser} channel={channel} usersMap={usersMap} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-[#313338] relative min-w-0">
      <div className="h-12 border-b border-[#26272d] flex items-center px-4 bg-[#313338] z-10 shadow-sm">
        {getChannelHeader()}
      </div>
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 pb-4 pt-2 bg-[#313338]"
      >
        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const isConsecutive = prevMsg && prevMsg.uid === msg.uid;
          return (
            <Message
              key={msg.id}
              message={msg}
              isConsecutive={isConsecutive}
              isMe={msg.uid === currentUser.uid}
              currentUser={currentUser}
              channelId={channel.id}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <TypingIndicator typingUsers={typingUsers} usersMap={usersMap} />
      <MessageInput
        currentUser={currentUser}
        channelId={channel.id}
        onTypingChange={setTypingUsers}
      />
    </div>
  );
}

