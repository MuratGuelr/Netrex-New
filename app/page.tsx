'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginScreen from '@/components/LoginScreen';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';
import UserList from '@/components/UserList';
import VoiceChannel from '@/components/VoiceChannel';

interface Channel {
  id: string;
  name: string;
  type?: 'text' | 'voice' | 'dm';
  participants?: string[];
  bitrate?: number;
}

export default function Home() {
  const { user, loading, login, loginAnonymously, logout } = useAuth();
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [isVoiceChannel, setIsVoiceChannel] = useState(false);

  const handleChannelSelect = (channel: Channel) => {
    setCurrentChannel(channel);
    setIsVoiceChannel(channel.type === 'voice');
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastChannel', channel.id);
    }
  };

  const handleUserClick = (userData: any) => {
    // DM kanalı oluştur veya aç
    // Bu özellik daha sonra eklenebilir
    console.log('User clicked:', userData);
  };

  const handleLeaveVoiceChannel = () => {
    setIsVoiceChannel(false);
    // Genel-sohbet kanalına yönlendir
    const generalChannel = { id: 'genel', name: 'genel-sohbet', type: 'text' as const };
    setCurrentChannel(generalChannel);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastChannel', 'genel');
    }
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
    return <LoginScreen onLogin={login} onLoginAnonymously={(username) => loginAnonymously(username)} />;
  }

  // Sesli kanal görünümü
  if (isVoiceChannel && currentChannel) {
    return (
      <div className="h-screen bg-[#313338] flex overflow-hidden">
        <Sidebar
          currentUser={user}
          currentChannelId={currentChannel.id}
          onChannelSelect={handleChannelSelect}
          usersMap={usersMap}
          onLogout={logout}
        />
        <VoiceChannel
          currentUser={user}
          roomName={currentChannel.name}
          channelId={currentChannel.id}
          onLeave={handleLeaveVoiceChannel}
        />
        <UserList
          currentUser={user}
          onUserClick={handleUserClick}
          onUsersMapChange={setUsersMap}
          currentChannel={currentChannel}
        />
      </div>
    );
  }

  // Normal görünüm (metin kanalları)
  return (
    <div
      className="bg-[#313338] text-gray-100 h-screen flex overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Sidebar
        currentUser={user}
        currentChannelId={currentChannel?.id || null}
        onChannelSelect={handleChannelSelect}
        usersMap={usersMap}
        onLogout={logout}
      />
      <ChatArea currentUser={user} channel={currentChannel} usersMap={usersMap} />
      <UserList
        currentUser={user}
        onUserClick={handleUserClick}
        onUsersMapChange={setUsersMap}
        currentChannel={currentChannel}
      />
    </div>
  );
}
