import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBfDM_7iDeSzIuTdKRZsK7Bqm8zDQs_ECA",
  authDomain: "netrex-9cedd.firebaseapp.com",
  projectId: "netrex-9cedd",
  storageBucket: "netrex-9cedd.firebasestorage.app",
  messagingSenderId: "249850262852",
  appId: "1:249850262852:web:c2754e6cd1db6c7bf31311",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const ADMIN_EMAIL = "sigortataciri@gmail.com";
