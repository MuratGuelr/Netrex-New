import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function UserList({ currentUser, onUserClick, onUsersMapChange, currentChannel }) {
  const [users, setUsers] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [voiceParticipants, setVoiceParticipants] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = [];
      const map = {};
      
      snapshot.forEach((doc) => {
        const u = doc.data();
        map[u.uid] = u;
        usersData.push(u);
      });
      
      setUsersMap(map);
      setUsers(usersData);
      if (onUsersMapChange) {
        onUsersMapChange(map);
      }
    });

    return () => unsubscribe();
  }, [onUsersMapChange]);

  // Listen to voice channel participants
  useEffect(() => {
    if (!currentChannel || currentChannel.type !== 'voice') {
      setVoiceParticipants([]);
      return;
    }

    const participantsCollection = collection(db, 'channels', currentChannel.id, 'participants');
    const unsubscribe = onSnapshot(participantsCollection, (snapshot) => {
      const participants = [];
      snapshot.forEach((doc) => {
        participants.push({ id: doc.id, ...doc.data() });
      });
      setVoiceParticipants(participants);
    });

    return () => unsubscribe();
  }, [currentChannel]);

  const handleUserContextMenu = async (e, user) => {
    e.preventDefault();
    if (user.uid === currentUser.uid) return;
    
    // DM kanalı oluştur veya aç
    const uid1 = currentUser.uid;
    const uid2 = user.uid;
    const dmChannelId = uid1 < uid2 ? `dm_${uid1}_${uid2}` : `dm_${uid2}_${uid1}`;
    const channelRef = doc(db, 'channels', dmChannelId);
    const chSnap = await getDoc(channelRef);
    
    if (!chSnap.exists()) {
      await setDoc(channelRef, {
        name: user.displayName,
        type: 'dm',
        participants: [uid1, uid2],
        createdBy: currentUser.email,
        createdAt: serverTimestamp(),
      });
    }
    
    if (onUserClick) {
      onUserClick({
        id: dmChannelId,
        name: user.displayName,
        type: 'dm',
        participants: [uid1, uid2],
      });
    }
  };

  const now = Date.now();
  const onlineUsers = users.filter((u) => {
    const isMe = currentUser && u.uid === currentUser.uid;
    if (isMe) return false;
    return (
      u.isOnline === true ||
      (u.lastSeen && now - u.lastSeen.toDate().getTime() < 300000)
    );
  });

  const offlineUsers = users.filter((u) => {
    const isMe = currentUser && u.uid === currentUser.uid;
    if (isMe) return false;
    return !(
      u.isOnline === true ||
      (u.lastSeen && now - u.lastSeen.toDate().getTime() < 300000)
    );
  });

  const renderUser = (u) => {
    const isOnline = u.isOnline === true || (u.lastSeen && now - u.lastSeen.toDate().getTime() < 300000);
    const statusColor = isOnline ? 'bg-green-500' : 'bg-gray-500';

    return (
      <li
        key={u.uid}
        onContextMenu={(e) => handleUserContextMenu(e, u)}
        className="flex items-center px-2 py-1.5 rounded hover:bg-[#35373C] cursor-pointer opacity-90 hover:opacity-100"
      >
        <div className="relative">
          <img src={u.photoURL} className="w-8 h-8 rounded-full object-cover" alt="" />
          <div className={`absolute bottom-0 right-0 w-3 h-3 ${statusColor} border-2 border-[#2b2d31] rounded-full`}></div>
        </div>
        <div className="ml-2 overflow-hidden">
          <div className="text-sm font-medium text-gray-200 truncate">
            {u.displayName}
          </div>
        </div>
      </li>
    );
  };

  const renderVoiceParticipant = (participant) => {
    const user = usersMap[participant.uid] || participant;
    const isOnline = user.isOnline === true || (user.lastSeen && Date.now() - user.lastSeen.toDate().getTime() < 300000);
    const statusColor = isOnline ? 'bg-green-500' : 'bg-gray-500';

    return (
      <li
        key={participant.uid}
        className="flex items-center px-2 py-1.5 rounded hover:bg-[#35373C] cursor-pointer opacity-90 hover:opacity-100"
      >
        <div className="relative">
          <img src={user.photoURL || participant.photoURL} className="w-8 h-8 rounded-full object-cover" alt="" />
          <div className={`absolute bottom-0 right-0 w-3 h-3 ${statusColor} border-2 border-[#2b2d31] rounded-full`}></div>
        </div>
        <div className="ml-2 overflow-hidden flex-1">
          <div className="text-sm font-medium text-gray-200 truncate flex items-center gap-2">
            {user.displayName || participant.displayName}
            {participant.isMuted && (
              <i className="fas fa-microphone-slash text-red-400 text-xs"></i>
            )}
            {participant.isDeafened && (
              <i className="fas fa-volume-mute text-red-400 text-xs"></i>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="w-60 bg-[#2b2d31] flex flex-col flex-shrink-0 border-l border-[#1f2023]">
      <div className="h-12 flex items-center px-4 font-bold text-gray-400 shadow-sm border-b border-[#1f2023] uppercase text-xs tracking-wide">
        {currentChannel?.type === 'voice' ? 'Sesli Kanal' : 'Üyeler'}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {currentChannel?.type === 'voice' ? (
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">
              Kanaldaki Kullanıcılar — {voiceParticipants.length}
            </h4>
            <ul className="space-y-1">
              {voiceParticipants.map(renderVoiceParticipant)}
            </ul>
            {voiceParticipants.length === 0 && (
              <div className="text-gray-500 text-sm text-center py-4">
                Henüz kimse kanala katılmadı
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">
                Çevrimiçi — {onlineUsers.length}
              </h4>
              <ul className="space-y-1">
                {onlineUsers.map(renderUser)}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">
                Çevrimdışı — {offlineUsers.length}
              </h4>
              <ul className="space-y-1">
                {offlineUsers.map(renderUser)}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

