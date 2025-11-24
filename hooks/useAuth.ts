'use client';

import { useState, useEffect } from 'react';
import {
  User,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { generateAvatar } from '@/utils/avatarGenerator';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Kullanıcı bilgilerini Firestore'dan al veya varsayılan değerler kullan
        if (!db) {
          setLoading(false);
          return;
        }
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userSnapshot = await getDoc(userDocRef);
        
        let displayName = firebaseUser.displayName || 'Kullanıcı';
        let photoURL = firebaseUser.photoURL;
        
        // Eğer Firestore'da kullanıcı bilgisi varsa onu kullan
        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          displayName = userData.displayName || displayName;
          photoURL = userData.photoURL || photoURL;
        } else if (!firebaseUser.isAnonymous && db) {
          // Google ile giriş yapıldıysa Firestore'a kaydet
          displayName = firebaseUser.displayName || 'Kullanıcı';
          photoURL = firebaseUser.photoURL || generateAvatar(displayName, 40);
          
          await setDoc(
            doc(db, 'users', firebaseUser.uid),
            {
              uid: firebaseUser.uid,
              displayName: displayName,
              photoURL: photoURL,
              email: firebaseUser.email || null,
              isAnonymous: false,
              lastSeen: serverTimestamp(),
              isOnline: true,
            },
            { merge: true }
          );
        }
        
        // Online durumunu güncelle
        if (db) {
          await setDoc(
            doc(db, 'users', firebaseUser.uid),
            {
              lastSeen: serverTimestamp(),
              isOnline: true,
            },
            { merge: true }
          );

          // Online durumunu gerçek zamanlı güncelle
          const onlineRef = doc(db, 'users', firebaseUser.uid, 'presence', 'online');
          await setDoc(onlineRef, { isOnline: true }, { merge: true });

          // Kullanıcı kapandığında offline yap
          const handleBeforeUnload = async () => {
            if (db) {
              await setDoc(
                doc(db, 'users', firebaseUser.uid),
                { isOnline: false, lastSeen: serverTimestamp() },
                { merge: true }
              );
            }
          };
          if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', handleBeforeUnload);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (!auth) throw new Error('Firebase Auth is not initialized');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginAnonymously = async (username: string) => {
    if (!auth || !db) throw new Error('Firebase is not initialized');
    try {
      const result = await signInAnonymously(auth);
      // Kullanıcı adını Firestore'a kaydet
      if (result.user) {
        await setDoc(
          doc(db, 'users', result.user.uid),
          {
            uid: result.user.uid,
            displayName: username,
            photoURL: generateAvatar(username, 40),
            isAnonymous: true,
            lastSeen: serverTimestamp(),
            isOnline: true,
          },
          { merge: true }
        );
      }
      // Anonim kullanıcı için otomatik olarak onAuthStateChanged tetiklenecek
      return result;
    } catch (error) {
      console.error('Anonim giriş hatası:', error);
      throw error;
    }
  };

  const logout = async () => {
    if (!auth || !db) return;
    if (user) {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          lastSeen: serverTimestamp(),
          isOnline: false,
        },
        { merge: true }
      );
    }
    await signOut(auth);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lastChannel');
    }
  };

  return { user, loading, login, loginAnonymously, logout };
}
