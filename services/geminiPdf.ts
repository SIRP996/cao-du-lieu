
import { GoogleGenAI } from "@google/genai";

// Sử dụng gemini-2.0-flash-exp cho tốc độ OCR nhanh nhất và hạn chế Timeout trên Vercel
// Model này xử lý Vision (Hình ảnh) rất tốt và nhẹ hơn dòng Pro
const MODEL_NAME = 'gemini-2.0-flash-exp';

// --- KEY MANAGEMENT SYSTEM (Đồng bộ với geminiScraper.ts) ---

const getKeys = (): string[] => {
  // 1. Ưu tiên lấy từ LocalStorage (Do người dùng nhập trong Cài đặt)
  const localKey = localStorage.getItem('USER_GEMINI_API_KEY');
  
  if (localKey && localKey.length > 10) {
      const rawKeys = localKey.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 10);
      if (rawKeys.length > 0) return rawKeys;
  }

  // 2. Fallback sang biến môi trường
  const envKey = process.env.API_KEY || "";
  const keys = envKey.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 10);
  
  return keys.length > 0 ? keys : [];
};

const getRandomKey = (excludeKey?: string): string => {
    const keys = getKeys();
    if (keys.length === 0) throw new Error("MISSING_API_KEY");
    
    if (keys.length === 1) return keys[0];
    
    // Nếu có key cần loại bỏ (do lỗi), chọn key khác ngẫu nhiên
    const available = excludeKey ? keys.filter(k => k !== excludeKey) : keys;
    if (available.length === 0) return keys[0]; // Quay lại key đầu nếu hết
    
    return available[Math.floor(Math.random() * available.length)];
};

export const analyzePdfPage = async (base64Image: string, targetLanguage?: string): Promise<string> => {
  let currentApiKey = "";
  
  try {
    currentApiKey = getRandomKey();
    
    // Retry Logic: Thử tối đa 2 lần (đổi key nếu lần đầu lỗi 429/400)
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const ai = new GoogleGenAI({ apiKey: currentApiKey });

            let taskDescription = "Trích xuất TOÀN BỘ văn bản trong hình.";
            if (targetLanguage) {
              taskDescription = `Trích xuất văn bản và DỊCH sang: ${targetLanguage}.`;
            }

            const prompt = `
              Nhiệm vụ: OCR & Convert to HTML.
              1. ${taskDescription}
              2. Output: HTML thô (không markdown). Dùng thẻ <h2>, <p>, <ul>, <table>.
              3. Giữ nguyên bố cục bảng biểu (table) nếu có.
              4. Nếu không có chữ, trả về: <p><i>(Không có nội dung)</i></p>
            `;

            // Remove header prefix if present
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
                // Giảm token output để phản hồi nhanh hơn, tránh timeout
                maxOutputTokens: 8000, 
                temperature: 0.2, // Giảm sáng tạo để tăng độ chính xác OCR
              }
            });

            let text = response.text || "";
            text = text.replace(/^```html\s*/i, '').replace(/```$/, '');
            
            if (!text.trim()) return "<p><i>(AI trả về nội dung rỗng)</i></p>";
            return text;

        } catch (innerError: any) {
            console.warn(`Attempt ${attempt + 1} failed with key ...${currentApiKey.slice(-4)}`);
            
            const msg = String(innerError.message || innerError);
            // Nếu lỗi liên quan đến Quota hoặc Key, thử đổi key khác
            if (msg.includes('429') || msg.includes('400') || msg.includes('API key')) {
                if (attempt < 1) {
                    currentApiKey = getRandomKey(currentApiKey);
                    continue; // Retry loop
                }
            }
            throw innerError; // Ném lỗi ra ngoài nếu không phải lỗi key hoặc đã hết lượt thử
        }
    }
    
    return "<p><i>(Lỗi kết nối sau nhiều lần thử)</i></p>";

  } catch (error) {
    console.error("Gemini OCR Error:", error);
    const errStr = String(error);
    if (errStr.includes("MISSING_API_KEY")) {
        return `<div class="text-red-500 font-bold p-4 border border-red-200 bg-red-50 rounded">
            Lỗi: Chưa cấu hình API Key.<br/>
            Vui lòng bấm nút <b>KEY</b> ở góc trên bên phải để nhập API Key.
        </div>`;
    }
    return `<div class="text-red-500 font-bold">Lỗi xử lý: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
};
