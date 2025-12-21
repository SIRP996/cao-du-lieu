import { db } from '../firebase/config';
import { ProductData, TrackingProduct, SourceConfig } from '../types';

// Tên collection trong Firestore
const COLLECTION_NAME = 'tracked_products';

/**
 * Hàm này cực kỳ quan trọng:
 * Nó nhận dữ liệu vừa cào được (ProductData[]),
 * Sau đó đẩy lên Firebase.
 * Nếu sản phẩm đã tồn tại -> Nó sẽ UPDATE giá mới và THÊM vào mảng lịch sử (history).
 * Nếu chưa tồn tại -> Tạo mới.
 */
export const saveScrapedDataToFirestore = async (
  userId: string,
  scrapedProducts: ProductData[],
  sourceConfigs: SourceConfig[]
) => {
  if (!userId || scrapedProducts.length === 0) return;

  // 1. Nhóm dữ liệu cào theo Tên Chuẩn (Normalized Name) để tạo SKU duy nhất
  const grouped: Record<string, ProductData[]> = {};
  scrapedProducts.forEach(p => {
    const key = p.normalizedName || p.sanPham; // Dùng tên chuẩn làm khóa
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  const todayStr = new Date().toLocaleDateString('vi-VN'); // dd/mm/yyyy
  const nowISO = new Date().toISOString();

  // 2. Duyệt qua từng nhóm sản phẩm
  for (const [name, items] of Object.entries(grouped)) {
    // Tạo ID dựa trên tên sản phẩm
    const productId = `PROD_${userId}_${btoa(encodeURIComponent(name)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;
    
    // v8 syntax: db.collection().doc()
    const productRef = db.collection(COLLECTION_NAME).doc(productId);
    
    // Lấy dữ liệu cũ (nếu có) để merge lịch sử
    const docSnap = await productRef.get();
    let existingData: any = docSnap.exists ? docSnap.data() : null;

    // Cấu trúc nguồn giá mới
    const sourcesUpdate: Record<string, any> = existingData ? { ...existingData.sources } : {};

    items.forEach(item => {
        const config = sourceConfigs[item.sourceIndex - 1];
        if (!config) return;

        // Chuẩn hóa source key (shopee, lazada...)
        let sourceKey = 'web';
        const lowerName = config.name.toLowerCase();
        if (lowerName.includes('shopee')) sourceKey = 'shopee';
        else if (lowerName.includes('lazada')) sourceKey = 'lazada';
        else if (lowerName.includes('tiki')) sourceKey = 'tiki';
        else if (lowerName.includes('tiktok')) sourceKey = 'tiktok';
        else sourceKey = `source_${item.sourceIndex}`;

        // Tính giá sau voucher
        let finalPrice = item.gia;
        if (config.name.toUpperCase().includes('SHOPEE') && config.voucherPercent) {
            finalPrice = item.gia * (1 - config.voucherPercent / 100);
        }

        // Logic History
        const prevSourceData = sourcesUpdate[sourceKey] || { history: [] };
        const prevHistory = Array.isArray(prevSourceData.history) ? prevSourceData.history : [];

        // Kiểm tra xem hôm nay đã log giá chưa
        const todayLogIndex = prevHistory.findIndex((h: any) => h.date === todayStr);
        
        let newHistory = [...prevHistory];
        if (todayLogIndex > -1) {
            // Update giá mới nhất của hôm nay
            newHistory[todayLogIndex].price = finalPrice;
            newHistory[todayLogIndex].timestamp = nowISO;
        } else {
            // Thêm log mới
            newHistory.push({
                date: todayStr,
                price: finalPrice,
                timestamp: nowISO
            });
            // Giới hạn history chỉ giữ 30 ngày gần nhất
            if (newHistory.length > 30) newHistory.shift(); 
        }

        sourcesUpdate[sourceKey] = {
            price: finalPrice,
            url: item.productUrl || item.url,
            history: newHistory
        };
    });

    // Dữ liệu sẽ lưu
    const productPayload = {
        userId,
        id: productId,
        name: name,
        category: items[0].phanLoaiChiTiet || "Chưa phân loại",
        lastUpdated: nowISO,
        sources: sourcesUpdate,
        searchName: name.toLowerCase() // field phụ để search
    };

    // v8 syntax: set with merge
    await productRef.set(productPayload, { merge: true });
  }
};

/**
 * Lấy danh sách sản phẩm đang theo dõi của User
 */
export const getTrackedProducts = async (userId: string): Promise<TrackingProduct[]> => {
    if (!userId) return [];
    
    // v8 syntax: collection().where().get()
    const querySnapshot = await db.collection(COLLECTION_NAME).where("userId", "==", userId).get();
    
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return data as TrackingProduct;
    });
};