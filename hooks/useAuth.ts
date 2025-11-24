'use client';

import { useState, useEffect, useRef } from 'react';
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
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupFunctionsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Önceki cleanup'ları temizle
      cleanupFunctionsRef.current.forEach((cleanup) => cleanup());
      cleanupFunctionsRef.current = [];
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        // Kullanıcı bilgilerini Firestore'dan al veya varsayılan değerler kullan
        if (!db) {
          setLoading(false);
          return;
        }
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userSnapshot = await getDoc(userDocRef);
        
        let displayName: string | null = null;
        let photoURL: string | null = null;
        
        if (firebaseUser.isAnonymous) {
          // Anonim kullanıcı: Firestore'dan displayName'i al (loginAnonymously'de kaydedilmiş olmalı)
          if (userSnapshot.exists()) {
            const userData = userSnapshot.data();
            displayName = userData.displayName || null;
            photoURL = userData.photoURL || null;
          }
        } else {
          // Google ile giriş yapıldıysa: Firebase Auth'tan gelen displayName'i kullan ve Firestore'a kaydet
          displayName = firebaseUser.displayName || null;
          photoURL = firebaseUser.photoURL || null;
          
          // Google'dan gelen bilgileri Firestore'a kaydet/güncelle
          if (db) {
            await setDoc(
              doc(db, 'users', firebaseUser.uid),
              {
                uid: firebaseUser.uid,
                displayName: displayName, // Google'dan gelen displayName'i her zaman kaydet
                photoURL: photoURL,
                email: firebaseUser.email || null,
                isAnonymous: false,
                lastSeen: serverTimestamp(),
                isOnline: true,
              },
              { merge: true }
            );
          }
        }
        
        // Online durumunu güncelle
        if (db) {
          const userRef = doc(db, 'users', firebaseUser.uid);
          
          // İlk online durumunu ayarla
          await setDoc(
            userRef,
            {
              lastSeen: serverTimestamp(),
              isOnline: true,
            },
            { merge: true }
          );

          // Online durumunu gerçek zamanlı güncelle
          const onlineRef = doc(db, 'users', firebaseUser.uid, 'presence', 'online');
          await setDoc(onlineRef, { isOnline: true }, { merge: true });

          // Düzenli olarak lastSeen güncelle (heartbeat)
          heartbeatIntervalRef.current = setInterval(async () => {
            if (db && typeof document !== 'undefined' && document.visibilityState === 'visible') {
              try {
                await setDoc(
                  userRef,
                  {
                    lastSeen: serverTimestamp(),
                    isOnline: true,
                  },
                  { merge: true }
                );
              } catch (error) {
                console.error('Heartbeat error:', error);
              }
            }
          }, 30000); // 30 saniyede bir güncelle

          // Sayfa görünürlüğü değiştiğinde
          const handleVisibilityChange = async () => {
            if (db) {
              if (document.visibilityState === 'visible') {
                // Sayfa görünür olduğunda online yap
                await setDoc(
                  userRef,
                  {
                    lastSeen: serverTimestamp(),
                    isOnline: true,
                  },
                  { merge: true }
                );
              } else {
                // Sayfa gizlendiğinde offline yap
                await setDoc(
                  userRef,
                  {
                    isOnline: false,
                    lastSeen: serverTimestamp(),
                  },
                  { merge: true }
                );
              }
            }
          };

          // Sayfa kapatıldığında offline yap
          const handleBeforeUnload = () => {
            if (db) {
              // beforeunload'da async işlemler garanti çalışmaz ama denemeye değer
              setDoc(
                userRef,
                { isOnline: false, lastSeen: serverTimestamp() },
                { merge: true }
              ).catch(() => {});
            }
          };

          // Pagehide event'i (daha güvenilir)
          const handlePageHide = () => {
            if (db) {
              setDoc(
                userRef,
                { isOnline: false, lastSeen: serverTimestamp() },
                { merge: true }
              ).catch(() => {});
            }
          };

          if (typeof window !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('beforeunload', handleBeforeUnload);
            window.addEventListener('pagehide', handlePageHide);

            // Cleanup function'ları sakla
            cleanupFunctionsRef.current.push(() => {
              if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
              }
              document.removeEventListener('visibilitychange', handleVisibilityChange);
              window.removeEventListener('beforeunload', handleBeforeUnload);
              window.removeEventListener('pagehide', handlePageHide);
              
              // Component unmount olduğunda offline yap
              if (db) {
                setDoc(
                  userRef,
                  { isOnline: false, lastSeen: serverTimestamp() },
                  { merge: true }
                ).catch(() => {});
              }
            });
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Tüm cleanup function'ları çalıştır
      cleanupFunctionsRef.current.forEach((cleanup) => cleanup());
      cleanupFunctionsRef.current = [];
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
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
      if (result.user && db) {
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(
          userRef,
          {
            uid: result.user.uid,
            displayName: username.trim(),
            photoURL: generateAvatar(username.trim(), 40),
            isAnonymous: true,
            lastSeen: serverTimestamp(),
            isOnline: true,
            email: null,
          },
          { merge: true }
        );
        
        // Online durumunu gerçek zamanlı güncelle
        const onlineRef = doc(db, 'users', result.user.uid, 'presence', 'online');
        await setDoc(onlineRef, { isOnline: true }, { merge: true });
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
