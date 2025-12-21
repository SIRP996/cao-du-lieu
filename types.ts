
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
