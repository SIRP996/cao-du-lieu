
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường từ .env (nếu có) hoặc từ hệ thống (Vercel)
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Logic lấy key linh hoạt: Ưu tiên API_KEY, sau đó VITE_API_KEY
  const apiKey = env.API_KEY || env.VITE_API_KEY || env.API_KEY_ONE || "";

  return {
    plugins: [react()],
    define: {
      // Inject key vào client code
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
    build: {
      target: 'esnext', // Quan trọng: Hỗ trợ cú pháp mới nhất cho pdfjs-dist
    },
    server: {
      port: 3000
    }
  };
});
