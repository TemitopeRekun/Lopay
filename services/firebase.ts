import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAOBO038w5ORRnBBS-mDIfG35qVvyrJ1As",
  authDomain: "lopay-auth.firebaseapp.com",
  projectId: "lopay-auth",
  storageBucket: "lopay-auth.firebasestorage.app",
  messagingSenderId: "891944287716",
  appId: "1:891944287716:web:e79cf39ed1fcc6d60e1bf1"
};

let app: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth>;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export { auth };