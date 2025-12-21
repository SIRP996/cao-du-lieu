
import { ProductData, TrackingProduct, SourceConfig, DailyHistory, PriceLog } from "../types";

const TRACKING_STORAGE_KEY = 'super_scraper_tracking_db_v1';

// Hàm helper để tạo giờ (0h, 2h, ... 22h)
const getHourSlots = () => {
  const slots = [];
  for (let i = 0; i <= 22; i += 2) {
    slots.push(i.toString().padStart(2, '0') + ":00");
  }
  return slots;
};

// Hàm tạo dữ liệu giả sử lịch sử 7 ngày (Để demo biểu đồ)
const generateMockHistory = (currentPrice: number): DailyHistory[] => {
  const history: DailyHistory[] = [];
  const slots = getHourSlots();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
    
    // Biến động giá ngẫu nhiên +/- 10%
    const variation = 1 + (Math.random() * 0.2 - 0.1); 
    const dayBasePrice = Math.round(currentPrice * variation / 1000) * 1000;
    
    const logs: PriceLog[] = slots.map(time => {
       // Biến động nhỏ trong ngày
       const hourVar = 1 + (Math.random() * 0.02 - 0.01);
       return {
         time,
         price: Math.round(dayBasePrice * hourVar / 1000) * 1000
       };
    });

    history.push({
      date: dateStr,
      avgPrice: dayBasePrice,
      logs
    });
  }
  return history;
};

// --- CORE FUNCTION: Chuyển đổi từ Scraper Data -> Tracking DB Schema ---
export const syncScrapedDataToTracking = (
  scrapedProducts: ProductData[], 
  sourceConfigs: SourceConfig[]
): TrackingProduct[] => {
  // 1. Load DB cũ
  const existingJson = localStorage.getItem(TRACKING_STORAGE_KEY);
  let db: Record<string, TrackingProduct> = existingJson ? JSON.parse(existingJson) : {};

  // 2. Group Scraped Data theo Normalized Name
  const grouped: Record<string, ProductData[]> = {};
  scrapedProducts.forEach(p => {
    const key = p.normalizedName || p.sanPham;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  // 3. Update DB
  Object.entries(grouped).forEach(([name, items]) => {
    const sku = "SKU-" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const existingProduct = Object.values(db).find(p => p.name === name);
    
    const productId = existingProduct ? existingProduct.id : sku;
    
    // Xác định Category (Lấy item đầu tiên)
    const category = items[0].phanLoaiChiTiet || "Chưa phân loại";

    // Xây dựng Sources Object
    const sourcesData: Record<string, any> = existingProduct ? { ...existingProduct.sources } : {};

    items.forEach(item => {
        const config = sourceConfigs[item.sourceIndex - 1];
        if (!config) return;
        
        let sourceKey = config.name.toLowerCase();
        // Chuẩn hóa key (shopee, lazada...)
        if (sourceKey.includes('shopee')) sourceKey = 'shopee';
        else if (sourceKey.includes('lazada')) sourceKey = 'lazada';
        else if (sourceKey.includes('tiki')) sourceKey = 'tiki';
        else if (sourceKey.includes('hasaki')) sourceKey = 'web';
        else sourceKey = 'web';

        // Tính giá sau voucher (nếu có)
        let finalPrice = item.gia;
        if (config.name.toUpperCase().includes('SHOPEE') && config.voucherPercent) {
            finalPrice = item.gia * (1 - config.voucherPercent / 100);
        }

        // Nếu nguồn này chưa có lịch sử -> Tạo fake history dựa trên giá hiện tại
        // Nếu đã có -> Thêm log mới vào ngày hôm nay (Logic đơn giản hóa cho demo)
        if (!sourcesData[sourceKey]) {
            sourcesData[sourceKey] = {
                price: finalPrice,
                url: item.productUrl || item.url,
                history: generateMockHistory(finalPrice)
            };
        } else {
            // Update giá mới nhất
            sourcesData[sourceKey].price = finalPrice;
            // Trong thực tế sẽ push vào logs, ở đây mình giữ nguyên history cũ và cập nhật giá hôm nay
            const today = new Date();
            const dateStr = `${today.getDate()}/${today.getMonth() + 1}`;
            const history = sourcesData[sourceKey].history;
            const todayLog = history.find((h: any) => h.date === dateStr);
            if(todayLog) {
                 todayLog.avgPrice = finalPrice; // Update giá
            }
        }
    });

    db[productId] = {
        id: productId,
        name: name,
        category: category,
        lastUpdated: new Date().toISOString(),
        sources: sourcesData
    };
  });

  // 4. Save DB
  const resultArray = Object.values(db);
  localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(db));
  return resultArray;
};

export const getTrackingProducts = (): TrackingProduct[] => {
    const json = localStorage.getItem(TRACKING_STORAGE_KEY);
    if (!json) return [];
    return Object.values(JSON.parse(json));
};
