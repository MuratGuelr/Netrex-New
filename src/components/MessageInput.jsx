import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, doc, setDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import EmojiPicker from './EmojiPicker';
import GifModal from './GifModal';

export default function MessageInput({ currentUser, channelId, onTypingChange }) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifModal, setShowGifModal] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingTimeoutRef = useRef(null);
  const typingStatusRef = useRef(null);
  const unsubscribeTypingRef = useRef(null);

  useEffect(() => {
    if (!channelId || !currentUser) return;

    // Typing status reference
    typingStatusRef.current = doc(db, 'channels', channelId, 'typing', currentUser.uid);
    setDoc(typingStatusRef.current, { isTyping: false, uid: currentUser.uid }, { merge: true });

    // Listen to typing status
    const q = query(
      collection(db, 'channels', channelId, 'typing'),
      where('isTyping', '==', true)
    );
    
    unsubscribeTypingRef.current = onSnapshot(q, (snapshot) => {
      const typing = new Set();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.uid !== currentUser.uid && data.isTyping) {
          typing.add(JSON.stringify({
            uid: data.uid,
            name: data.displayName || 'User',
            photoURL: data.photoURL || '',
          }));
        }
      });
      setTypingUsers(typing);
      if (onTypingChange) {
        onTypingChange(typing);
      }
    });

    return () => {
      if (unsubscribeTypingRef.current) {
        unsubscribeTypingRef.current();
      }
      if (typingStatusRef.current) {
        setDoc(typingStatusRef.current, { isTyping: false }, { merge: true });
      }
    };
  }, [channelId, currentUser, onTypingChange]);

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

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await stopTyping();
      sendMessage();
    } else {
      await startTyping();
    }
  };

  const handleInput = async () => {
    await startTyping();
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || !channelId) return;
    
    await stopTyping();
    setMessage('');
    
    await addDoc(collection(db, 'channels', channelId, 'messages'), {
      text: text,
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      email: currentUser.email,
      timestamp: serverTimestamp(),
      isEdited: false,
      channelId: channelId,
    });
  };

  const sendGif = async (gifUrl, gifTitle) => {
    setShowGifModal(false);
    await stopTyping();
    
    await addDoc(collection(db, 'channels', channelId, 'messages'), {
      text: `[GIF] ${gifTitle}`,
      gifUrl: gifUrl,
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      email: currentUser.email,
      timestamp: serverTimestamp(),
      isEdited: false,
      isGif: true,
      channelId: channelId,
    });
  };

  const insertEmoji = (emoji) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <>
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
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none resize-none max-h-32 py-2"
            placeholder="Mesaj gönder..."
          />
        </div>
      </div>
      {showGifModal && (
        <GifModal
          currentUser={currentUser}
          onClose={() => setShowGifModal(false)}
          onSend={sendGif}
        />
      )}
    </>
  );
}

