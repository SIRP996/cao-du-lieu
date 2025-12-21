import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../firebase/config';
import firebase from 'firebase/compat/app';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

interface AuthContextType {
  currentUser: firebase.User | null;
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
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [longLoading, setLongLoading] = useState(false);

  useEffect(() => {
    // Cơ chế an toàn: Nếu sau 8 giây mà Firebase chưa phản hồi, tự động tắt loading để hiện Login
    const safetyTimer = setTimeout(() => {
        setLongLoading(true);
        // Nếu vẫn đang loading thật sự thì force stop sau 10s
        setTimeout(() => setLoading(false), 2000); 
    }, 8000);

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setLoading(false);
      clearTimeout(safetyTimer);
    });
    return unsubscribe;
  }, []);

  const loginGoogle = async () => {
    await auth.signInWithPopup(googleProvider);
  };

  const loginEmail = async (email: string, pass: string) => {
    await auth.signInWithEmailAndPassword(email, pass);
  };

  const signupEmail = async (email: string, pass: string) => {
    await auth.createUserWithEmailAndPassword(email, pass);
  };

  const logout = async () => {
    await auth.signOut();
  };

  const value = {
    currentUser,
    loading,
    loginGoogle,
    loginEmail,
    signupEmail,
    logout
  };

  // Màn hình Loading SIÊU CẤP (z-index 9999 để đè lên mọi thứ)
  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900 gap-6 animate-in fade-in duration-500">
        <div className="relative">
           <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
           <div className="relative z-10 bg-indigo-500/10 p-4 rounded-full">
               <ShieldCheck className="w-16 h-16 text-indigo-500" />
           </div>
        </div>
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] animate-pulse">
              {longLoading ? "Đang kết nối máy chủ..." : "Khởi động Super Scraper..."}
            </p>
            {longLoading && (
                <p className="text-amber-500 text-[10px] flex items-center gap-2 mt-2">
                    <AlertTriangle className="w-3 h-3" /> Mạng có vẻ chậm, vui lòng đợi chút...
                </p>
            )}
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};