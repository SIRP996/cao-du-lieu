
import { GoogleGenAI, Type } from "@google/genai";
import { ProductData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

// --- HELPERS ---
const slugify = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const preProcessHtml = (rawHtml: string): string => {
  if (!rawHtml) return "";
  let fastClean = rawHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, "").replace(/<!--[\s\S]*?-->/g, "");
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(fastClean, 'text/html');
    ['iframe', 'noscript', 'meta', 'link', 'head', 'footer', 'header', 'nav', 'form', 'button', 'input'].forEach(tag => doc.querySelectorAll(tag).forEach(el => el.remove()));
    return doc.body.innerHTML;
  } catch (e) { return fastClean; }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- ALGORITHMIC LOGIC ---
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
    // Heuristic mapping (giản lược)
    if (normalizedName.includes("tẩy trang")) { phanLoaiTong = "Làm sạch"; phanLoaiChiTiet = "Tẩy trang"; }
    else if (normalizedName.includes("rửa mặt")) { phanLoaiTong = "Làm sạch"; phanLoaiChiTiet = "Sữa rửa mặt"; }
    // ... thêm logic mapping nếu cần
  } else if (finalProducts.length > 1) {
    normalizedName = finalProducts.sort().join(" + ");
    plCombo = `Combo ${finalProducts.length}`;
    phanLoaiTong = "Combo";
    phanLoaiChiTiet = "Bộ sản phẩm";
  }

  if (/combo|bộ|set|mua.*tặng/i.test(rawName) && finalProducts.length <= 1) {
     if (plCombo === "Lẻ") plCombo = "Combo (Raw)";
  }

  return { normalizedName, plCombo, phanLoaiTong, phanLoaiChiTiet };
};

// --- AI LOGIC ---
const normalizeBatchWithAI = async (rawNames: string[], model: string) => {
  if (rawNames.length === 0) return {};
  const prompt = `
    BẠN LÀ DATA NORMALIZER.
    INPUT: Danh sách tên thô.
    DICTIONARY: ${OFFICIAL_NAMES.join('\n')}
    
    YÊU CẦU:
    1. Xác định "Lẻ" hay "Combo".
    2. Chuẩn hóa tên theo Dictionary. Nếu là Combo, tách ra và nối bằng " + ".
    
    Output JSON map: "Tên gốc" -> { normalizedName, plCombo, phanLoaiTong, phanLoaiChiTiet }
    
    LIST: ${JSON.stringify(rawNames)}
  `;
  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
};

// --- PHASE 1: RAW EXTRACTION ONLY ---
export const parseRawProducts = async (
  url: string, 
  htmlHint: string, 
  sourceIndex: number
): Promise<Partial<ProductData>[]> => {
  const model = "gemini-3-flash-preview";
  const cleanHtmlInput = preProcessHtml(htmlHint);
  if (cleanHtmlInput.length < 50 && url.length < 10) return [];

  let retries = 0;
  const maxRetries = 5;
  let currentDelay = 5000;

  while (true) {
    try {
      const prompt = `EXTRACT JSON products from HTML: [{sanPham, gia, productUrl}]. GET ALL ITEMS, NO FILTER. HTML: ${cleanHtmlInput.substring(0, 500000)}`;
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
      
      const rawData = JSON.parse(response.text || "[]");

      let baseUrl = "";
      try { if (url.startsWith("http")) baseUrl = new URL(url).origin; } catch(e) {}

      return rawData.map((item: any) => {
        let pUrl = item.productUrl || "";
        if (!pUrl && url.startsWith("http")) pUrl = url;
        if (pUrl && !pUrl.startsWith('http') && baseUrl) {
          const cleanPath = pUrl.startsWith('/') ? pUrl.substring(1) : pUrl;
          pUrl = `${baseUrl}/${cleanPath}`;
        }
        
        // Trả về dữ liệu thô, chưa chuẩn hóa
        return {
          ...item,
          normalizedName: item.sanPham, // Tạm thời để tên gốc
          plCombo: "Raw",
          phanLoaiTong: "Chưa xử lý",
          phanLoaiChiTiet: "Chưa xử lý",
          url: url,
          sourceIndex,
          status: 'pending' as const
        };
      });

    } catch (error: any) {
      const isRateLimit = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.status === 429;
      if (isRateLimit && retries < maxRetries) {
        retries++;
        console.warn(`⚠️ Error (429). Retry ${retries}/${maxRetries}...`);
        await delay(currentDelay);
        currentDelay *= 1.5;
        continue;
      }
      throw error;
    }
  }
};

// --- PHASE 2: NORMALIZATION PROCESS (Code or AI) ---
// UPDATED: Support onProgress callback
export const processNormalization = async (
  products: ProductData[],
  method: 'code' | 'ai',
  onProgress?: (percent: number) => void
): Promise<ProductData[]> => {
  const model = "gemini-3-flash-preview";
  let resultProducts: ProductData[] = [];
  
  if (method === 'code') {
    // --- CODE MODE (CHUNKING) ---
    // Mặc dù code chạy nhanh, ta chia nhỏ để UI cập nhật được Progress Bar
    const chunkSize = 50; 
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      
      const processedChunk = chunk.map(item => {
        const normInfo = normalizeProductAlgorithm(item.sanPham);
        return { ...item, ...normInfo, status: 'success' } as ProductData;
      });
      
      resultProducts = [...resultProducts, ...processedChunk];
      
      // Update progress
      if (onProgress) {
        const percent = Math.round(((i + chunk.length) / products.length) * 100);
        onProgress(percent);
      }
      
      // Delay cực nhỏ để nhường thread cho UI render
      await delay(10);
    }
    return resultProducts;

  } else {
    // --- AI MODE (BATCHING) ---
    const batchSize = 30;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const rawNames = batch.map(p => p.sanPham);
      try {
        const normalizedMap = await normalizeBatchWithAI(rawNames, model);
        const processedBatch = batch.map(item => {
          const normInfo = normalizedMap[item.sanPham] || {};
          return {
            ...item,
            normalizedName: normInfo.normalizedName || item.sanPham,
            plCombo: normInfo.plCombo || (item.sanPham.toLowerCase().includes('combo') ? 'Combo' : 'Lẻ'),
            phanLoaiTong: normInfo.phanLoaiTong || "Khác",
            phanLoaiChiTiet: normInfo.phanLoaiChiTiet || "Khác",
            status: 'success'
          } as ProductData;
        });
        resultProducts = [...resultProducts, ...processedBatch];
        
        // Update progress
        if (onProgress) {
            const percent = Math.round(((i + batch.length) / products.length) * 100);
            onProgress(percent);
        }
        await delay(500); // Nghỉ nhẹ
      } catch (e) {
        console.error("Batch error", e);
        // Fallback: giữ nguyên raw
        resultProducts = [...resultProducts, ...batch.map(p => ({...p, status: 'error'} as ProductData))];
      }
    }
    return resultProducts;
  }
};
