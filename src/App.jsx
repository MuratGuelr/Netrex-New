import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import UserList from './components/UserList';
import LinkModal from './components/LinkModal';
import './App.css';

function App() {
  const { user, loading, login, loginAnonymously, logout } = useAuth();
  const [currentChannel, setCurrentChannel] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [linkModal, setLinkModal] = useState({ show: false, url: '' });


  const handleChannelSelect = (channel) => {
    setCurrentChannel(channel);
    localStorage.setItem('lastChannel', channel.id);
  };

  const handleUserClick = (channel) => {
    handleChannelSelect(channel);
  };

  useEffect(() => {
    const handleLinkClick = (e) => {
      const link = e.target.closest('a');
      if (link && link.closest('.msg-content')) {
        e.preventDefault();
        setLinkModal({ show: true, url: link.href });
      }
    };
    
    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  }, []);

  const handleLinkConfirm = () => {
    window.open(linkModal.url, '_blank');
    setLinkModal({ show: false, url: '' });
  };

  if (loading) {
    return (
      <div className="bg-[#313338] text-gray-100 h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">Chatify</div>
          <div className="text-gray-400">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} onLoginAnonymously={loginAnonymously} />;
  }

  return (
    <div
      className="bg-[#313338] text-gray-100 h-screen flex overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      <audio id="notify-sound" src="/notification.mp3" preload="auto"></audio>
      
      <Sidebar
        currentUser={user}
        currentChannelId={currentChannel?.id}
        onChannelSelect={handleChannelSelect}
        usersMap={usersMap}
        onLogout={logout}
      />
      
      <ChatArea
        currentUser={user}
        channel={currentChannel}
        usersMap={usersMap}
      />
      
      <UserList
        currentUser={user}
        onUserClick={handleUserClick}
        onUsersMapChange={setUsersMap}
        currentChannel={currentChannel}
      />

      <LinkModal
        show={linkModal.show}
        url={linkModal.url}
        onConfirm={handleLinkConfirm}
        onCancel={() => setLinkModal({ show: false, url: '' })}
      />
    </div>
  );
}

export default App;
