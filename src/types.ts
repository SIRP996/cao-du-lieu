
export interface ProductData {
  id: string;
  phanLoaiTong: string;
  phanLoaiChiTiet: string;
  plCombo: string;
  sanPham: string;
  normalizedName: string; // Tên đã chuẩn hóa để gộp nhóm
  gia: number;
  url: string; 
  productUrl: string;
  sourceIndex: number; // 1-5
  status: 'pending' | 'success' | 'error';
  timestamp: number;
}

export interface SourceConfig {
  name: string; // Tên nguồn tự đặt (Shopee, Hasaki...)
  urls: string[]; // Danh sách nhiều URL
  htmlHint: string;
  voucherPercent?: number; // Thêm trường voucher (chỉ dùng cho Shopee hoặc mở rộng sau này)
}

export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

// --- PROJECT SYSTEM ---
export interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  productCount: number;
  // Cloud Sync Fields
  sources?: SourceConfig[]; // Lưu cấu hình nguồn trực tiếp vào Project
  lastSyncedAt?: string;
}

// --- TRACKING SYSTEM TYPES ---

export interface PriceLog {
  time: string; // "00:00", "02:00"...
  price: number;
}

export interface DailyHistory {
  date: string; // "25/10"
  avgPrice: number;
  logs: PriceLog[];
}

export interface TrackingSourceData {
  price: number;
  url: string;
  history: DailyHistory[];
}

export interface TrackingProduct {
  id: string; // SKU
  projectId?: string; // Link to Project
  name: string;
  category: string;
  lastUpdated: string; // ISO String
  image_url?: string;
  sources: Record<string, TrackingSourceData>; // key: 'shopee', 'lazada'...
}
