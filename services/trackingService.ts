
import { ProductData, TrackingProduct, SourceConfig, DailyHistory, PriceLog } from "../types";
import { db } from '../firebase/config';
import { parseRawProducts } from './geminiScraper'; // Dùng lại hàm AI bóc tách giá

const TRACKING_STORAGE_KEY = 'super_scraper_tracking_db_v1';
const COLLECTION_NAME = 'tracked_products';

// Helper: Proxy để vượt qua CORS khi fetch từ trình duyệt
// Lưu ý: Các free proxy này có thể không ổn định 100% với Shopee/Lazada do bot detection.
// Khuyến nghị: Sử dụng Extension để lấy HTML thì ổn định hơn, nhưng đây là giải pháp "Auto" tốt nhất trên web client.
const PROXY_URL = "https://api.allorigins.win/raw?url="; 

// --- CORE FUNCTION: Sync Data ---
export const syncScrapedDataToTracking = (
  scrapedProducts: ProductData[], 
  sourceConfigs: SourceConfig[],
  projectId: string = 'local_default'
): TrackingProduct[] => {
  const existingJson = localStorage.getItem(TRACKING_STORAGE_KEY);
  let db: Record<string, TrackingProduct> = existingJson ? JSON.parse(existingJson) : {};

  const grouped: Record<string, ProductData[]> = {};
  scrapedProducts.forEach(p => {
    const key = p.normalizedName || p.sanPham;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  Object.entries(grouped).forEach(([name, items]) => {
    const sku = "SKU-" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const existingProduct = Object.values(db).find(p => p.name === name);
    const productId = existingProduct ? existingProduct.id : sku;
    const category = items[0].phanLoaiChiTiet || "Chưa phân loại";
    const sourcesData: Record<string, any> = existingProduct ? { ...existingProduct.sources } : {};

    items.forEach(item => {
        const config = sourceConfigs[item.sourceIndex - 1];
        if (!config) return;
        
        // LOGIC TÊN NGUỒN: Ưu tiên tên người dùng đặt
        let sourceKey = config.name.trim();
        const lowerName = sourceKey.toLowerCase();
        
        if (lowerName.includes('shopee')) sourceKey = 'Shopee';
        else if (lowerName.includes('lazada')) sourceKey = 'Lazada';
        else if (lowerName.includes('tiki')) sourceKey = 'Tiki';
        else if (lowerName.includes('tiktok')) sourceKey = 'TikTok';
        
        if (!sourceKey) sourceKey = `Source ${item.sourceIndex}`;

        let finalPrice = item.gia;
        if (config.name.toUpperCase().includes('SHOPEE') && config.voucherPercent) {
            finalPrice = item.gia * (1 - config.voucherPercent / 100);
        }

        const todayStr = new Date().toLocaleDateString('vi-VN'); // dd/mm/yyyy

        if (!sourcesData[sourceKey]) {
            sourcesData[sourceKey] = {
                price: finalPrice,
                url: item.productUrl || item.url,
                history: [{
                    date: todayStr,
                    avgPrice: finalPrice,
                    logs: [{ time: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}), price: finalPrice }]
                }]
            };
        } else {
            // Update giá mới nhất
            sourcesData[sourceKey].price = finalPrice;
            const history = sourcesData[sourceKey].history;
            const todayLog = history.find((h: any) => h.date === todayStr);
            
            if(todayLog) {
                 todayLog.avgPrice = finalPrice; 
                 todayLog.logs.push({ time: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}), price: finalPrice });
            } else {
                 history.push({
                    date: todayStr,
                    avgPrice: finalPrice,
                    logs: [{ time: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}), price: finalPrice }]
                 });
                 if(history.length > 30) history.shift();
            }
        }
    });

    db[productId] = {
        id: productId,
        projectId: existingProduct?.projectId || projectId,
        name: name,
        category: category,
        lastUpdated: new Date().toISOString(),
        sources: sourcesData
    };
  });

  const resultArray = Object.values(db);
  localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(db));
  return resultArray;
};

// --- REAL PRICE UPDATE ENGINE ---
export const refreshAllPrices = async (
    products: TrackingProduct[],
    onProgress: (msg: string, percent: number) => void
): Promise<TrackingProduct[]> => {
    
    const updatedProducts = [...products];
    const totalItems = products.length;
    let processed = 0;

    for (let i = 0; i < totalItems; i++) {
        const product = updatedProducts[i];
        const newSources = { ...product.sources };
        let productChanged = false;

        onProgress(`Đang quét: ${product.name}...`, Math.round((i / totalItems) * 100));

        // Duyệt qua từng nguồn (Shopee, Lazada...) của sản phẩm này
        const sourceKeys = Object.keys(newSources);
        for (const sourceKey of sourceKeys) {
            const sourceData = newSources[sourceKey];
            const url = sourceData.url;

            if (!url || url.length < 5) continue;

            try {
                // 1. FETCH HTML VIA PROXY (Để tránh CORS)
                // Lưu ý: Shopee thường chặn request không có header chuẩn. 
                // Ở đây ta cố gắng fetch, nếu thất bại Gemini có thể không tìm thấy giá.
                const response = await fetch(PROXY_URL + encodeURIComponent(url));
                if (!response.ok) throw new Error("Fetch failed");
                const html = await response.text();

                if (html && html.length > 1000) {
                    // 2. Dùng hàm parseRawProducts (có Gemini AI) để soi giá từ HTML
                    // sourceIndex = 1 (dummy)
                    const extractedItems = await parseRawProducts(url, html, 1);
                    
                    if (extractedItems.length > 0 && extractedItems[0].gia > 0) {
                        const newPrice = extractedItems[0].gia;
                        const oldPrice = sourceData.price;

                        if (newPrice !== oldPrice) {
                            productChanged = true;
                            sourceData.price = newPrice;
                            
                            // Ghi Log lịch sử
                            const todayStr = new Date().toLocaleDateString('vi-VN');
                            const history = [...sourceData.history];
                            const todayLog = history.find(h => h.date === todayStr);
                            
                            const timeStr = new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});

                            if (todayLog) {
                                todayLog.avgPrice = newPrice;
                                todayLog.logs.push({ time: timeStr, price: newPrice });
                            } else {
                                history.push({
                                    date: todayStr,
                                    avgPrice: newPrice,
                                    logs: [{ time: timeStr, price: newPrice }]
                                });
                                if (history.length > 30) history.shift();
                            }
                            sourceData.history = history;
                        }
                    }
                }
            } catch (error) {
                console.warn(`Lỗi cập nhật ${product.name} [${sourceKey}]:`, error);
                // Nếu lỗi, giữ nguyên giá cũ
            }
            
            // Delay nhẹ để tránh bị chặn IP quá gắt
            await new Promise(r => setTimeout(r, 2000));
        }

        if (productChanged) {
            product.lastUpdated = new Date().toISOString();
            updatedProducts[i] = { ...product, sources: newSources };
            
            // Cập nhật ngay vào LocalStorage để an toàn
            const db = JSON.parse(localStorage.getItem(TRACKING_STORAGE_KEY) || '{}');
            db[product.id] = updatedProducts[i];
            localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(db));
        }
        
        processed++;
    }

    onProgress("Hoàn tất!", 100);
    return updatedProducts;
};

export const getTrackingProducts = (): TrackingProduct[] => {
    const json = localStorage.getItem(TRACKING_STORAGE_KEY);
    if (!json) return [];
    return Object.values(JSON.parse(json));
};
