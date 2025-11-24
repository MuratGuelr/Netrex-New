import { useEffect, useRef } from 'react';

export function useNotificationSound(currentUser, messages) {
  const soundRef = useRef(null);
  const lastMessageRef = useRef(null);

  useEffect(() => {
    soundRef.current = document.getElementById('notify-sound');
  }, []);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // Skip if it's the same message or if it's from current user
    if (lastMessageRef.current === lastMessage.id || lastMessage.uid === currentUser?.uid) {
      lastMessageRef.current = lastMessage.id;
      return;
    }

    // Play notification sound
    if (soundRef.current) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch(() => {
        // Ignore errors (user might have blocked autoplay)
      });
    }

    lastMessageRef.current = lastMessage.id;
  }, [messages, currentUser]);
}

