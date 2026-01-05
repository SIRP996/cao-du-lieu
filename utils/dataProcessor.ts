
import * as XLSX from 'xlsx';
import { ProcessedRow, ProcessingStatus } from '../types';

// Các từ khóa để nhận diện cột
const KEYWORDS = {
    brand: ['brand', 'thương hiệu', 'nhãn hàng'],
    category: ['category', 'ngành hàng', 'phân loại', 'nhóm hàng'],
    product: ['product', 'tên sản phẩm', 'tên sp', 'item name'],
    revenue: ['gmv', 'doanh thu', 'revenue', 'doanh số'],
    ignore: ['stt', 'no', 'tổng']
};

const normalizeStr = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

const findColumn = (headers: string[], keys: string[]): string | null => {
    return headers.find(h => keys.some(k => normalizeStr(h).includes(k))) || null;
};

const getCellValue = (row: any, colName: string): any => {
    return row[colName] !== undefined ? row[colName] : null;
};

// Hàm tạo ID duy nhất cho sản phẩm dựa trên Brand + Tên
const generateId = (brand: string, name: string) => {
    return btoa(unescape(encodeURIComponent(`${normalizeStr(brand)}_${normalizeStr(name)}`)));
};

export const processFiles = async (
    files: File[], 
    mode: 'standard' | 'append' | 'analysis',
    setStatus: (status: ProcessingStatus) => void
): Promise<{ rows: ProcessedRow[], columns: string[] }> => {
    
    setStatus({ step: 'reading', message: 'Đang đọc dữ liệu từ files...', progress: 10 });

    const allData: { fileName: string, data: any[], headers: string[] }[] = [];

    // 1. Đọc tất cả các file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        
        if (jsonData.length === 0) continue;
        
        // Lấy headers từ dòng đầu tiên
        const headers = Object.keys(jsonData[0] as object);
        allData.push({ fileName: file.name, data: jsonData as any[], headers });
    }

    if (allData.length === 0) {
        throw new Error("Không đọc được dữ liệu nào từ file.");
    }

    setStatus({ step: 'processing', message: 'Đang xử lý và gộp dữ liệu...', progress: 50 });

    // Map lưu trữ kết quả gộp: Key = GeneratedID
    const mergedMap: Record<string, ProcessedRow> = {};
    const dynamicColumns = new Set<string>();

    // 2. Xử lý từng file
    allData.forEach((fileObj, idx) => {
        // Xác định cột Brand, Category, Product
        const brandCol = findColumn(fileObj.headers, KEYWORDS.brand);
        const catCol = findColumn(fileObj.headers, KEYWORDS.category);
        const prodCol = findColumn(fileObj.headers, KEYWORDS.product);
        
        // Xác định các cột dữ liệu (GMV/Tháng)
        // Loại bỏ cột Brand, Cat, Prod ra khỏi danh sách cột dữ liệu
        const valueCols = fileObj.headers.filter(h => 
            h !== brandCol && h !== catCol && h !== prodCol && 
            !KEYWORDS.ignore.some(ign => normalizeStr(h) === ign)
        );

        // Tên tiền tố cho cột dữ liệu (nếu cần thiết, vd: File 1 là T9, File 2 là T10)
        // Ở mode Standard: Dùng tên cột gốc hoặc tên file làm suffix
        
        fileObj.data.forEach((row) => {
            const brand = brandCol ? String(getCellValue(row, brandCol) || 'Khác') : 'Khác';
            const category = catCol ? String(getCellValue(row, catCol) || 'Khác') : 'Khác';
            const productName = prodCol ? String(getCellValue(row, prodCol) || '') : '';
            
            if (!productName) return; // Bỏ qua dòng ko có tên SP

            const id = generateId(brand, productName);

            if (!mergedMap[id]) {
                mergedMap[id] = {
                    id,
                    brand,
                    category,
                    productName
                };
            } else {
                // Update missing info if available (e.g. from Master file)
                if (mergedMap[id].brand === 'Khác' && brand !== 'Khác') mergedMap[id].brand = brand;
                if (mergedMap[id].category === 'Khác' && category !== 'Khác') mergedMap[id].category = category;
            }

            // Merge values
            valueCols.forEach(col => {
                let val = getCellValue(row, col);
                // Cố gắng parse số
                if (typeof val === 'string') {
                    val = parseFloat(val.replace(/[,.]/g, '')); // Xử lý 1.000.000 hoặc 1,000,000
                }
                if (isNaN(val)) val = 0;

                // Logic đặt tên cột
                // Nếu Standard: Nếu cột tên là "GMV" -> đổi thành "GMV_{FileName}" hoặc giữ nguyên nếu file đã đặt tên cột là "T9"
                let finalColName = col;
                if (files.length > 1 && normalizeStr(col).includes('gmv')) {
                    // Nếu nhiều file và cột chỉ tên là GMV -> Gắn tên file vào để phân biệt
                    const fileShortName = fileObj.fileName.replace(/\.[^/.]+$/, ""); // remove extension
                    finalColName = `${col} (${fileShortName})`;
                }
                
                mergedMap[id][finalColName] = (mergedMap[id][finalColName] || 0) + val;
                dynamicColumns.add(finalColName);
            });
        });
    });

    setStatus({ step: 'completed', message: 'Hoàn tất!', progress: 100 });
    
    // FIX: Không dùng .sort() để giữ nguyên thứ tự cột như trong file Excel (T9 -> T12)
    return {
        rows: Object.values(mergedMap),
        columns: Array.from(dynamicColumns) 
    };
};
