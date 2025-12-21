import { db } from '../firebase/config';
import { ProductData, TrackingProduct, SourceConfig, Project } from '../types';

// Tên collection trong Firestore
const COLLECTION_PRODUCTS = 'tracked_products';
const COLLECTION_PROJECTS = 'projects';

/**
 * Lấy danh sách dự án của User
 */
export const getUserProjects = async (userId: string): Promise<Project[]> => {
  if (!userId) return [];
  const snapshot = await db.collection(COLLECTION_PROJECTS)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
};

/**
 * Tạo dự án mới
 */
export const createProject = async (userId: string, projectName: string): Promise<Project> => {
  const newProjectRef = db.collection(COLLECTION_PROJECTS).doc();
  const projectData: Project = {
    id: newProjectRef.id,
    name: projectName,
    userId,
    createdAt: new Date().toISOString(),
    productCount: 0
  };
  await newProjectRef.set(projectData);
  return projectData;
};

/**
 * Hàm lưu dữ liệu lên Firebase có hỗ trợ Project và Progress Callback
 */
export const saveScrapedDataToFirestore = async (
  userId: string,
  projectId: string, // Bắt buộc phải có Project ID
  scrapedProducts: ProductData[],
  sourceConfigs: SourceConfig[],
  onProgress?: (current: number, total: number) => void // Callback cập nhật tiến độ
) => {
  if (!userId || !projectId || scrapedProducts.length === 0) return;

  // 1. Nhóm dữ liệu cào theo Tên Chuẩn
  const grouped: Record<string, ProductData[]> = {};
  scrapedProducts.forEach(p => {
    const key = p.normalizedName || p.sanPham;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  const todayStr = new Date().toLocaleDateString('vi-VN');
  const nowISO = new Date().toISOString();
  
  const entries = Object.entries(grouped);
  const total = entries.length;
  let processed = 0;

  // 2. Duyệt qua từng nhóm sản phẩm (Xử lý tuần tự hoặc song song giới hạn để update progress)
  // Sử dụng vòng lặp for...of để dễ kiểm soát luồng
  for (const [name, items] of entries) {
    // Tạo ID dựa trên ProjectID + Tên sản phẩm -> Đảm bảo mỗi dự án độc lập hoàn toàn
    const safeName = btoa(encodeURIComponent(name)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    const productId = `PROD_${projectId}_${safeName}`;
    
    const productRef = db.collection(COLLECTION_PRODUCTS).doc(productId);
    
    // Lấy dữ liệu cũ
    const docSnap = await productRef.get();
    let existingData: any = docSnap.exists ? docSnap.data() : null;

    const sourcesUpdate: Record<string, any> = existingData ? { ...existingData.sources } : {};

    items.forEach(item => {
        const config = sourceConfigs[item.sourceIndex - 1];
        if (!config) return;

        let sourceKey = 'web';
        const lowerName = config.name.toLowerCase();
        if (lowerName.includes('shopee')) sourceKey = 'shopee';
        else if (lowerName.includes('lazada')) sourceKey = 'lazada';
        else if (lowerName.includes('tiki')) sourceKey = 'tiki';
        else sourceKey = `source_${item.sourceIndex}`;

        let finalPrice = item.gia;
        if (config.name.toUpperCase().includes('SHOPEE') && config.voucherPercent) {
            finalPrice = item.gia * (1 - config.voucherPercent / 100);
        }

        const prevSourceData = sourcesUpdate[sourceKey] || { history: [] };
        const prevHistory = Array.isArray(prevSourceData.history) ? prevSourceData.history : [];
        const todayLogIndex = prevHistory.findIndex((h: any) => h.date === todayStr);
        
        let newHistory = [...prevHistory];
        if (todayLogIndex > -1) {
            newHistory[todayLogIndex].price = finalPrice;
            newHistory[todayLogIndex].timestamp = nowISO;
        } else {
            newHistory.push({
                date: todayStr,
                price: finalPrice,
                timestamp: nowISO
            });
            if (newHistory.length > 30) newHistory.shift(); 
        }

        sourcesUpdate[sourceKey] = {
            price: finalPrice,
            url: item.productUrl || item.url,
            history: newHistory
        };
    });

    const productPayload = {
        userId,
        projectId, // Quan trọng: Gắn sản phẩm vào Project
        id: productId,
        name: name,
        category: items[0].phanLoaiChiTiet || "Chưa phân loại",
        lastUpdated: nowISO,
        sources: sourcesUpdate,
        searchName: name.toLowerCase()
    };

    await productRef.set(productPayload, { merge: true });
    
    processed++;
    if (onProgress) onProgress(processed, total);
  }

  // Cập nhật số lượng sản phẩm cho Project (Ước lượng)
  await db.collection(COLLECTION_PROJECTS).doc(projectId).update({
      productCount: total,
      lastUpdated: nowISO
  });
};

/**
 * Lấy danh sách sản phẩm theo Project
 */
export const getTrackedProducts = async (userId: string, projectId?: string): Promise<TrackingProduct[]> => {
    if (!userId) return [];
    
    let query = db.collection(COLLECTION_PRODUCTS).where("userId", "==", userId);
    
    if (projectId) {
        query = query.where("projectId", "==", projectId);
    }
    
    const querySnapshot = await query.get();
    
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return data as TrackingProduct;
    });
};