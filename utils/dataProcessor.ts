
import * as XLSX from 'xlsx';
import { ProcessedRow, ProcessingStatus } from '../types';

// Các từ khóa để nhận diện cột (Đã mở rộng để bắt tốt hơn)
const KEYWORDS = {
    brand: ['brand', 'thương hiệu', 'nhãn hàng', 'hãng', 'nhà cung cấp', 'vendor', 'thương hiệu (brand)'],
    category: ['category', 'ngành hàng', 'phân loại', 'nhóm hàng', 'danh mục', 'type', 'loại'],
    product: ['product', 'tên sản phẩm', 'tên sp', 'item name', 'tên hàng', 'tên chuẩn hóa', 'tên gốc', 'name', 'product name', 'tên hiển thị', 'tên'],
    revenue: ['gmv', 'doanh thu', 'revenue', 'doanh số', 'tổng tiền', 'thành tiền', 'total sales', 'sales'],
    price: ['giá sau voucher', 'giá bán', 'price', 'đơn giá', 'giá', 'final price', 'giá khuyến mãi', 'giá tiền', 'giá giảm', 'unit price'],
    ignore: ['stt', 'no', 'tổng', 'ghi chú', 'link', 'ảnh', 'image', 'id', 'mã', 'sku', 'code']
};

const normalizeStr = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

const findColumn = (headers: string[], keys: string[]): string | null => {
    // 1. Tìm chính xác (Exact match)
    const exact = headers.find(h => keys.some(k => normalizeStr(h) === k));
    if (exact) return exact;
    
    // 2. Tìm chứa (Contains)
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
    setStatus: (status: ProcessingStatus) => void,
    metric: 'gmv' | 'price' = 'gmv'
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
        // Làm sạch header để tránh khoảng trắng thừa gây lỗi
        const originalHeaders = Object.keys(jsonData[0] as object);
        const headers = originalHeaders.map(h => h.trim());
        
        // Map lại data theo header đã trim
        const cleanData = jsonData.map((row: any) => {
            const newRow: any = {};
            originalHeaders.forEach((h, idx) => {
                newRow[headers[idx]] = row[h];
            });
            return newRow;
        });

        allData.push({ fileName: file.name, data: cleanData, headers });
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
        
        // Xác định các cột dữ liệu dựa trên Metric
        const targetKeywords = metric === 'price' ? KEYWORDS.price : KEYWORDS.revenue;
        
        let valueCols = fileObj.headers.filter(h => 
            findColumn([h], targetKeywords) !== null && 
            h !== brandCol && h !== catCol && h !== prodCol && 
            !KEYWORDS.ignore.some(ign => normalizeStr(h).includes(ign))
        );

        // Fallback: Nếu không tìm thấy cột giá trị, thử tìm cột số không phải là text
        if (valueCols.length === 0) {
             valueCols = fileObj.headers.filter(h => {
                if (h === brandCol || h === catCol || h === prodCol) return false;
                if (KEYWORDS.ignore.some(ign => normalizeStr(h).includes(ign))) return false;
                // Check sample data
                const sampleVal = fileObj.data[0]?.[h];
                return typeof sampleVal === 'number' || (typeof sampleVal === 'string' && /^[0-9.,]+$/.test(sampleVal));
             });
        }

        // Tên file rút gọn để làm hậu tố cột (T8, T9...)
        // Lấy tên file bỏ đuôi .xlsx
        const fileShortName = fileObj.fileName.replace(/\.[^/.]+$/, "").substring(0, 20); 

        fileObj.data.forEach((row) => {
            const brand = brandCol ? String(getCellValue(row, brandCol) || 'Khác') : 'Khác';
            const category = catCol ? String(getCellValue(row, catCol) || 'Khác') : 'Khác';
            const productName = prodCol ? String(getCellValue(row, prodCol) || '') : '';
            
            // Nếu không có tên sản phẩm, bỏ qua dòng này
            if (!productName || productName.trim() === '') return;

            const id = generateId(brand, productName);

            if (!mergedMap[id]) {
                mergedMap[id] = {
                    id,
                    brand,
                    category,
                    productName
                };
            } else {
                if (mergedMap[id].brand === 'Khác' && brand !== 'Khác') mergedMap[id].brand = brand;
                if (mergedMap[id].category === 'Khác' && category !== 'Khác') mergedMap[id].category = category;
            }

            // Merge values
            valueCols.forEach(col => {
                let val = getCellValue(row, col);
                
                // Parse số an toàn hơn cho tiền tệ Việt Nam (100.000 -> 100000)
                if (typeof val === 'string') {
                    // Giữ lại số và dấu chấm/phẩy, bỏ chữ
                    val = parseFloat(val.replace(/[^0-9]/g, '')); 
                }
                if (isNaN(val) || val === null) val = 0;

                // Logic đặt tên cột:
                // Nếu nhiều file -> Dùng tên file làm tên cột (VD: Tháng 8, Tháng 9)
                // Nếu 1 file -> Giữ nguyên tên cột gốc
                let finalColName = files.length > 1 ? fileShortName : col;
                
                // Aggregate Logic
                if (metric === 'price') {
                    // Với GIÁ: Lấy MIN > 0
                    if (val > 0) {
                        const currentVal = mergedMap[id][finalColName];
                        if (currentVal === undefined || currentVal === 0) {
                            mergedMap[id][finalColName] = val;
                        } else {
                            mergedMap[id][finalColName] = Math.min(currentVal, val);
                        }
                    }
                } else {
                    // Với GMV: Cộng dồn (SUM)
                    mergedMap[id][finalColName] = (mergedMap[id][finalColName] || 0) + val;
                }
                
                dynamicColumns.add(finalColName);
            });
        });
    });

    setStatus({ step: 'completed', message: 'Hoàn tất!', progress: 100 });
    
    // Convert Set to Array and KEEP ORDER based on File Order if multiple files
    let sortedColumns = Array.from(dynamicColumns);
    
    if (files.length > 1) {
        const fileNames = allData.map(f => f.fileName.replace(/\.[^/.]+$/, "").substring(0, 20));
        sortedColumns.sort((a, b) => {
            const idxA = fileNames.indexOf(a);
            const idxB = fileNames.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            return a.localeCompare(b);
        });
    }

    return {
        rows: Object.values(mergedMap),
        columns: sortedColumns
    };
};
