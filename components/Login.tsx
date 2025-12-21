import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Cpu, Mail, Lock, LogIn, ArrowRight } from 'lucide-react';

const Login = () => {
  const { loginGoogle, loginEmail, signupEmail } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await loginEmail(email, password);
      } else {
        await signupEmail(email, password);
      }
    } catch (err: any) {
      // Xử lý thông báo lỗi thân thiện hơn
      let msg = err.message;
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) msg = "Email hoặc mật khẩu không đúng.";
      else if (msg.includes('auth/email-already-in-use')) msg = "Email này đã được đăng ký.";
      else if (msg.includes('auth/weak-password')) msg = "Mật khẩu quá yếu (cần > 6 ký tự).";
      else msg = msg.replace('Firebase:', '').trim();
      
      setError(msg);
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    try {
      await loginGoogle();
    } catch (err: any) {
      setError("Lỗi đăng nhập Google: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-rose-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 w-full max-w-md shadow-2xl relative overflow-hidden z-10 animate-in fade-in zoom-in duration-500 border border-white/20">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
        
        <div className="text-center mb-10">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/30 transform rotate-3 hover:rotate-6 transition-all duration-300 group cursor-pointer">
             <Cpu className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Super Scraper <span className="text-indigo-600">Pro</span></h1>
          <p className="text-slate-500 text-xs font-bold mt-2 tracking-[0.2em] uppercase">Hệ thống phân tích giá & AI</p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold mb-6 border border-rose-100 flex items-center gap-3 animate-in slide-in-from-top-2">
            <span className="block w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse"></span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300 text-sm"
                placeholder="admin@superscraper.vn"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Mật khẩu</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300 text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            disabled={loading}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-200/50 transition-all active:scale-95 flex items-center justify-center gap-3 mt-4 group"
          >
            {loading ? <span className="animate-pulse">Đang xử lý...</span> : (
                <>{isLogin ? 'Truy cập hệ thống' : 'Đăng ký tài khoản'} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
            )}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span className="bg-white px-4 text-slate-300">Hoặc</span></div>
        </div>

        <button 
          type="button"
          onClick={handleGoogle}
          className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-sm"
        >
          {/* Google Logo SVG */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Đăng nhập bằng Google
        </button>

        <p className="text-center mt-8 text-xs font-medium text-slate-400">
          {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-600 font-black hover:underline ml-1 uppercase tracking-wide">
            {isLogin ? "Đăng ký ngay" : "Đăng nhập ngay"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;