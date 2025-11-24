import { useState } from 'react';

export default function LoginScreen({ onLogin, onLoginAnonymously }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnonymousLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      await onLoginAnonymously(username);
    } catch (err) {
      setError(err.message || 'Giriş yapılırken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#313338] flex flex-col items-center justify-center w-full h-full">
      <div className="bg-[#2b2d31] p-8 rounded-lg shadow-2xl text-center w-full max-w-sm">
        <div className="w-20 h-20 bg-[#5865F2] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <i className="fas fa-comments text-4xl text-white"></i>
        </div>
        <h1 className="text-2xl font-bold mb-6 text-white">Chatify</h1>
        
        {/* Misafir Giriş */}
        <div className="mb-4">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && username.trim().length >= 2) {
                handleAnonymousLogin();
              }
            }}
            placeholder="Kullanıcı adınız (2-20 karakter)"
            className="w-full bg-[#1e1f22] text-white px-4 py-3 rounded-lg border border-[#404249] focus:outline-none focus:border-[#5865F2] transition mb-2"
            maxLength={20}
          />
          {error && (
            <p className="text-red-400 text-sm text-left mb-2">{error}</p>
          )}
          <button
            onClick={handleAnonymousLogin}
            disabled={loading || username.trim().length < 2}
            className="w-full bg-[#23a55a] hover:bg-[#1e8e4a] disabled:bg-[#404249] disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded transition flex items-center justify-center"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i> Giriş yapılıyor...
              </>
            ) : (
              <>
                <i className="fas fa-user-secret mr-2"></i> Misafir Olarak Giriş
              </>
            )}
          </button>
        </div>

        {/* Ayırıcı */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-[#404249]"></div>
          <span className="px-4 text-gray-400 text-sm">veya</span>
          <div className="flex-1 border-t border-[#404249]"></div>
        </div>

        {/* Google Giriş */}
        <button
          onClick={onLogin}
          disabled={loading}
          className="w-full bg-[#5865F2] hover:bg-[#4752c4] disabled:bg-[#404249] disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded transition flex items-center justify-center"
        >
          <i className="fab fa-google mr-2"></i> Google ile Giriş
        </button>
      </div>
    </div>
  );
}

