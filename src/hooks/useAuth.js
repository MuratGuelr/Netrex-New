import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Firestore'dan kullanıcı bilgilerini al (anonim kullanıcılar için displayName burada saklanır)
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        const userData = userDoc.data();

        // Kullanıcı objesini oluştur (anonim kullanıcılar için displayName Firestore'dan gelir)
        const userWithDisplayName = {
          ...firebaseUser,
          displayName:
            userData?.displayName || firebaseUser.displayName || "Misafir",
          photoURL: userData?.photoURL || firebaseUser.photoURL || null,
        };

        setUser(userWithDisplayName);

        // Kullanıcı bilgilerini Firestore'a kaydet
        await setDoc(
          doc(db, "users", firebaseUser.uid),
          {
            uid: firebaseUser.uid,
            displayName:
              userData?.displayName || firebaseUser.displayName || "Misafir",
            photoURL: userData?.photoURL || firebaseUser.photoURL || null,
            lastSeen: serverTimestamp(),
            email: firebaseUser.email || null,
            isAnonymous: firebaseUser.isAnonymous || false,
            isOnline: true,
          },
          { merge: true }
        );

        // Online durumunu gerçek zamanlı güncelle
        const onlineRef = doc(
          db,
          "users",
          firebaseUser.uid,
          "presence",
          "online"
        );
        await setDoc(onlineRef, { isOnline: true }, { merge: true });

        // Kullanıcı kapandığında offline yap
        window.addEventListener("beforeunload", async () => {
          await setDoc(
            doc(db, "users", firebaseUser.uid),
            { isOnline: false, lastSeen: serverTimestamp() },
            { merge: true }
          );
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginAnonymously = async (username) => {
    if (!username || username.trim().length === 0) {
      throw new Error("Kullanıcı adı gerekli");
    }

    if (username.trim().length < 2) {
      throw new Error("Kullanıcı adı en az 2 karakter olmalı");
    }

    if (username.trim().length > 20) {
      throw new Error("Kullanıcı adı en fazla 20 karakter olabilir");
    }

    // Anonim giriş yap
    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;

    // Kullanıcı adını Firestore'a kaydet
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        displayName: username.trim(),
        photoURL: null,
        lastSeen: serverTimestamp(),
        email: null,
        isAnonymous: true,
        isOnline: true,
      },
      { merge: true }
    );

    // Online durumunu gerçek zamanlı güncelle
    const onlineRef = doc(db, "users", user.uid, "presence", "online");
    await setDoc(onlineRef, { isOnline: true }, { merge: true });
  };

  const logout = async () => {
    if (user) {
      await setDoc(
        doc(db, "users", user.uid),
        {
          lastSeen: serverTimestamp(),
          isOnline: false,
        },
        { merge: true }
      );
    }
    localStorage.removeItem("lastChannel");
    await signOut(auth);
  };

  return { user, loading, login, loginAnonymously, logout };
}
