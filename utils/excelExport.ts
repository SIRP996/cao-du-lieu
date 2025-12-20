
import * as XLSX from 'xlsx';
import { ProductData, SourceConfig } from '../types';

export const exportToMultiSheetExcel = (
  results: ProductData[], 
  groupedData: any[], 
  sources: SourceConfig[]
) => {
  const workbook = XLSX.utils.book_new();

  // --- SHEET 1: TOÀN BỘ DỮ LIỆU (RAW) ---
  const allDataSheet = results.map(item => ({
    "ID": item.id,
    "Tên chuẩn hóa": item.normalizedName || item.sanPham,
    "Tên gốc (Raw)": item.sanPham,
    "Giá": item.gia,
    "Nguồn": sources[item.sourceIndex - 1]?.name || `Source ${item.sourceIndex}`,
    "Phân loại (Tổng)": item.phanLoaiTong,
    "Phân loại (Chi tiết)": item.phanLoaiChiTiet,
    "Loại Combo": item.plCombo,
    "Link gốc": item.productUrl || item.url,
    "Trạng thái": item.status
  }));
  const wsAll = XLSX.utils.json_to_sheet(allDataSheet);
  // Auto width
  wsAll['!cols'] = [{wch: 10}, {wch: 40}, {wch: 40}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 50}, {wch: 10}];
  XLSX.utils.book_append_sheet(workbook, wsAll, "1. TỔNG HỢP");

  // --- SHEET 2 -> 6: TỪNG NGUỒN RIÊNG BIỆT ---
  sources.forEach((src, idx) => {
    const srcIndex = idx + 1;
    const srcItems = results.filter(r => r.sourceIndex === srcIndex);
    
    // Ngay cả khi không có dữ liệu cũng tạo sheet để giữ đúng cấu trúc
    const data = srcItems.map(item => ({
      "Tên sản phẩm": item.sanPham,
      "Tên chuẩn": item.normalizedName,
      "Giá bán": item.gia,
      "Phân loại": item.phanLoaiChiTiet,
      "Link sản phẩm": item.productUrl
    }));

    const wsSrc = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{"Thông báo": "Không có dữ liệu cho nguồn này"}]);
    wsSrc['!cols'] = [{wch: 50}, {wch: 40}, {wch: 15}, {wch: 20}, {wch: 50}];
    
    // Tên sheet không được quá 31 ký tự
    let sheetName = `${idx + 2}. ${src.name}`.substring(0, 31).replace(/[\/\\\?\*\[\]]/g, ""); 
    XLSX.utils.book_append_sheet(workbook, wsSrc, sheetName);
  });

  // --- SHEET 7: SẢN PHẨM TRÙNG (MA TRẬN GIÁ) ---
  // Lọc ra các nhóm có > 1 nguồn bán
  const duplicateGroups = groupedData.filter(g => {
    const activePrices = Object.values(g.prices).filter((p: any) => p > 0);
    return activePrices.length > 1;
  });

  const dupData = duplicateGroups.map(group => {
    const row: any = {
      "Sản phẩm (Chuẩn)": group.displayName,
      "Phân loại": group.subCategory,
      "Loại Combo": group.plCombo,
    };
    
    // Giá từng nguồn
    sources.forEach((src, idx) => {
      const price = group.prices[idx + 1];
      row[`Giá [${src.name}]`] = price ? price : 0;
    });

    // Tính chênh lệch
    const prices: number[] = Object.values(group.prices).filter((p: any) => typeof p === 'number' && p > 0) as number[];
    if (prices.length > 1) {
       const min = Math.min(...prices);
       const max = Math.max(...prices);
       row["Chênh lệch (%)"] = ((max - min) / min); // Format % sau
       row["Giá thấp nhất"] = min;
       row["Giá cao nhất"] = max;
    } else {
       row["Chênh lệch (%)"] = 0;
       row["Giá thấp nhất"] = 0;
       row["Giá cao nhất"] = 0;
    }

    return row;
  });

  const wsDup = XLSX.utils.json_to_sheet(dupData);
  wsDup['!cols'] = [{wch: 40}, {wch: 20}, {wch: 15}, ...sources.map(()=>({wch: 15})), {wch: 15}, {wch: 15}, {wch: 15}];
  XLSX.utils.book_append_sheet(workbook, wsDup, "7. TRÙNG KHỚP");

  // --- SHEET 8: DASHBOARD PHÂN TÍCH ---
  // Tạo dữ liệu dạng mảng mảng (Array of Arrays) để tự dựng layout
  
  // 1. Thống kê tổng
  const totalProducts = results.length;
  const uniqueProducts = groupedData.length;
  const duplicateCount = duplicateGroups.length;

  // 2. Thống kê theo nguồn
  const sourceStatsHeader = ["Nguồn", "Số lượng", "Tỉ trọng (%)"];
  const sourceStatsRows = sources.map((src, idx) => {
    const count = results.filter(r => r.sourceIndex === idx + 1).length;
    const percent = totalProducts > 0 ? (count / totalProducts) : 0;
    return [src.name, count, percent];
  });

  // 3. Thống kê theo ngành hàng (Top 5)
  const catCounts: Record<string, number> = {};
  results.forEach(r => { 
      if(r.phanLoaiTong) catCounts[r.phanLoaiTong] = (catCounts[r.phanLoaiTong] || 0) + 1; 
  });
  const topCats = Object.entries(catCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
  const catHeader = ["Ngành hàng", "Số lượng"];
  
  const dashboardData = [
    ["BÁO CÁO PHÂN TÍCH THỊ TRƯỜNG - SUPER SCRAPER PRO"],
    ["Thời gian xuất:", new Date().toLocaleString()],
    [],
    ["1. TỔNG QUAN"],
    ["Tổng số dòng dữ liệu", totalProducts],
    ["Số sản phẩm duy nhất (SKU)", uniqueProducts],
    ["Số sản phẩm trùng khớp (có ở >1 nguồn)", duplicateCount],
    [],
    ["2. THỐNG KÊ THEO NGUỒN"],
    sourceStatsHeader,
    ...sourceStatsRows,
    [],
    ["3. PHÂN BỔ NGÀNH HÀNG (TOP 10)"],
    catHeader,
    ...topCats
  ];

  const wsDash = XLSX.utils.aoa_to_sheet(dashboardData);
  wsDash['!cols'] = [{wch: 30}, {wch: 20}, {wch: 15}];
  XLSX.utils.book_append_sheet(workbook, wsDash, "8. DASHBOARD");

  // --- XUẤT FILE ---
  XLSX.writeFile(workbook, `SuperScraper_FullReport_${new Date().getTime()}.xlsx`);
};
