import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường (bao gồm API_KEY từ Vercel)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Quan trọng: Inject process.env.API_KEY vào client-side để SDK hoạt động
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill process.env cho các thư viện khác nếu cần
      'process.env': {} 
    },
    server: {
      port: 3000
    }
  };
});