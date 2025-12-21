import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Cpu, Mail, Lock, LogIn, Chrome } from 'lucide-react';

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
      setError(err.message.replace('Firebase:', '').trim());
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] p-8 md:p-12 w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        
        <div className="text-center mb-8">
          <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
             <Cpu className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Super Scraper Pro</h1>
          <p className="text-slate-500 text-sm font-medium mt-2">Đăng nhập để đồng bộ & theo dõi giá</p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-500 p-4 rounded-xl text-sm font-bold mb-6 border border-rose-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-slate-700"
                placeholder="name@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-slate-700"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            disabled={loading}
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-slate-800 transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
          >
            {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng Nhập' : 'Đăng Ký')} <LogIn className="w-4 h-4" />
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
          <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest"><span className="bg-white px-4 text-slate-300">Hoặc</span></div>
        </div>

        <button 
          type="button"
          onClick={handleGoogle}
          className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
        >
          <Chrome className="w-5 h-5 text-rose-500" /> Tiếp tục với Google
        </button>

        <p className="text-center mt-8 text-xs font-medium text-slate-400">
          {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-600 font-bold hover:underline">
            {isLogin ? "Đăng ký ngay" : "Đăng nhập ngay"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;