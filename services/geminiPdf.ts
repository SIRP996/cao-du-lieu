
import { GoogleGenAI } from "@google/genai";

// SỬ DỤNG MODEL FLASH ĐỂ TRÁNH TIMEOUT TRÊN VERCEL
// gemini-2.0-flash-exp là model nhanh nhất hiện tại cho tác vụ Vision (OCR)
const MODEL_NAME = 'gemini-2.0-flash-exp';

// --- KEY MANAGEMENT SYSTEM ---

let currentKeyIndex = 0;
let keyList: string[] = [];

const getKeys = (): string[] => {
  // 1. Kiểm tra LocalStorage (User tự nhập trong Cài đặt)
  if (typeof window !== 'undefined') {
      const localKey = localStorage.getItem('USER_GEMINI_API_KEY');
      if (localKey && localKey.length > 10) {
          const rawKeys = localKey.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 10);
          if (rawKeys.length > 0) {
              if (JSON.stringify(rawKeys) !== JSON.stringify(keyList)) {
                  keyList = rawKeys;
                  currentKeyIndex = 0;
              }
              return keyList;
          }
      }
  }

  // 2. Fallback sang biến môi trường
  if (keyList.length > 0) return keyList;

  const envKey = process.env.API_KEY || "";
  const keys = envKey.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 10);
  keyList = keys;
  return keys;
};

// Hàm lấy Client mới với key hiện tại (luôn gọi lại hàm này mỗi lần request)
const createAIClient = () => {
    const keys = getKeys();
    if (keys.length === 0) throw new Error("MISSING_API_KEY");
    
    // Lấy key theo vòng tròn
    const keyIndex = currentKeyIndex % keys.length;
    const key = keys[keyIndex];
    
    // console.log(`Using Key [${keyIndex}]: ...${key.slice(-4)}`);
    return new GoogleGenAI({ apiKey: key });
};

const rotateKey = (): boolean => {
    const keys = getKeys();
    if (keys.length <= 1) return false;
    
    const prevIndex = currentKeyIndex;
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    console.warn(`🔄 PDF Service: Chuyển từ Key #${prevIndex + 1} sang Key #${currentKeyIndex + 1}`);
    return true;
};

// --- MAIN FUNCTION ---

export const analyzePdfPage = async (base64Image: string, targetLanguage?: string): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 3; // Thử tối đa 3 lần

  while (attempts < maxAttempts) {
    try {
        attempts++;
        const ai = createAIClient();
        
        let taskDescription = "Trích xuất TOÀN BỘ văn bản trong hình.";
        if (targetLanguage) {
          taskDescription = `Trích xuất văn bản và DỊCH sang: ${targetLanguage}.`;
        }

        const prompt = `
          Nhiệm vụ: OCR & Convert to HTML.
          1. ${taskDescription}
          2. Output: HTML thô (không markdown, không thẻ html/body). Chỉ dùng thẻ <h2>, <p>, <ul>, <table>.
          3. Giữ nguyên bố cục bảng biểu (table) nếu có.
          4. Nếu ảnh mờ hoặc không có chữ, trả về: <p><i>(Không có nội dung)</i></p>
        `;

        // Clean base64 header if exists
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
              { text: prompt }
            ]
          },
          config: {
            maxOutputTokens: 8000, 
            temperature: 0.1, 
          }
        });

        let text = response.text || "";
        // Clean markdown code blocks
        text = text.replace(/^```html\s*/i, '').replace(/```$/, '');
        
        if (!text.trim()) return "<p><i>(AI trả về nội dung rỗng)</i></p>";
        
        return text;

    } catch (error: any) {
        console.warn(`PDF Extract Error (Attempt ${attempts}/${maxAttempts}):`, error);
        
        const msg = String(error.message || error);
        
        // Kiểm tra các lỗi liên quan đến Key hoặc Rate Limit
        const isKeyError = 
            msg.includes('429') || 
            msg.includes('400') || 
            msg.includes('API key') || 
            msg.includes('quota') ||
            msg.includes('RESOURCE_EXHAUSTED') ||
            msg.includes('fetch failed') || // Mạng lỗi cũng nên đổi key/thử lại
            msg.includes('Load failed');

        // Logic Retry
        let shouldRetry = false;
        
        // Nếu lỗi Key -> Xoay Key -> Retry
        if (isKeyError) {
             if (rotateKey()) {
                 shouldRetry = true;
             } else {
                 // Nếu chỉ có 1 key mà lỗi 429/mạng -> Retry luôn với key đó (hy vọng mạng ổn)
                 shouldRetry = true; 
             }
        } else {
            // Lỗi khác (Server error 500, 503...) -> Cũng retry
             shouldRetry = true;
        }

        // Nếu còn lượt thử và quyết định retry
        if (shouldRetry && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 1500)); // Đợi 1.5s
            continue; // Quay lại đầu vòng lặp
        }
        
        // --- NẾU KHÔNG RETRY ĐƯỢC NỮA -> TRẢ VỀ LỖI ---
        
        if (msg.includes("MISSING_API_KEY")) {
             return `<div class="text-red-500 font-bold p-4 border border-red-200 bg-red-50 rounded">
                Lỗi: Chưa cấu hình API Key.<br/>
                Vui lòng bấm nút <b>KEY</b> ở góc trên bên phải để nhập API Key.
            </div>`;
        }

        // Trả về lỗi chi tiết thay vì chuỗi chung chung
        return `<div class="p-4 bg-red-50 border border-red-100 rounded text-sm text-red-600">
            <strong>Lỗi trích xuất (Thử ${attempts}/${maxAttempts}):</strong><br/>
            ${msg.substring(0, 150)}...
            <br/><br/>
            <i>Gợi ý: Thử lại hoặc giảm dung lượng ảnh/PDF.</i>
        </div>`;
    }
  }

  // Fallback cuối cùng nếu vòng lặp thoát bất thường (hiếm khi xảy ra với logic trên)
  return "<p><i>(Lỗi kết nối: Đã hết lượt thử lại)</i></p>";
};
