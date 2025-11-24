'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-5 right-5 z-[1000] bg-[#2b2d31] text-white px-5 py-3 rounded-lg shadow-xl animate-[toastSlideIn_0.3s_ease-out]">
      {message}
    </div>
  );
}

