
import { GoogleGenAI } from "@google/genai";

// DANH SÁCH MODEL ƯU TIÊN (FALLBACK STRATEGY)
// 1. gemini-2.0-flash-exp: Tốc độ cao nhất, nhưng là bản thử nghiệm.
// 2. gemini-3-flash-preview: Bản chuẩn mới nhất (Thay thế cho 1.5 đã cũ).
const MODELS_TO_TRY = ['gemini-2.0-flash-exp', 'gemini-3-flash-preview'];

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

// Hàm lấy Client mới với key hiện tại
const createAIClient = (specificKey?: string) => {
    if (specificKey) return new GoogleGenAI({ apiKey: specificKey });

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
  // Tổng số lần thử = (Số model) x 2 lần retry mỗi model
  const maxAttempts = MODELS_TO_TRY.length * 2; 
  
  let lastErrorMsg = "";

  // Remove header prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  // Vòng lặp thử qua các Model và các Key
  for (const modelName of MODELS_TO_TRY) {
      // Mỗi model thử tối đa 2 lần (xoay key nếu cần)
      for (let i = 0; i < 2; i++) {
        attempts++;
        try {
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

            const response = await ai.models.generateContent({
              model: modelName,
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
            
            return text; // THÀNH CÔNG -> Trả về ngay

        } catch (error: any) {
            console.warn(`PDF Extract Error (${modelName} - Try ${i+1}):`, error);
            
            const msg = String(error.message || error);
            lastErrorMsg = msg;

            // Phân loại lỗi
            const isKeyError = 
                msg.includes('429') || 
                msg.includes('400') || 
                msg.includes('API key') || 
                msg.includes('quota') || 
                msg.includes('check your API key');

            // Các lỗi liên quan đến Model không tìm thấy hoặc server quá tải
            const isModelError = 
                msg.includes('404') || 
                msg.includes('not found') || 
                msg.includes('not supported') ||
                msg.includes('503') || 
                msg.includes('500') || 
                msg.includes('overloaded');

            if (msg.includes("MISSING_API_KEY")) {
                 return `<div class="text-red-500 font-bold p-4 border border-red-200 bg-red-50 rounded">
                    Lỗi: Chưa cấu hình API Key.<br/>
                    Vui lòng bấm nút <b>KEY</b> ở góc trên bên phải để nhập API Key.
                </div>`;
            }

            // XỬ LÝ RETRY
            if (isKeyError) {
                 if (rotateKey()) {
                     await new Promise(r => setTimeout(r, 1000));
                     continue; // Thử lại với key mới (cùng model)
                 }
            }
            
            // Nếu lỗi Model (404, 503...) -> Break vòng lặp con để chuyển ngay sang Model tiếp theo trong danh sách
            if (isModelError) {
                break; 
            }
            
            // Nếu lỗi khác (mạng chập chờn...), thử lại 1 lần rồi chuyển model
            await new Promise(r => setTimeout(r, 1500));
        }
      }
  }

  // Nếu chạy hết vòng lặp mà vẫn lỗi
  return `<div class="p-4 bg-red-50 border border-red-100 rounded text-sm text-red-600">
      <strong>Lỗi trích xuất (Thất bại sau ${attempts} lần thử):</strong><br/>
      <div class="mt-2 p-2 bg-white rounded border border-red-200 font-mono text-xs text-red-500 break-words">
        ${lastErrorMsg.substring(0, 300)}
      </div>
      <br/>
      <i>Gợi ý: Kiểm tra lại API Key, kết nối mạng hoặc thử ảnh khác rõ nét hơn.</i>
  </div>`;
};
