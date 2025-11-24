'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db, ADMIN_EMAIL } from '@/lib/firebase/config';

interface Channel {
  id: string;
  name: string;
  type?: 'text' | 'voice' | 'dm';
  participants?: string[];
  createdBy?: string;
  bitrate?: number;
}

interface SidebarProps {
  currentUser: User;
  currentChannelId: string | null;
  onChannelSelect: (channel: Channel) => void;
  usersMap: Record<string, any>;
  onLogout: () => void;
}

export default function Sidebar({
  currentUser,
  currentChannelId,
  onChannelSelect,
  usersMap,
  onLogout,
}: SidebarProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');

  useEffect(() => {
    if (!db) return;
    
    // Genel kanalı oluştur
    const initGeneralChannel = async () => {
      if (!db) return; // Double check for TypeScript
      const generalRef = doc(db, 'channels', 'genel');
      const snap = await getDoc(generalRef);
      if (!snap.exists()) {
        await setDoc(generalRef, {
          name: 'genel-sohbet',
          createdBy: 'system',
          createdAt: serverTimestamp(),
          type: 'text',
        });
      }
    };
    initGeneralChannel();

    // Kanalları dinle
    if (!db) return; // TypeScript null check
    const q = query(collection(db, 'channels'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const channelsData: Channel[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // DM kanallarını filtrele
        if (data.type === 'dm' && data.participants) {
          if (!data.participants.includes(currentUser.uid)) {
            return;
          }
        }
        channelsData.push({ id: doc.id, ...data } as Channel);
      });
      setChannels(channelsData);

      // İlk kanalı otomatik seç
      if (!currentChannelId && channelsData.length > 0) {
        const lastId = typeof window !== 'undefined' ? localStorage.getItem('lastChannel') : null;
        const target = lastId && channelsData.find((c) => c.id === lastId)
          ? lastId
          : channelsData[0].id;
        onChannelSelect(channelsData.find((c) => c.id === target) || channelsData[0]);
      }
    });

    return () => unsubscribe();
  }, [currentUser.uid, currentChannelId, onChannelSelect]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !db) return;
    const name = newChannelName.trim().replace(/\s+/g, '-').toLowerCase();
    if (!db) return; // TypeScript null check
    await addDoc(collection(db, 'channels'), {
      name,
      createdBy: currentUser.email,
      createdAt: serverTimestamp(),
      type: channelType,
    });
    setNewChannelName('');
    setChannelType('text');
    setShowCreateModal(false);
  };

  const getChannelDisplayName = (channel: Channel) => {
    if (channel.type === 'dm' && channel.participants) {
      const otherUid = channel.participants.find((uid) => uid !== currentUser.uid);
      if (otherUid && usersMap[otherUid]) {
        return usersMap[otherUid].displayName;
      }
    }
    return channel.name;
  };

  const getChannelIcon = (channel: Channel) => {
    if (channel.type === 'voice') {
      return <i className="fas fa-volume-up text-xs mr-2 text-[#72767d]"></i>;
    }
    if (channel.type === 'dm' && channel.participants) {
      const otherUid = channel.participants.find((uid) => uid !== currentUser.uid);
      if (otherUid && usersMap[otherUid]) {
        return (
          <img
            src={usersMap[otherUid].photoURL}
            className="w-5 h-5 rounded-full mr-2 object-cover"
            alt=""
          />
        );
      }
    }
    return <i className="fas fa-hashtag text-xs mr-2 text-[#72767d]"></i>;
  };

  return (
    <>
      <div className="w-72 bg-[#2b2d31] flex flex-col flex-shrink-0 border-r border-[#1f2023]">
        <div className="h-12 flex items-center justify-center font-bold text-white border-b border-[#1f2023]">
          Chatify
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex justify-between items-center px-2 mb-2 mt-2 group">
            <span className="text-xs font-bold text-gray-400 uppercase">Kanallar</span>
            <i
              onClick={() => setShowCreateModal(true)}
              className="fas fa-plus text-xs text-gray-400 hover:text-white cursor-pointer"
            ></i>
          </div>
          <ul className="space-y-[2px]">
            {channels.map((channel) => {
              const isActive = channel.id === currentChannelId;
              const displayName = getChannelDisplayName(channel);
              const icon = getChannelIcon(channel);

              return (
                <li
                  key={channel.id}
                  onClick={() => onChannelSelect(channel)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer mx-2 group ${
                    isActive
                      ? 'bg-[#404249] text-white'
                      : 'text-[#949BA4] hover:bg-[#35373C] hover:text-gray-200'
                  }`}
                >
                  <div className="truncate flex items-center flex-1 min-w-0">
                    {icon}
                    <span className="truncate">{displayName}</span>
                  </div>
                  {channel.type === 'voice' && channel.bitrate && (
                    <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">
                      {channel.bitrate / 1000}k
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="p-2 bg-[#232428] flex items-center">
          <img
            src={currentUser.photoURL || ''}
            className="w-8 h-8 rounded-full mr-2 bg-gray-600 object-cover"
            alt={currentUser.displayName || ''}
          />
          <div className="flex-1 overflow-hidden">
            <div className="font-semibold text-sm text-white truncate">
              {currentUser.displayName}
            </div>
            <div className="text-[10px] text-gray-400">🟢 Online</div>
          </div>
          <button
            onClick={onLogout}
            className="text-gray-400 hover:text-white p-2"
            title="Çıkış Yap"
          >
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
          <div className="bg-[#313338] rounded p-6 w-80 shadow-lg">
            <h3 className="font-bold text-white mb-4 text-xs uppercase text-gray-400">
              Kanal Oluştur
            </h3>
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setChannelType('text')}
                className={`flex-1 px-4 py-2 rounded text-sm ${
                  channelType === 'text'
                    ? 'bg-[#5865F2] text-white'
                    : 'bg-[#1e1f22] text-gray-400 hover:text-white'
                }`}
              >
                <i className="fas fa-hashtag mr-2"></i> Metin
              </button>
              <button
                onClick={() => setChannelType('voice')}
                className={`flex-1 px-4 py-2 rounded text-sm ${
                  channelType === 'voice'
                    ? 'bg-[#5865F2] text-white'
                    : 'bg-[#1e1f22] text-gray-400 hover:text-white'
                }`}
              >
                <i className="fas fa-volume-up mr-2"></i> Sesli
              </button>
            </div>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateChannel()}
              className="bg-[#1e1f22] rounded p-2 w-full text-white mb-4 focus:outline-none"
              placeholder={channelType === 'voice' ? 'Sesli kanal adı' : '#yeni-kanal'}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewChannelName('');
                  setChannelType('text');
                }}
                className="text-sm text-white hover:underline"
              >
                İptal
              </button>
              <button
                onClick={handleCreateChannel}
                className="bg-[#5865F2] text-white px-4 py-2 rounded text-sm"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

