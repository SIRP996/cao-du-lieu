
import * as XLSX from 'xlsx';
import { ProductData, SourceConfig } from '../types';

export const exportToExcelMatrix = (groupedData: any[], sources: SourceConfig[]) => {
  const worksheetData = groupedData.map(group => {
    // SẮP XẾP LẠI THỨ TỰ CỘT THEO YÊU CẦU:
    // Phân loại tổng -> Phân loại chi tiết -> PL COMBO -> Sản phẩm
    const row: any = {
      "Phân loại tổng": group.category,
      "Phân loại chi tiết": group.subCategory,
      "PL COMBO": group.plCombo,
      "Sản phẩm": group.displayName, // Hoặc normalizedName
    };

    // Thêm cột giá cho từng nguồn dựa trên tên người dùng đặt
    sources.forEach((src, idx) => {
      const sourceName = src.name || `Nguồn ${idx + 1}`;
      const price = group.prices[idx + 1];
      row[`Giá [${sourceName}]`] = price ? price : "N/A";
    });

    // Thêm cột link tương ứng
    sources.forEach((src, idx) => {
      const sourceName = src.name || `Nguồn ${idx + 1}`;
      const url = group.urls[idx + 1];
      row[`Link [${sourceName}]`] = url ? url : "";
    });

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  
  // Tự động điều chỉnh độ rộng cột
  const wscols = [
    {wch: 20}, // Phân loại tổng
    {wch: 20}, // Phân loại chi tiết
    {wch: 15}, // PL Combo
    {wch: 50}, // Tên SP
    ...sources.map(() => ({wch: 18})), // Giá
    ...sources.map(() => ({wch: 35})), // Link
  ];
  worksheet['!cols'] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ma trận giá");

  XLSX.writeFile(workbook, `Bao_Cao_Gia_SuperScraper_${new Date().getTime()}.xlsx`);
};
