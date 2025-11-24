'use client';

import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { generateAvatar } from '@/utils/avatarGenerator';

interface UserData {
  uid: string;
  displayName: string;
  photoURL: string;
  isOnline?: boolean;
  lastSeen?: any;
}

interface UserListProps {
  currentUser: User;
  onUserClick: (user: UserData) => void;
  onUsersMapChange: (map: Record<string, UserData>) => void;
  currentChannel: any;
  onToggle?: () => void;
}

export default function UserList({
  currentUser,
  onUserClick,
  onUsersMapChange,
  currentChannel,
  onToggle,
}: UserListProps) {
  const [users, setUsers] = useState<UserData[]>([]);

  useEffect(() => {
    if (!db) return;
    
    // orderBy kullanmadan direkt collection'ı dinle (index gerektirmez)
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usersData: UserData[] = [];
        const usersMap: Record<string, UserData> = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          // displayName öncelik sırası: Firestore'daki displayName > email'den türetilen > 'Kullanıcı'
          let displayName = data.displayName;
          if (!displayName || displayName.trim() === '') {
            // Eğer displayName yoksa, email'den türet
            if (data.email) {
              displayName = data.email.split('@')[0];
            } else {
              displayName = 'Kullanıcı';
            }
          }
          
          const userData: UserData = {
            uid: doc.id,
            displayName: displayName,
            photoURL: data.photoURL || generateAvatar(displayName, 32),
            isOnline: data.isOnline,
            lastSeen: data.lastSeen,
          };
          usersData.push(userData);
          usersMap[userData.uid] = userData;
        });

        // displayName'e göre sırala (client-side)
        usersData.sort((a, b) => {
          const nameA = (a.displayName || '').toLowerCase();
          const nameB = (b.displayName || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        setUsers(usersData);
        onUsersMapChange(usersMap);
      },
      (error) => {
        console.error('UserList snapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, [onUsersMapChange]);

  const isOnline = (user: UserData) => {
    // Önce isOnline field'ını kontrol et
    if (user.isOnline === true) {
      // Eğer isOnline true ise, lastSeen'i de kontrol et (5 dakika içindeyse online)
      if (user.lastSeen) {
        try {
          if (user.lastSeen && typeof user.lastSeen.toDate === 'function') {
            const lastSeenTime = user.lastSeen.toDate().getTime();
            const now = Date.now();
            const timeDiff = now - lastSeenTime;
            // 5 dakika (300000ms) içindeyse online
            return timeDiff < 300000;
          }
        } catch (error) {
          // Timestamp parse hatası durumunda isOnline field'ına güven
          return user.isOnline === true;
        }
      }
      return true;
    }
    
    // isOnline false veya undefined ise, lastSeen'e bak
    if (user.lastSeen) {
      try {
        if (user.lastSeen && typeof user.lastSeen.toDate === 'function') {
          const lastSeenTime = user.lastSeen.toDate().getTime();
          const now = Date.now();
          const timeDiff = now - lastSeenTime;
          // 2 dakika (120000ms) içindeyse online (daha kısa süre)
          return timeDiff < 120000;
        }
      } catch (error) {
        return false;
      }
    }
    
    return false;
  };

  const onlineUsers = users.filter((u) => isOnline(u) && u.uid !== currentUser.uid);
  const offlineUsers = users.filter((u) => !isOnline(u) && u.uid !== currentUser.uid);

  return (
    <div className="w-60 bg-[#2b2d31] flex flex-col flex-shrink-0 border-l border-[#1f2023] h-full">
      <div className="h-12 flex items-center justify-between px-4 font-bold text-gray-400 shadow-sm border-b border-[#1f2023] uppercase text-xs tracking-wide">
        <span>Üyeler</span>
        {onToggle && (
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#35373C] transition-colors"
            title="Üyeleri Gizle"
          >
            <i className="fas fa-chevron-right text-xs"></i>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-6">
          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">
            Çevrimiçi — {onlineUsers.length}
          </h4>
          <ul className="space-y-1">
            {onlineUsers.map((user) => (
              <li
                key={user.uid}
                onClick={() => onUserClick(user)}
                className="flex items-center px-2 py-1.5 rounded hover:bg-[#35373C] cursor-pointer opacity-90 hover:opacity-100"
              >
                <div className="relative">
                  <img
                    src={user.photoURL || generateAvatar(user.displayName, 32)}
                    className="w-8 h-8 rounded-full object-cover"
                    alt={user.displayName}
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#2b2d31] rounded-full"></div>
                </div>
                <div className="ml-2 overflow-hidden">
                  <div className="text-sm font-medium text-gray-200 truncate">
                    {user.displayName}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">
            Çevrimdışı — {offlineUsers.length}
          </h4>
          <ul className="space-y-1">
            {offlineUsers.map((user) => (
              <li
                key={user.uid}
                onClick={() => onUserClick(user)}
                className="flex items-center px-2 py-1.5 rounded hover:bg-[#35373C] cursor-pointer opacity-90 hover:opacity-100"
              >
                <div className="relative">
                  <img
                    src={user.photoURL || generateAvatar(user.displayName, 32)}
                    className="w-8 h-8 rounded-full object-cover"
                    alt={user.displayName}
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-500 border-2 border-[#2b2d31] rounded-full"></div>
                </div>
                <div className="ml-2 overflow-hidden">
                  <div className="text-sm font-medium text-gray-200 truncate">
                    {user.displayName}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

