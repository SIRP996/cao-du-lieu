import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường (bao gồm API_KEY từ Vercel)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Quan trọng: Inject process.env.API_KEY vào client-side. Thêm || "" để tránh lỗi undefined
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ""),
      // Polyfill an toàn cho process.env nếu có thư viện bên thứ 3 sử dụng
      'process.env': JSON.stringify({}) 
    },
    server: {
      port: 3000
    }
  };
});