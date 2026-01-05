
import { GoogleGenAI } from "@google/genai";

// Using gemini-3-pro-preview as requested for high quality vision tasks
const MODEL_NAME = 'gemini-3-pro-preview';

export const analyzePdfPage = async (base64Image: string, targetLanguage?: string): Promise<string> => {
  try {
    // Initialize with the environment API key as per system requirements
    // Note: Assuming process.env.API_KEY is available globally as configured in vite.config.ts
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    // Support splitting multiple keys if provided in the app context, but for simplicity here we use the first valid one or the env one directly.
    // In the main app, we manage keys via local storage too. For this service, we'll try to grab from localStorage if available to match app behavior, or fallback to env.
    
    let activeKey = apiKey;
    const localKeys = localStorage.getItem('USER_GEMINI_API_KEY');
    if (localKeys) {
        const keys = localKeys.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 10);
        if (keys.length > 0) activeKey = keys[0]; // Simple usage of first key
    }

    const ai = new GoogleGenAI({ apiKey: activeKey });

    let taskDescription = "Trích xuất chính xác văn bản tiếng Việt hoặc tiếng Anh trong hình.";
    if (targetLanguage) {
      taskDescription = `Trích xuất văn bản trong hình và DỊCH TOÀN BỘ nội dung sang ngôn ngữ: ${targetLanguage}. Đảm bảo dịch mượt mà, tự nhiên và chính xác ngữ cảnh.`;
    }

    const prompt = `
      Bạn là một chuyên gia OCR, xử lý văn bản và dịch thuật đa ngôn ngữ. Nhiệm vụ của bạn là trích xuất nội dung từ hình ảnh trang tài liệu PDF scan này.
      
      Yêu cầu cụ thể:
      1. ${taskDescription}
      2. Giữ nguyên cấu trúc định dạng của văn bản gốc bằng cách sử dụng các thẻ HTML ngữ nghĩa (ví dụ: <h1>, <h2> cho tiêu đề, <p> cho đoạn văn, <table> cho bảng biểu, <ul>/<li> cho danh sách).
      3. KHÔNG sử dụng thẻ <html>, <head>, hay <body>. Chỉ trả về nội dung bên trong body.
      4. KHÔNG bọc kết quả trong markdown code blocks (như \`\`\`html). Trả về chuỗi HTML thô.
      5. Nếu ảnh mờ hoặc không có chữ, hãy trả về một thẻ <p><i>(Không tìm thấy văn bản hoặc ảnh quá mờ)</i></p>.
      6. LƯU Ý QUAN TRỌNG: Chỉ dịch nội dung văn bản hiển thị, KHÔNG dịch tên thẻ HTML (tags), tên class hoặc id.
    `;

    // Remove header prefix if present (e.g., "data:image/png;base64,")
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
        ]
      }
    });

    let text = response.text || "";
    
    // Clean up markdown code blocks if present
    text = text.replace(/^```html\s*/i, '').replace(/```$/, '');
    
    if (!text.trim()) {
       return "<p><i>(AI trả về nội dung rỗng)</i></p>";
    }

    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `<div class="text-red-500 font-bold">Lỗi khi xử lý trang này: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
};
