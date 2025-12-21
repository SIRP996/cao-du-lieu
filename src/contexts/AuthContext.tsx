import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../firebase/config';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  loginGoogle: () => Promise<void>;
  loginEmail: (e: string, p: string) => Promise<void>;
  signupEmail: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  return useContext(AuthContext)!;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const loginEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signupEmail = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    currentUser,
    loading,
    loginGoogle,
    loginEmail,
    signupEmail,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};