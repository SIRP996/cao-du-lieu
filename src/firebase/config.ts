import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/analytics';

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

// Initialize Firebase (Check if already initialized for HMR)
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Initialize services (v8 instances)
export const auth = firebase.auth();
export const googleProvider = new firebase.auth.GoogleAuthProvider();
export const db = firebase.firestore();
export const analytics = firebase.analytics();

export default app;