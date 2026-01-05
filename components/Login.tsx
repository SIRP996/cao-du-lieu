
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

const Login = () => {
  const { loginGoogle, loginEmail, signupEmail } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      let msg = err.message;
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) msg = "Thông tin đăng nhập không đúng.";
      else if (msg.includes('auth/email-already-in-use')) msg = "Email này đã được sử dụng.";
      else if (msg.includes('auth/weak-password')) msg = "Mật khẩu quá yếu (> 6 ký tự).";
      else msg = msg.replace('Firebase:', '').trim();
      
      setError(msg);
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    try {
      await loginGoogle();
    } catch (err: any) {
      setError("Lỗi Google: " + err.message);
    }
  };

  return (
    <div className="font-display bg-slate-900 text-white min-h-screen relative overflow-hidden selection:bg-primary selection:text-slate-900 flex items-center justify-center p-4">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/30 blur-[100px] animate-float"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-rose-600/20 blur-[100px] animate-float-delayed"></div>
        <div className="absolute top-[20%] right-[20%] w-[300px] h-[300px] rounded-full bg-[#13ec6a]/10 blur-[80px]"></div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-6 right-6 z-50 animate-shake">
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/50 backdrop-blur-md px-4 py-3 rounded-lg shadow-lg">
            <AlertTriangle className="text-red-400 w-5 h-5" />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-red-100">Lỗi Đăng Nhập</span>
              <span className="text-xs text-red-200">{error}</span>
            </div>
          </div>
        </div>
      )}

      {/* Auth Container */}
      <div className="relative z-10 w-full max-w-[440px] bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] rounded-3xl p-8 sm:p-10 flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="group/logo cursor-pointer">
            <div className="text-primary w-12 h-12 transition-transform duration-500 group-hover/logo:rotate-180">
              <svg fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4H20V20H4V4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                <path d="M9 9H15V15H9V9Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                <path d="M9 1V4" stroke="currentColor" strokeLinecap="round" strokeWidth="2"></path>
                <path d="M15 1V4" stroke="currentColor" strokeLinecap="round" strokeWidth="2"></path>
                <path d="M9 20V23" stroke="currentColor" strokeLinecap="round" strokeWidth="2"></path>
                <path d="M15 20V23" stroke="currentColor" strokeLinecap="round" strokeWidth="2"></path>
                <path d="M20 9H23" stroke="currentColor" strokeLinecap="round" strokeWidth="2"></path>
                <path d="M20 14H23" stroke="currentColor" strokeLinecap="round" strokeWidth="2"></path>
                <path d="M1 9H4" stroke="currentColor" strokeLinecap="round" strokeWidth="2"></path>
                <path d="M1 14H4" stroke="currentColor" strokeLinecap="round" strokeWidth="2"></path>
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              {isLogin ? 'Enter your credentials to access market intelligence.' : 'Join the ultimate data scraping platform.'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email Input */}
          <label className="flex flex-col gap-2">
            <span className="text-slate-300 text-sm font-semibold pl-1">Email Address</span>
            <div className="flex w-full items-center rounded-xl bg-slate-800/50 border border-slate-700/50 focus-within:bg-slate-800 focus-within:shadow-[0_0_10px_rgba(19,236,106,0.2)] focus-within:border-[#13ec6a] transition-all h-12 px-4 group">
              <Mail className="text-slate-500 group-focus-within:text-primary transition-colors w-5 h-5" />
              <input 
                className="w-full bg-transparent border-none text-white placeholder-slate-500 focus:ring-0 text-sm px-3 outline-none font-medium" 
                placeholder="analyst@datascout.ai" 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>

          {/* Password Input */}
          <label className="flex flex-col gap-2">
            <div className="flex justify-between items-center pl-1 pr-1">
              <span className="text-slate-300 text-sm font-semibold">Password</span>
              {isLogin && <a className="text-primary text-xs font-bold hover:underline cursor-pointer">Forgot password?</a>}
            </div>
            <div className="flex w-full items-center rounded-xl bg-slate-800/50 border border-slate-700/50 focus-within:bg-slate-800 focus-within:shadow-[0_0_10px_rgba(19,236,106,0.2)] focus-within:border-[#13ec6a] transition-all h-12 px-4 group">
              <Lock className="text-slate-500 group-focus-within:text-primary transition-colors w-5 h-5" />
              <input 
                className="w-full bg-transparent border-none text-white placeholder-slate-500 focus:ring-0 text-sm px-3 outline-none font-medium" 
                placeholder="••••••••" 
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-500 hover:text-white transition-colors flex items-center justify-center outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </label>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 bg-primary hover:bg-[#0fd65e] text-slate-900 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(19,236,106,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span className="truncate">{loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}</span>
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-700"></div>
          <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-medium uppercase tracking-wider">Or continue with</span>
          <div className="flex-grow border-t border-slate-700"></div>
        </div>

        {/* Social Login */}
        <button 
          type="button"
          onClick={handleGoogle}
          className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-full h-12 bg-white text-slate-900 hover:bg-slate-100 font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
          </svg>
          <span className="truncate">Google</span>
        </button>

        {/* Footer Meta */}
        <div className="text-center">
          <p className="text-slate-400 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:text-[#5cfc9d] font-semibold underline decoration-transparent hover:decoration-primary transition-all outline-none"
            >
              {isLogin ? 'Request Access' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
