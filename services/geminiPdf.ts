
import { GoogleGenAI } from "@google/genai";

// SỬ DỤNG MODEL FLASH ĐỂ TRÁNH TIMEOUT TRÊN VERCEL (Gói Hobby giới hạn 10s)
// gemini-2.0-flash-exp xử lý Vision cực nhanh (<3s) so với Pro (>15s)
const MODEL_NAME = 'gemini-2.0-flash-exp';

// --- KEY MANAGEMENT SYSTEM (Đồng bộ logic với geminiScraper.ts) ---

let currentKeyIndex = 0;
let keyList: string[] = [];

const getKeys = (): string[] => {
  // 1. Kiểm tra LocalStorage (User tự nhập trong Cài đặt)
  if (typeof window !== 'undefined') {
      const localKey = localStorage.getItem('USER_GEMINI_API_KEY');
      if (localKey && localKey.length > 10) {
          const rawKeys = localKey.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 10);
          if (rawKeys.length > 0) {
              // Nếu danh sách key thay đổi, reset lại cache
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

const getAIClient = () => {
    const keys = getKeys();
    if (keys.length === 0) throw new Error("MISSING_API_KEY");
    
    // Lấy key theo vòng tròn
    const keyIndex = currentKeyIndex % keys.length;
    const key = keys[keyIndex];
    
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
  const maxAttempts = 3; // Thử tối đa 3 key khác nhau

  while (attempts < maxAttempts) {
    try {
        const ai = getAIClient();
        
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
            // Giới hạn token để phản hồi nhanh hơn
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
        attempts++;
        console.warn(`PDF Extract Error (Attempt ${attempts}):`, error);
        
        const msg = String(error.message || error);
        
        // Kiểm tra các lỗi liên quan đến Key hoặc Rate Limit
        const isKeyError = 
            msg.includes('429') || 
            msg.includes('400') || 
            msg.includes('API key') || 
            msg.includes('quota') ||
            msg.includes('RESOURCE_EXHAUSTED');

        if (isKeyError) {
            // Nếu còn key khác, xoay vòng và thử lại
            if (rotateKey()) {
                await new Promise(r => setTimeout(r, 1000)); // Đợi 1s trước khi thử lại
                continue;
            }
        }
        
        // Nếu đã hết lượt thử hoặc lỗi không phải do key
        if (attempts >= maxAttempts) {
            if (msg.includes("MISSING_API_KEY")) {
                 return `<div class="text-red-500 font-bold p-4 border border-red-200 bg-red-50 rounded">
                    Lỗi: Chưa cấu hình API Key.<br/>
                    Vui lòng bấm nút <b>KEY</b> ở góc trên bên phải để nhập API Key.
                </div>`;
            }
            return `<div class="text-red-500 font-bold">Lỗi trích xuất: ${msg.substring(0, 100)}... (Vui lòng thử lại hoặc giảm dung lượng ảnh)</div>`;
        }
    }
  }

  return "<p><i>(Lỗi kết nối không xác định)</i></p>";
};
