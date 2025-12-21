import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường từ .env (nếu có) hoặc từ hệ thống (Vercel)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Quan trọng: Chỉ định cụ thể process.env.API_KEY
      // Không định nghĩa 'process.env': {} vì sẽ ghi đè biến trên
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ""),
    },
    server: {
      port: 3000
    }
  };
});