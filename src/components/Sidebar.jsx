import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, ADMIN_EMAIL } from '../firebase/config';

export default function Sidebar({ currentUser, currentChannelId, onChannelSelect, usersMap, onLogout }) {
  const [channels, setChannels] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [channelType, setChannelType] = useState('text'); // 'text' or 'voice'
  const hasInitialized = useRef(false);

  useEffect(() => {
    const q = query(collection(db, 'channels'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const channelsData = [];
      snapshot.forEach((d) => {
        channelsData.push({ id: d.id, ...d.data() });
      });

      // DM kanallarını filtrele - sadece kullanıcının participants olduğu DM'ler
      const filteredChannels = channelsData.filter((c) => {
        if (c.type === 'dm' && c.participants) {
          return c.participants.includes(currentUser.uid);
        }
        // Text ve voice kanalları göster (type yoksa text olarak kabul et)
        return c.type !== 'dm';
      });

      setChannels(filteredChannels);

      // İlk yüklemede kanal seç
      if (!hasInitialized.current && filteredChannels.length > 0) {
        hasInitialized.current = true;
        const lastId = localStorage.getItem('lastChannel');
        const target = lastId && filteredChannels.find((c) => c.id === lastId)
          ? lastId
          : filteredChannels[0].id;
        const targetChannel = filteredChannels.find((c) => c.id === target) || filteredChannels[0];
        onChannelSelect(targetChannel);
      }
    });

    return () => unsubscribe();
  }, [currentUser, onChannelSelect]);

  useEffect(() => {
    // Genel kanalı oluştur
    const ensureGeneralChannel = async () => {
      const generalRef = doc(db, 'channels', 'genel');
      const snap = await getDoc(generalRef);
      if (!snap.exists()) {
        await setDoc(generalRef, {
          name: 'genel-sohbet',
          type: 'text',
          createdBy: 'system',
          createdAt: serverTimestamp(),
        });
      }
    };
    ensureGeneralChannel();
  }, []);

  const handleCreateChannel = async () => {
    const name = newChannelName
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
    if (name) {
      await addDoc(collection(db, 'channels'), {
        name: name,
        type: channelType,
        createdBy: currentUser.email,
        createdAt: serverTimestamp(),
      });
      setNewChannelName('');
      setChannelType('text');
      setShowCreateModal(false);
    }
  };

  const getChannelDisplayName = (channel) => {
    if (channel.type === 'dm' && channel.participants) {
      const otherUid = channel.participants.find((uid) => uid !== currentUser.uid);
      if (otherUid && usersMap[otherUid]) {
        return usersMap[otherUid].displayName;
      }
    }
    return channel.name;
  };

  const getChannelIcon = (channel) => {
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
    if (channel.type === 'voice') {
      return <i className={`fas fa-volume-up text-xs mr-2 ${currentChannelId === channel.id ? 'text-white' : 'text-[#72767d]'}`}></i>;
    }
    return <i className={`fas fa-hashtag text-xs mr-2 ${currentChannelId === channel.id ? 'text-white' : 'text-[#72767d]'}`}></i>;
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
              return (
                <li
                  key={channel.id}
                  onClick={() => onChannelSelect(channel)}
                  className={`flex items-center px-2 py-1.5 rounded cursor-pointer mx-2 group ${
                    isActive
                      ? 'bg-[#404249] text-white'
                      : 'text-[#949BA4] hover:bg-[#35373C] hover:text-gray-200'
                  }`}
                >
                  <div className="truncate flex items-center">
                    {getChannelIcon(channel)}
                    {getChannelDisplayName(channel)}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="p-2 bg-[#232428] flex items-center">
          <img
            src={currentUser.photoURL}
            className="w-8 h-8 rounded-full mr-2 bg-gray-600 object-cover"
            alt=""
          />
          <div className="flex-1 overflow-hidden">
            <div className="font-semibold text-sm text-white truncate">
              {currentUser.displayName}
            </div>
            <div className="text-[10px] text-gray-400">🟢 Online</div>
          </div>
          <button onClick={onLogout} className="text-gray-400 hover:text-white p-2">
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
          <div className="bg-[#313338] rounded p-6 w-80 shadow-lg">
            <h3 className="font-bold text-white mb-4 text-xs uppercase text-gray-400">
              Kanal Oluştur
            </h3>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateChannel();
                if (e.key === 'Escape') setShowCreateModal(false);
              }}
              className="bg-[#1e1f22] rounded p-2 w-full text-white mb-4 focus:outline-none"
              placeholder="#yeni-kanal"
              autoFocus
            />
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-2 block">Kanal Tipi</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setChannelType('text')}
                  className={`flex-1 px-3 py-2 rounded text-sm transition ${
                    channelType === 'text'
                      ? 'bg-[#5865F2] text-white'
                      : 'bg-[#1e1f22] text-gray-400 hover:bg-[#2b2d31]'
                  }`}
                >
                  <i className="fas fa-hashtag mr-2"></i> Metin
                </button>
                <button
                  onClick={() => setChannelType('voice')}
                  className={`flex-1 px-3 py-2 rounded text-sm transition ${
                    channelType === 'voice'
                      ? 'bg-[#5865F2] text-white'
                      : 'bg-[#1e1f22] text-gray-400 hover:bg-[#2b2d31]'
                  }`}
                >
                  <i className="fas fa-volume-up mr-2"></i> Sesli
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
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

