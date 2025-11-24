'use client';

import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

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
}

export default function UserList({
  currentUser,
  onUserClick,
  onUsersMapChange,
  currentChannel,
}: UserListProps) {
  const [users, setUsers] = useState<UserData[]>([]);

  useEffect(() => {
    if (!db) return;
    
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserData[] = [];
      const usersMap: Record<string, UserData> = {};

      snapshot.forEach((doc) => {
        const userData = { ...doc.data(), uid: doc.id } as UserData;
        usersData.push(userData);
        usersMap[userData.uid] = userData;
      });

      setUsers(usersData);
      onUsersMapChange(usersMap);
    });

    return () => unsubscribe();
  }, [onUsersMapChange]);

  const isOnline = (user: UserData) => {
    if (user.isOnline === true) return true;
    if (user.lastSeen) {
      try {
        // Firestore Timestamp kontrolü
        if (user.lastSeen && typeof user.lastSeen.toDate === 'function') {
          const lastSeenTime = user.lastSeen.toDate().getTime();
          const now = Date.now();
          return now - lastSeenTime < 300000; // 5 dakika
        }
      } catch (error) {
        // Timestamp parse hatası durumunda false döndür
        return false;
      }
    }
    return false;
  };

  const onlineUsers = users.filter((u) => isOnline(u) && u.uid !== currentUser.uid);
  const offlineUsers = users.filter((u) => !isOnline(u) && u.uid !== currentUser.uid);

  return (
    <div className="w-60 bg-[#2b2d31] flex flex-col flex-shrink-0 border-l border-[#1f2023]">
      <div className="h-12 flex items-center px-4 font-bold text-gray-400 shadow-sm border-b border-[#1f2023] uppercase text-xs tracking-wide">
        Üyeler
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
                    src={user.photoURL}
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
                    src={user.photoURL}
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

