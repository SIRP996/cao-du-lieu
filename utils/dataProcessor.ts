
import * as XLSX from 'xlsx';
import { ProcessedRow, ProcessingStatus } from '../types';

// MỞ RỘNG TỪ KHÓA NHẬN DIỆN CỘT
const KEYWORDS = {
    brand: ['brand', 'thương hiệu', 'nhãn hàng', 'hãng', 'nhà cung cấp', 'vendor', 'thương hiệu (brand)', 'brand name', 'nhà sản xuất'],
    category: ['category', 'ngành hàng', 'phân loại', 'nhóm hàng', 'danh mục', 'type', 'loại', 'ngành', 'nhóm', 'loại sản phẩm'],
    product: ['product', 'tên sản phẩm', 'tên sp', 'item name', 'tên hàng', 'tên chuẩn hóa', 'tên gốc', 'name', 'product name', 'tên hiển thị', 'tên', 'mặt hàng', 'tên hàng hóa'],
    revenue: ['gmv', 'doanh thu', 'revenue', 'doanh số', 'tổng tiền', 'thành tiền', 'total sales', 'sales', 'tổng doanh thu', 'tiền bán'],
    price: ['giá sau voucher', 'giá bán', 'price', 'đơn giá', 'giá', 'final price', 'giá khuyến mãi', 'giá tiền', 'giá giảm', 'unit price', 'giá deal', 'giá sốc', 'current price'],
    ignore: ['stt', 'no', 'tổng', 'ghi chú', 'link', 'ảnh', 'image', 'id', 'mã', 'sku', 'code']
};

const normalizeStr = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

const findColumn = (headers: string[], keys: string[]): string | null => {
    // 1. Tìm chính xác
    const exact = headers.find(h => keys.some(k => normalizeStr(h) === k));
    if (exact) return exact;
    
    // 2. Tìm chứa (nhưng bỏ qua nếu chứa từ khóa ignore)
    return headers.find(h => {
        const normH = normalizeStr(h);
        const isIgnored = KEYWORDS.ignore.some(ign => normH.includes(ign));
        if (isIgnored) return false;
        return keys.some(k => normH.includes(k));
    }) || null;
};

const getCellValue = (row: any, colName: string): any => {
    return row[colName] !== undefined ? row[colName] : null;
};

const generateId = (brand: string, name: string) => {
    return btoa(unescape(encodeURIComponent(`${normalizeStr(brand)}_${normalizeStr(name)}`)));
};

export const processFiles = async (
    files: File[], 
    mode: 'standard' | 'append' | 'analysis',
    setStatus: (status: ProcessingStatus) => void,
    metric: 'gmv' | 'price' = 'gmv'
): Promise<{ rows: ProcessedRow[], columns: string[] }> => {
    
    setStatus({ step: 'reading', message: 'Đang đọc dữ liệu...', progress: 10 });

    const allData: { fileName: string, data: any[], headers: string[] }[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Header: 1 để lấy mảng mảng (AOA) nhằm tìm dòng header thực sự
        const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (aoa.length === 0) continue;

        // Thuật toán tìm dòng Header: Dòng đầu tiên chứa từ khóa quan trọng (Product/Price/Revenue)
        let headerRowIndex = 0;
        let headers: string[] = [];
        
        for(let r = 0; r < Math.min(aoa.length, 10); r++) {
            const row = aoa[r].map(c => String(c));
            const hasProduct = findColumn(row, KEYWORDS.product);
            const hasValue = findColumn(row, metric === 'price' ? KEYWORDS.price : KEYWORDS.revenue);
            
            if (hasProduct || hasValue) {
                headerRowIndex = r;
                headers = row.map(h => h.trim());
                break;
            }
        }

        // Nếu không tìm thấy header hợp lệ, dùng dòng 0 mặc định
        if (headers.length === 0 && aoa.length > 0) {
             headers = aoa[0].map(c => String(c).trim());
        }

        // Parse lại data bắt đầu từ dòng ngay sau header
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            range: headerRowIndex, // Bắt đầu đọc từ dòng header tìm được
            defval: null 
        });

        // Map data keys to trimmed headers
        const cleanData = jsonData.map((row: any) => {
            const newRow: any = {};
            // sheet_to_json dùng keys gốc từ Excel, ta cần map sang headers đã trim
            const rowKeys = Object.keys(row);
            rowKeys.forEach(k => {
                const cleanKey = k.trim();
                newRow[cleanKey] = row[k];
            });
            return newRow;
        });

        allData.push({ fileName: file.name, data: cleanData, headers });
    }

    if (allData.length === 0) {
        throw new Error("Không đọc được dữ liệu. Vui lòng kiểm tra file Excel.");
    }

    setStatus({ step: 'processing', message: 'Đang xử lý dữ liệu...', progress: 50 });

    const mergedMap: Record<string, ProcessedRow> = {};
    const dynamicColumns = new Set<string>();

    allData.forEach((fileObj) => {
        const brandCol = findColumn(fileObj.headers, KEYWORDS.brand);
        const catCol = findColumn(fileObj.headers, KEYWORDS.category);
        const prodCol = findColumn(fileObj.headers, KEYWORDS.product);
        
        const targetKeywords = metric === 'price' ? KEYWORDS.price : KEYWORDS.revenue;
        
        let valueCols = fileObj.headers.filter(h => 
            findColumn([h], targetKeywords) !== null && 
            h !== brandCol && h !== catCol && h !== prodCol && 
            !KEYWORDS.ignore.some(ign => normalizeStr(h).includes(ign))
        );

        if (valueCols.length === 0) {
             // Fallback: Tìm cột số bất kỳ nếu không khớp keyword giá
             valueCols = fileObj.headers.filter(h => {
                if (h === brandCol || h === catCol || h === prodCol) return false;
                if (KEYWORDS.ignore.some(ign => normalizeStr(h).includes(ign))) return false;
                const sampleVal = fileObj.data[0]?.[h];
                return typeof sampleVal === 'number' || (typeof sampleVal === 'string' && /^[0-9.,]+$/.test(sampleVal));
             });
        }

        const fileShortName = fileObj.fileName.replace(/\.[^/.]+$/, "").substring(0, 20); 

        fileObj.data.forEach((row) => {
            const brand = brandCol ? String(getCellValue(row, brandCol) || 'Khác') : 'Khác';
            const category = catCol ? String(getCellValue(row, catCol) || 'Khác') : 'Khác';
            const productName = prodCol ? String(getCellValue(row, prodCol) || '') : '';
            
            if (!productName || productName.trim() === '') return;

            const id = generateId(brand, productName);

            if (!mergedMap[id]) {
                mergedMap[id] = { id, brand, category, productName };
            }

            valueCols.forEach(col => {
                let val = getCellValue(row, col);
                if (typeof val === 'string') {
                    // Xử lý "100.000" -> 100000 (Việt Nam)
                    val = parseFloat(val.replace(/[^0-9]/g, '')); 
                }
                if (isNaN(val) || val === null) val = 0;

                let finalColName = files.length > 1 ? fileShortName : col;
                
                if (metric === 'price') {
                    if (val > 0) {
                        const currentVal = mergedMap[id][finalColName];
                        if (!currentVal || currentVal === 0) mergedMap[id][finalColName] = val;
                        else mergedMap[id][finalColName] = Math.min(currentVal, val);
                    }
                } else {
                    mergedMap[id][finalColName] = (mergedMap[id][finalColName] || 0) + val;
                }
                dynamicColumns.add(finalColName);
            });
        });
    });

    setStatus({ step: 'completed', message: 'Hoàn tất!', progress: 100 });
    
    let sortedColumns = Array.from(dynamicColumns);
    if (files.length > 1) {
        const fileNames = allData.map(f => f.fileName.replace(/\.[^/.]+$/, "").substring(0, 20));
        sortedColumns.sort((a, b) => {
            const idxA = fileNames.indexOf(a);
            const idxB = fileNames.indexOf(b);
            return idxA - idxB;
        });
    }

    return {
        rows: Object.values(mergedMap),
        columns: sortedColumns
    };
};
