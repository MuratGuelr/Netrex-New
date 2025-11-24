'use client';

import { useState } from 'react';

interface LoginScreenProps {
  onLogin: () => void;
  onLoginAnonymously: (username: string) => void;
}

export default function LoginScreen({
  onLogin,
  onLoginAnonymously,
}: LoginScreenProps) {
  const [showAnonymousForm, setShowAnonymousForm] = useState(false);
  const [anonymousUsername, setAnonymousUsername] = useState('');

  const handleAnonymousSubmit = () => {
    if (anonymousUsername.trim()) {
      onLoginAnonymously(anonymousUsername.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#313338] flex flex-col items-center justify-center w-full h-full">
      <div className="bg-[#2b2d31] p-8 rounded-lg shadow-2xl text-center w-full max-w-sm">
        <div className="w-20 h-20 bg-[#5865F2] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <i className="fas fa-comments text-4xl text-white"></i>
        </div>
        <h1 className="text-2xl font-bold mb-2 text-white">Chatify</h1>
        
        {!showAnonymousForm ? (
          <div className="space-y-3 mt-6">
            <button
              onClick={onLogin}
              className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-medium py-3 px-4 rounded transition flex items-center justify-center"
            >
              <i className="fab fa-google mr-2"></i> Google ile Giriş
            </button>
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-[#3f4147]"></div>
              <span className="px-3 text-xs text-gray-400">veya</span>
              <div className="flex-grow border-t border-[#3f4147]"></div>
            </div>
            <button
              onClick={() => setShowAnonymousForm(true)}
              className="w-full bg-[#2b2d31] hover:bg-[#35373C] text-white font-medium py-3 px-4 rounded transition flex items-center justify-center border border-[#3f4147]"
            >
              <i className="fas fa-user-secret mr-2"></i> Anonim Olarak Devam Et
            </button>
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 text-left">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={anonymousUsername}
                onChange={(e) => setAnonymousUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAnonymousSubmit()}
                placeholder="Kullanıcı adınızı girin"
                className="w-full px-4 py-3 bg-[#1e1f22] border border-[#3f4147] rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5865f2] focus:border-transparent transition"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAnonymousForm(false)}
                className="flex-1 bg-[#2b2d31] hover:bg-[#35373C] text-white font-medium py-3 px-4 rounded transition border border-[#3f4147]"
              >
                Geri
              </button>
              <button
                onClick={handleAnonymousSubmit}
                disabled={!anonymousUsername.trim()}
                className="flex-1 bg-[#5865F2] hover:bg-[#4752c4] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded transition"
              >
                Devam Et
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

