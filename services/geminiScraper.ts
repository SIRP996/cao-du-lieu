
import { GoogleGenAI, Type } from "@google/genai";
import { ProductData, StoreResult } from "../types";

// --- KEY ROTATION SYSTEM ---

let currentKeyIndex = 0;
let keyList: string[] = [];

const getKeys = (): string[] => {
  const localKey = localStorage.getItem('USER_GEMINI_API_KEY');
  
  if (localKey && localKey.length > 10) {
      const rawKeys = localKey.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 10);
      if (rawKeys.length > 0) {
          if (JSON.stringify(rawKeys) !== JSON.stringify(keyList)) {
              console.log(`🔑 Key loaded from LocalStorage: ${rawKeys.length}`);
              keyList = rawKeys;
              currentKeyIndex = 0;
          }
          return keyList;
      }
  }

  if (keyList.length > 0) return keyList;

  const envKey = process.env.API_KEY || "";
  const keys = envKey.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 10);
  
  if (keys.length === 0) return []; 

  console.log(`✅ Key loaded from Env: ${keys.length}`);
  keyList = keys;
  return keys;
};

const getAIClient = () => {
  const keys = getKeys();
  if (keys.length === 0) throw new Error("MISSING_API_KEY");
  const keyIndex = currentKeyIndex % keys.length;
  return new GoogleGenAI({ apiKey: keys[keyIndex] });
};

const rotateKey = (): boolean => {
  const keys = getKeys();
  if (keys.length <= 1) return false;
  const prevIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  console.warn(`🔄 Auto-Rotate: Key #${prevIndex + 1} -> #${currentKeyIndex + 1}`);
  return true;
};

// DANH SÁCH TÊN CHUẨN (OFFICIAL DICTIONARY)
const OFFICIAL_NAMES = [
  "Nước tẩy trang sen Hậu Giang 140ml",
  "Nước tẩy trang sen Hậu Giang 500ml",
  "Dầu tẩy trang hoa hồng 310ml",
  "Nước tẩy trang hoa hồng 310ml",
  "Nước tẩy trang hoa hồng 140ml",
  "Dầu tẩy trang hoa hồng 140ml",
  "Nước tẩy trang bí đao 500ml",
  "Nước tẩy trang bí đao 140ml",
  "Sữa rửa mặt sen Hậu Giang 310ml",
  "Gel rửa mặt cà phê Đắk Lắk 310ml",
  "Gel rửa mặt cà phê Đắk Lắk 140ml",
  "Sữa rửa mặt nghệ Hưng Yên 310ml",
  "Sữa rửa mặt nghệ Hưng Yên 140ml",
  "Gel rửa mặt hoa hồng 140ml",
  "Gel bí đao rửa mặt 310ml",
  "Gel bí đao rửa mặt 140ml",
  "Nước sen Hậu Giang 500ml",
  "Nước sen Hậu Giang 310ml",
  "Nước sen Hậu Giang 140ml",
  "Nước nghệ Hưng Yên 310ml",
  "Nước nghệ Hưng Yên 140ml",
  "Nước bí đao cân bằng da 310ml",
  "Nước bí đao cân bằng da 140ml",
  "Mặt nạ nghệ Hưng Yên 100ml",
  "Mặt nạ nghệ Hưng Yên 30ml",
  "Mặt nạ bí đao 100ml",
  "Mặt nạ bí đao 30ml",
  "Tinh chất bí đao N15 70ml",
  "Tinh chất nghệ Hưng Yên C22 30ml",
  "Tinh chất nghệ Hưng Yên C10 30ml",
  "Tinh chất hoa hồng 30ml",
  "Dung dịch chấm mụn bí đao 5ml",
  "Tinh chất bí đao N7 70ml",
  "Cà phê Đắk Lắk làm sạch da chết mặt 150ml",
  "Sáp dưỡng ẩm đa năng sen Hậu Giang 30ml",
  "Thạch nghệ Hưng Yên 100ml",
  "Thạch nghệ Hưng Yên 30ml",
  "Thạch hoa hồng dưỡng ẩm 100ml",
  "Thạch hoa hồng dưỡng ẩm 30ml",
  "Thạch bí đao 100ml",
  "Thạch bí đao 30ml",
  "Xịt khoáng nghệ Hưng Yên 130ml",
  "Sữa chống nắng bí đao 15ml",
  "Sữa chống nắng bí đao 50ml",
  "Kem chống nắng bí đao 50ml",
  "Túi Refill Đường Thốt Nốt An Giang Làm Sạch Da Chết Cơ Thể 200ML",
  "Túi Refill Cà Phê Đắk Lắk Làm Sạch Da Chết Cơ Thể 200ML",
  "Đường thốt nốt An Giang làm sạch da chết cơ thể 200ml",
  "Cà phê Đắk Lắk làm sạch da chết 600ml",
  "Cà phê Đắk Lắk làm sạch da chết cơ thể 200ml",
  "Gel tắm đường thốt nốt An Giang 500ml",
  "Gel tắm khuynh diệp & bạc hà 500ml",
  "Gel tắm bí đao 310ml",
  "Sáp dưỡng ẩm đa năng sen Hậu Giang 30ml",
  "Bơ dưỡng thể cà phê Đắk Lắk 200ml",
  "Nước dưỡng da đầu bồ kết 140ml",
  "Nước dưỡng da đầu bồ kết 50ml",
  "Nước dưỡng tóc tinh dầu bưởi 310ml",
  "Nước dưỡng tóc tinh dầu bưởi 140ml",
  "Nước dưỡng tóc sa-chi 140ml",
  "Serum Sa-chi phục hồi tóc 70ml",
  "Dầu gội bưởi không sulfate 50ml",
  "Dầu gội bưởi refill không sulfate 500ml",
  "Dầu gội bưởi không sulfate 500ml",
  "Dầu gội bưởi không sulfate 310ml",
  "Dầu xả bưởi 50ml",
  "Dầu xả bưởi 310ml",
  "Kem ủ tóc bưởi 200ml",
  "Tẩy da chết da đầu bồ kết 200ml",
  "Tẩy da chết da đầu bồ kết 50ml",
  "Cà phê Đắk Lắk làm sạch da chết môi 5g",
  "Son dưỡng dầu dừa Bến Tre 5g"
];

const slugify = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const resolveProductUrl = (rawUrl: string, baseUrl: string): string => {
  if (!rawUrl) return baseUrl;
  try { return new URL(rawUrl, baseUrl).href; } catch (e) { return rawUrl; }
};

const preProcessHtml = (rawHtml: string): string => {
  if (!rawHtml) return "";
  let clean = rawHtml
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gim, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(clean, 'text/html');
    const trashTags = ['iframe', 'noscript', 'meta', 'link', 'head', 'footer', 'header', 'nav', 'form', 'button', 'input', 'select', 'option'];
    trashTags.forEach(tag => doc.querySelectorAll(tag).forEach(el => el.remove()));

    const blacklistSelectors = [
        '[class*="recommend"]', '[id*="recommend"]', 
        '[class*="suggestion"]', '[id*="suggestion"]',
        '.footer', '#footer', '.header', '#header',
        'video', 'canvas', '.xgplayer-container',
        '[data-e2e="video-container"]', '[data-e2e="live-room-container"]'
    ];
    blacklistSelectors.forEach(sel => doc.querySelectorAll(sel).forEach(el => el.remove()));

    const allElements = doc.body.getElementsByTagName("*");
    for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const keepAttrs = ['href', 'src'];
        const attrsToRemove = [];
        for (let j = 0; j < el.attributes.length; j++) {
            const attrName = el.attributes[j].name;
            if (!keepAttrs.includes(attrName)) attrsToRemove.push(attrName);
        }
        attrsToRemove.forEach(attr => el.removeAttribute(attr));
        if (el.hasAttribute('src') && el.getAttribute('src')?.startsWith('data:image')) {
            el.removeAttribute('src');
        }
    }
    return doc.body.innerHTML.replace(/\s\s+/g, ' ');
  } catch (e) { 
      return clean.substring(0, 100000);
  }
};

const extractQuantity = (rawName: string): number => {
  const clean = rawName.toLowerCase();
  const prefixMatch = clean.match(/\b(combo|bộ|set|mua|sl|số lượng)\s*[:.-]*\s*(\d+)/);
  if (prefixMatch && prefixMatch[2]) return parseInt(prefixMatch[2]);
  const xMatch = clean.match(/[\s\(\[][xX]\s*(\d+)\b/);
  if (xMatch && xMatch[1]) return parseInt(xMatch[1]);
  if (clean.includes("mua 1 tặng 1") || clean.includes("mua 1 tang 1")) return 2;
  const startMatch = clean.match(/^(\d+)\s*(chai|lọ|hộp|túi|miếng|cái)/);
  if (startMatch && startMatch[1]) return parseInt(startMatch[1]);
  return 1;
};

const calculateMatchScore = (rawName: string, officialName: string) => {
  const rawSlug = slugify(rawName);
  const officialSlug = slugify(officialName);
  const officialTokens = officialSlug.split(" ");
  let matchCount = 0;
  officialTokens.forEach(token => {
    if (new RegExp(`\\b${token}\\b`).test(rawSlug)) matchCount++;
    else if (rawSlug.includes(token)) matchCount += 0.8; 
  });
  return matchCount / officialTokens.length;
};

const normalizeProductAlgorithm = (rawName: string) => {
  const matches: { name: string, score: number }[] = [];
  OFFICIAL_NAMES.forEach(officialName => {
    const score = calculateMatchScore(rawName, officialName);
    if (score >= 0.85) matches.push({ name: officialName, score });
  });
  matches.sort((a, b) => b.score - a.score || b.name.length - a.name.length);
  
  const uniqueProducts = new Set<string>();
  matches.forEach(m => {
    let isSubset = false;
    for (const existing of uniqueProducts) {
       if (existing.includes(m.name) || m.name.includes(existing)) {
         if (m.name.length > existing.length) {
            uniqueProducts.delete(existing);
            uniqueProducts.add(m.name);
         }
         isSubset = true; break;
       }
    }
    if (!isSubset) uniqueProducts.add(m.name);
  });

  const finalProducts = Array.from(uniqueProducts);
  let normalizedName = rawName, plCombo = "Lẻ", phanLoaiTong = "Khác", phanLoaiChiTiet = "Khác";

  if (finalProducts.length === 1) {
    normalizedName = finalProducts[0];
    plCombo = "Lẻ";
    if (normalizedName.includes("tẩy trang")) { phanLoaiTong = "Làm sạch"; phanLoaiChiTiet = "Tẩy trang"; }
    else if (normalizedName.includes("rửa mặt")) { phanLoaiTong = "Làm sạch"; phanLoaiChiTiet = "Sữa rửa mặt"; }
    else if (normalizedName.includes("mặt nạ")) { phanLoaiTong = "Dưỡng da"; phanLoaiChiTiet = "Mặt nạ"; }
    else if (normalizedName.includes("tinh chất") || normalizedName.includes("serum")) { phanLoaiTong = "Dưỡng da"; phanLoaiChiTiet = "Serum"; }
    
    const qty = extractQuantity(rawName);
    if (qty > 1) {
       const prefix = `Combo ${qty}`;
       normalizedName = `${prefix} ${finalProducts[0]}`;
       plCombo = prefix;
       phanLoaiTong = "Combo";
       phanLoaiChiTiet = "Bộ sản phẩm";
    } else if (/\b(combo|bộ|set)\b/i.test(rawName)) {
           normalizedName = `Combo ${finalProducts[0]}`;
           plCombo = "Combo";
           phanLoaiTong = "Combo";
    }

  } else if (finalProducts.length > 1) {
    normalizedName = finalProducts.sort().join(" + ");
    plCombo = `Combo ${finalProducts.length}`;
    phanLoaiTong = "Combo";
    phanLoaiChiTiet = "Bộ sản phẩm";
  } else {
    const qty = extractQuantity(rawName);
    if (qty > 1) {
        plCombo = `Combo ${qty}`;
        phanLoaiTong = "Combo";
    } else if (/combo|bộ|set|mua.*tặng/i.test(rawName)) {
        plCombo = "Combo (Raw)";
        phanLoaiTong = "Combo";
    }
  }

  return { normalizedName, plCombo, phanLoaiTong, phanLoaiChiTiet };
};

const normalizeBatchWithAI = async (rawNames: string[], model: string) => {
  if (rawNames.length === 0) return {};
  
  let retries = 3;
  while (retries > 0) {
    try {
      const ai = getAIClient();
      const prompt = `
        BẠN LÀ DATA NORMALIZER.
        INPUT: Danh sách tên thô.
        DICTIONARY: ${OFFICIAL_NAMES.join('\n')}
        Output JSON map: "Tên gốc" -> { normalizedName, plCombo, phanLoaiTong, phanLoaiChiTiet }
        LIST: ${JSON.stringify(rawNames)}
      `;
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      // Handle empty string or unexpected end of input
      return JSON.parse(response.text || "{}");
    } catch (error: any) {
      if (rotateKey()) {
         await delay(1000);
         continue;
      }
      throw error;
    }
  }
  return {};
};

export const parseRawProducts = async (
  url: string, 
  htmlHint: string, 
  sourceIndex: number
): Promise<Partial<ProductData>[]> => {
  // UPGRADE: Use the new standard model for JSON extraction tasks
  const model = "gemini-3-flash-preview";
  const cleanHtmlInput = preProcessHtml(htmlHint);
  
  if (cleanHtmlInput.length < 50 && url.length < 10) return [];

  let retries = 0;
  const maxRetries = 15;
  let currentDelay = 2000;
  const safeHtml = cleanHtmlInput.substring(0, 200000);

  while (retries < maxRetries) {
    try {
      const ai = getAIClient();
      const prompt = `
        TASK: Extract MAIN PRODUCT LIST from HTML.
        Input URL: ${url}
        Return JSON Array: [{sanPham, gia, productUrl}]
        HTML: ${safeHtml}
      `;
      
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sanPham: { type: Type.STRING },
                gia: { type: Type.NUMBER },
                productUrl: { type: Type.STRING },
              },
              required: ["sanPham", "gia"]
            }
          }
        }
      });
      
      let rawData = [];
      try {
          const txt = response.text || "[]";
          rawData = JSON.parse(txt);
      } catch (parseError) {
          console.warn("JSON Parse Error (Truncated response?):", parseError);
          throw new Error("JSON_PARSE_ERROR"); 
      }

      return rawData.map((item: any) => {
        const fixedUrl = resolveProductUrl(item.productUrl, url);
        return {
          ...item,
          normalizedName: item.sanPham, 
          plCombo: "Raw",
          phanLoaiTong: "Chưa xử lý",
          phanLoaiChiTiet: "Chưa xử lý",
          productUrl: fixedUrl, 
          url: url,
          sourceIndex,
          status: 'pending' as const
        };
      });

    } catch (error: any) {
      const msg = String(error.message || error);
      const isKeyError = msg.includes('429') || error.status === 429 || msg.includes('400') || msg.includes('API key');
      
      if (isKeyError) {
        if (rotateKey()) {
             await delay(1000); 
             continue;
        } else {
             throw new Error("MISSING_API_KEY");
        }
      } else {
         console.error("Gemini Error:", error);
         retries++;
         await delay(currentDelay);
      }
    }
  }
  return [];
};

export const searchLocalStoresWithGemini = async (
  productName: string,
  location: string
): Promise<StoreResult[]> => {
  const ai = getAIClient();
  // QUAN TRỌNG: Sử dụng model 2.0-flash-exp vì khả năng Google Grounding & JSON output ổn định hơn bản 3.0 Preview cho task này
  const model = "gemini-2.0-flash-exp"; 
  
  const prompt = `
    CONTEXT: User wants to find where to buy "${productName}" in "${location}".
    TASK: Use Google Search to find 5-10 real local stores/retailers.
    
    OUTPUT FORMAT:
    Return a valid JSON Array ONLY. Do not output markdown code blocks.
    [
      {
        "storeName": "Store Name",
        "address": "Full Address",
        "priceEstimate": "Price found or 'Liên hệ'",
        "link": "URL found",
        "phone": "Phone number",
        "email": "Email if available",
        "isOpen": "Opening hours"
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // Không set responseMimeType JSON ở đây vì Google Search tool đôi khi trả về text + metadata
      }
    });

    let text = response.text || "[]";
    
    // CLEANING: Loại bỏ markdown code blocks ```json ... ```
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Tìm mảng JSON bắt đầu bằng [ và kết thúc bằng ]
    const startIdx = text.indexOf('[');
    const endIdx = text.lastIndexOf(']');
    
    if (startIdx !== -1 && endIdx !== -1) {
        text = text.substring(startIdx, endIdx + 1);
    } else {
        // Fallback: Nếu không tìm thấy [], thử ép kiểu mảng rỗng
        console.warn("Gemini Search: No JSON array found in response.");
        return [];
    }

    try {
        const data = JSON.parse(text);
        if (!Array.isArray(data)) return [];

        return data.map((item: any, idx: number) => ({
            id: `store_${idx}_${Math.random().toString(36).substr(2,5)}`,
            ...item
        }));
    } catch (e) {
        console.error("JSON Parse Error form Search:", e);
        console.log("Raw Text:", text);
        return [];
    }

  } catch (error: any) {
     if (rotateKey()) {
         return searchLocalStoresWithGemini(productName, location);
     }
     console.error("Search API Error:", error);
     throw error;
  }
};

export const processNormalization = async (
  items: ProductData[],
  method: 'code' | 'ai',
  onProgress: (percent: number) => void
): Promise<ProductData[]> => {
  if (items.length === 0) return [];
  const total = items.length;
  let processed = 0;

  if (method === 'code') {
    return items.map((item) => {
      const { normalizedName, plCombo, phanLoaiTong, phanLoaiChiTiet } = normalizeProductAlgorithm(item.sanPham);
      processed++;
      onProgress(Math.round((processed / total) * 100));
      return { ...item, normalizedName, plCombo, phanLoaiTong, phanLoaiChiTiet, status: 'success' };
    });
  } else {
    const BATCH_SIZE = 10;
    const results: ProductData[] = [...items];
    const model = "gemini-3-flash-preview"; // UPGRADE

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE);
      const rawNames = batch.map(b => b.sanPham);
      try {
        const aiMap = await normalizeBatchWithAI(rawNames, model);
        for (let j = 0; j < batch.length; j++) {
            const itemIndex = i + j;
            const originalName = results[itemIndex].sanPham;
            const aiData = aiMap[originalName];
            if (aiData) {
                results[itemIndex] = { ...results[itemIndex], ...aiData, status: 'success' };
            } else {
                const fallback = normalizeProductAlgorithm(originalName);
                results[itemIndex] = { ...results[itemIndex], ...fallback, status: 'success' };
            }
        }
      } catch (e) {
         for (let j = 0; j < batch.length; j++) {
            const itemIndex = i + j;
            const fallback = normalizeProductAlgorithm(results[itemIndex].sanPham);
            results[itemIndex] = { ...results[itemIndex], ...fallback, status: 'success' };
         }
      }
      processed += batch.length;
      onProgress(Math.min(Math.round((processed / total) * 100), 100));
      await delay(1000); 
    }
    return results;
  }
};
