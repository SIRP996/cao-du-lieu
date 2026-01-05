
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDNP5c6o2wk4LEJhpk6_lxw0HtyNAnhgxs",
  authDomain: "super-scraper-pro.firebaseapp.com",
  projectId: "super-scraper-pro",
  storageBucket: "super-scraper-pro.firebasestorage.app",
  messagingSenderId: "967333664706",
  appId: "1:967333664706:web:2a182a2d8a3c7521c0285b",
  measurementId: "G-HWQKMXLE6C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services (Modular SDK)
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Initialize Analytics conditionally
export let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch(console.error);

export default app;
