
import { GoogleGenAI } from "@google/genai";

// DANH SÁCH MODEL ƯU TIÊN (STABLE LIST)
// Lưu ý: Không dùng 'latest', 'preview' hay phiên bản ảo (2.5) để tránh lỗi 404 trên Production.
// 1. gemini-2.0-flash: Model nhanh nhất, mới nhất hiện tại.
// 2. gemini-1.5-flash: Bản ổn định tiêu chuẩn.
// 3. gemini-1.5-pro: Bản mạnh nhất (fallback nếu Flash không đọc được chữ mờ).
const MODELS_TO_TRY = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

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
            
            let taskDescription = "Extract ALL text from the image verbatim.";
            if (targetLanguage) {
              taskDescription = `Extract text and TRANSLATE to: ${targetLanguage}.`;
            }

            // PROMPT CỰC KỲ CHI TIẾT ĐỂ ÉP KIỂU BẢNG BIỂU (STRICT TABLE MODE)
            const prompt = `
              Role: You are a high-accuracy OCR engine specialized in complex data tables.
              Task: ${taskDescription}
              
              STRICT OUTPUT RULES:
              1. Format output as a valid HTML <table> with borders (border="1").
              2. DO NOT SKIP ANY ROWS. Extract every single row you see in the image.
              3. DO NOT MERGE CELLS incorrectly. Preserve the exact column structure.
              4. If a cell is empty in the image, output <td></td>. Do not omit the cell.
              5. Ensure header row (<th>) aligns perfectly with data rows (<td>).
              6. Return ONLY the HTML code. No markdown code blocks (\`\`\`html), no introductory text.
              7. If the image contains a list, use <ul>. If it's paragraphs, use <p>.
              
              CRITICAL:
              - Look closely at price columns and numbers. Extract them exactly.
              - Do not hallucinate data that is not there.
              - If the image is blurry, do your best to infer from context but mark uncertain parts with [?].
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
                temperature: 0.0, // QUAN TRỌNG: 0.0 để AI không "sáng tạo" thêm bớt dữ liệu
                topP: 0.8,
                topK: 40
              }
            });

            let text = response.text || "";
            // Clean markdown code blocks if AI still adds them
            text = text.replace(/^```html\s*/i, '').replace(/```$/, '').trim();
            
            if (!text) return "<p><i>(AI trả về nội dung rỗng)</i></p>";
            
            return text; // THÀNH CÔNG -> Trả về ngay

        } catch (error: any) {
            const msg = String(error.message || error);
            console.warn(`PDF Extract Error (${modelName} - Try ${i+1}):`, msg);
            lastErrorMsg = msg;

            // Phân loại lỗi
            const isKeyError = 
                msg.includes('429') || 
                msg.includes('400') || 
                msg.includes('API key') || 
                msg.includes('quota') || 
                msg.includes('check your API key');

            // Các lỗi liên quan đến Model
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
                     continue; // Thử lại với key mới
                 }
            }
            
            // Nếu lỗi Model -> Chuyển ngay sang Model tiếp theo
            if (isModelError) {
                // Log để debug xem model nào bị lỗi
                console.error(`Model ${modelName} died:`, msg);
                break; 
            }
            
            await new Promise(r => setTimeout(r, 1500));
        }
      }
  }

  // Nếu chạy hết vòng lặp mà vẫn lỗi
  return `<div class="p-4 bg-red-50 border border-red-100 rounded text-sm text-red-600">
      <strong>Lỗi trích xuất (Thất bại sau ${attempts} lần thử):</strong><br/>
      <div class="mt-2 p-2 bg-white rounded border border-red-200 font-mono text-xs text-red-500 break-words">
        ${lastErrorMsg.substring(0, 300)}...
      </div>
      <br/>
      <i>Gợi ý: Kiểm tra lại API Key, kết nối mạng hoặc thử lại.</i>
  </div>`;
};
