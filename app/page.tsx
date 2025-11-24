'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginScreen from '@/components/LoginScreen';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';
import UserList from '@/components/UserList';
import VoiceChannel from '@/components/VoiceChannel';
import NotificationSettingsModal from '@/components/NotificationSettingsModal';

interface Channel {
  id: string;
  name: string;
  type?: 'text' | 'voice' | 'dm';
  participants?: string[];
  bitrate?: number;
}

export default function Home() {
  const { user, loading, login, loginAnonymously, logout } = useAuth();
  const [currentTextChannel, setCurrentTextChannel] = useState<Channel | null>(null);
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState<Channel | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [userListVisible, setUserListVisible] = useState(true);
  const [showGlobalNotificationSettings, setShowGlobalNotificationSettings] = useState(false);

  const handleChannelSelect = (channel: Channel) => {
    if (channel.type === 'voice') {
      // Sesli kanal seçildiğinde
      setCurrentVoiceChannel(channel);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastVoiceChannel', channel.id);
      }
      // Eğer metin kanalı seçili değilse, genel-sohbet'i seç
      if (!currentTextChannel) {
        const generalChannel = { id: 'genel', name: 'genel-sohbet', type: 'text' as const };
        setCurrentTextChannel(generalChannel);
        if (typeof window !== 'undefined') {
          localStorage.setItem('lastTextChannel', 'genel');
        }
      }
    } else {
      // Metin kanalı seçildiğinde
      setCurrentTextChannel(channel);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastTextChannel', channel.id);
      }
    }
  };

  const handleUserClick = async (userData: any) => {
    // DM kanalı oluştur veya aç
    if (!userData || userData.uid === user?.uid) return;
    
    const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase/config');
    
    if (!db || !user) return;
    
    const uid1 = user.uid;
    const uid2 = userData.uid;
    // DM kanal ID'si: her zaman küçük UID önce gelecek şekilde sırala
    const dmChannelId = uid1 < uid2 ? `dm_${uid1}_${uid2}` : `dm_${uid2}_${uid1}`;
    
    const channelRef = doc(db, 'channels', dmChannelId);
    const channelSnap = await getDoc(channelRef);
    
    if (!channelSnap.exists()) {
      // DM kanalı yoksa oluştur
      await setDoc(channelRef, {
        name: userData.displayName || 'Kullanıcı',
        type: 'dm',
        participants: [uid1, uid2],
        createdBy: user.email || null,
        createdAt: serverTimestamp(),
      });
    }
    
    // DM kanalını seç
    const dmChannel: Channel = {
      id: dmChannelId,
      name: userData.displayName || 'Kullanıcı',
      type: 'dm',
      participants: [uid1, uid2],
    };
    
    handleChannelSelect(dmChannel);
  };

  const handleLeaveVoiceChannel = () => {
    setCurrentVoiceChannel(null);
  };

  if (loading) {
    return (
      <div className="bg-[#313338] text-gray-100 h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">Netrex</div>
          <div className="text-gray-400">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} onLoginAnonymously={(username) => loginAnonymously(username)} />;
  }

  // Aktif kanalları belirle
  const activeTextChannel = currentTextChannel;
  const activeVoiceChannel = currentVoiceChannel;
  const activeChannelId = activeVoiceChannel?.id || activeTextChannel?.id || null;

  return (
    <div
      className="bg-[#313338] text-gray-100 h-screen flex overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Sidebar Toggle Button */}
      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 bg-[#2b2d31] hover:bg-[#35373C] text-gray-400 hover:text-white p-2 rounded-r-lg border-r border-y border-[#1f2023] transition-all"
          title="Kanalları Göster"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`${
          sidebarVisible ? 'w-72' : 'w-0'
        } transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0`}
      >
        <Sidebar
          currentUser={user}
          currentChannelId={activeChannelId}
          currentTextChannelId={activeTextChannel?.id || null}
          currentVoiceChannelId={activeVoiceChannel?.id || null}
          onChannelSelect={handleChannelSelect}
          usersMap={usersMap}
          onLogout={logout}
          onToggle={() => setSidebarVisible(false)}
        />
      </div>
      
      {/* Ana içerik alanı - sesli kanal ve metin kanalı birlikte */}
      <div className="flex-1 flex min-w-0 relative">
        {activeVoiceChannel && (
          <>
            {/* Sol: Sesli kanal */}
            <div className="w-80 flex-shrink-0 border-r border-[#1f2023] flex flex-col">
              <VoiceChannel
                currentUser={user}
                roomName={activeVoiceChannel.name}
                channelId={activeVoiceChannel.id}
                onLeave={handleLeaveVoiceChannel}
              />
            </div>
            {/* Sağ: Metin kanalı (ChatArea) */}
            <div className="flex-1 min-w-0 flex flex-col">
              <ChatArea 
                currentUser={user} 
                channel={activeTextChannel || activeVoiceChannel} 
                usersMap={usersMap} 
              />
            </div>
          </>
        )}
        
        {!activeVoiceChannel && (
          <div className="flex-1 min-w-0 flex flex-col">
            <ChatArea 
              currentUser={user} 
              channel={activeTextChannel} 
              usersMap={usersMap} 
            />
          </div>
        )}
      </div>
      
      {/* UserList Toggle Button */}
      {!userListVisible && (
        <button
          onClick={() => setUserListVisible(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-[#2b2d31] hover:bg-[#35373C] text-gray-400 hover:text-white p-2 rounded-l-lg border-l border-y border-[#1f2023] transition-all"
          title="Üyeleri Göster"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
      )}

      {/* UserList */}
      <div
        className={`${
          userListVisible ? 'w-60' : 'w-0'
        } transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0`}
      >
        <UserList
          currentUser={user}
          onUserClick={handleUserClick}
          onUsersMapChange={setUsersMap}
          currentChannel={activeTextChannel || activeVoiceChannel}
          onToggle={() => setUserListVisible(false)}
        />
      </div>

      {/* Global Notification Settings Button */}
      <button
        onClick={() => setShowGlobalNotificationSettings(true)}
        className="fixed bottom-4 right-4 z-50 bg-[#5865F2] hover:bg-[#4752c4] text-white p-3 rounded-full shadow-lg transition-colors"
        title="Bildirim Ayarları"
      >
        <i className="fas fa-bell"></i>
      </button>

      {/* Global Notification Settings Modal */}
      <NotificationSettingsModal
        show={showGlobalNotificationSettings}
        onClose={() => setShowGlobalNotificationSettings(false)}
        currentUser={user}
      />
    </div>
  );
}
