
import { db } from '../firebase/config';
import { ProductData, TrackingProduct, SourceConfig, Project } from '../types';

// Tên collection trong Firestore
const COLLECTION_PRODUCTS = 'tracked_products';
const COLLECTION_PROJECTS = 'projects';
const COLLECTION_WORKSPACE_DATA = 'project_workspaces'; // Nơi lưu trữ dữ liệu tạm (Results) của project

// --- HELPER: NÉN HTML TRƯỚC KHI LƯU ---
const compressHtmlForStorage = (html: string): string => {
    if (!html || html.length < 100) return html;
    let clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "")
                    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, "")
                    .replace(/<!--[\s\S]*?-->/g, "");
    if (clean.length > 200000) {
        console.warn("HTML quá dài, cắt bớt để lưu trữ an toàn.");
        return clean.substring(0, 200000) + "...(Truncated)";
    }
    return clean;
};

/**
 * Lấy danh sách dự án của User (Sắp xếp mới nhất trước)
 */
export const getUserProjects = async (userId: string): Promise<Project[]> => {
  if (!userId) return [];
  try {
    const snapshot = await db.collection(COLLECTION_PROJECTS)
      .where("userId", "==", userId)
      .get();
    
    const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));

    return projects.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA; 
    });

  } catch (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
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
    productCount: 0,
    sources: []
  };
  await newProjectRef.set(projectData);
  return projectData;
};

/**
 * Cập nhật tên dự án
 */
export const updateProject = async (projectId: string, newName: string) => {
    if (!projectId || !newName) return;
    await db.collection(COLLECTION_PROJECTS).doc(projectId).update({
        name: newName
    });
};

/**
 * Xóa dự án
 */
export const deleteProject = async (projectId: string) => {
    if (!projectId) return;
    await db.collection(COLLECTION_PROJECTS).doc(projectId).delete();
    await db.collection(COLLECTION_WORKSPACE_DATA).doc(projectId).delete();
};

/**
 * [NEW] ĐỒNG BỘ TRẠNG THÁI LÀM VIỆC (REAL-TIME SYNC)
 */
export const syncProjectWorkspace = async (
    projectId: string, 
    sources: SourceConfig[], 
    results: ProductData[]
) => {
    if (!projectId) return;

    const optimizedSources = sources.map(src => ({
        ...src,
        htmlHint: compressHtmlForStorage(src.htmlHint)
    }));

    await db.collection(COLLECTION_PROJECTS).doc(projectId).update({
        sources: optimizedSources,
        productCount: results.length,
        lastSyncedAt: new Date().toISOString()
    });

    const workspaceRef = db.collection(COLLECTION_WORKSPACE_DATA).doc(projectId);
    
    if (results.length > 0) {
        try {
            await workspaceRef.set({
                results: results,
                updatedAt: new Date().toISOString()
            });
        } catch (e: any) {
            if (e.code === 'invalid-argument' && e.message.includes('exceeds the maximum size')) {
                console.warn("Results quá lớn, lưu bản rút gọn...");
                await workspaceRef.set({
                    results: results.slice(0, 500),
                    updatedAt: new Date().toISOString(),
                    note: "Data truncated due to size limit"
                });
            } else {
                throw e;
            }
        }
    } else {
        await workspaceRef.set({ results: [], updatedAt: new Date().toISOString() });
    }
};

/**
 * [NEW] LẤY TRẠNG THÁI LÀM VIỆC CŨ
 */
export const getProjectWorkspace = async (projectId: string) => {
    if (!projectId) return { sources: null, results: [] };

    const projDoc = await db.collection(COLLECTION_PROJECTS).doc(projectId).get();
    const projData = projDoc.data() as Project;
    
    const wsDoc = await db.collection(COLLECTION_WORKSPACE_DATA).doc(projectId).get();
    const wsData = wsDoc.exists ? wsDoc.data() : { results: [] };

    return {
        sources: projData?.sources || null,
        results: (wsData?.results || []) as ProductData[]
    };
};

/**
 * Hàm lưu dữ liệu lên Firebase (Dành cho Tracking - Logic cũ, giữ nguyên để TrackingDashboard hoạt động)
 */
export const saveScrapedDataToFirestore = async (
  userId: string,
  projectId: string, 
  scrapedProducts: ProductData[],
  sourceConfigs: SourceConfig[],
  onProgress?: (current: number, total: number) => void 
) => {
  if (!userId || !projectId || scrapedProducts.length === 0) return;

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

  for (const [name, items] of entries) {
    const safeName = btoa(encodeURIComponent(name)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    const productId = `PROD_${projectId}_${safeName}`;
    
    const productRef = db.collection(COLLECTION_PRODUCTS).doc(productId);
    
    const docSnap = await productRef.get();
    let existingData: any = docSnap.exists ? docSnap.data() : null;

    const sourcesUpdate: Record<string, any> = existingData ? { ...existingData.sources } : {};

    items.forEach(item => {
        const config = sourceConfigs[item.sourceIndex - 1];
        if (!config) return;

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
        projectId, 
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
