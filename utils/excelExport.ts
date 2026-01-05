
import * as XLSX from 'xlsx';
import { ProductData, SourceConfig, StoreResult } from '../types';

// --- DATA: VIETNAM REGIONS (Dùng chung để map vùng miền trong Excel) ---
const VIETNAM_REGIONS_MAP: Record<string, string[]> = {
    NORTH: [
        "Hà Nội", "Hải Phòng", "Quảng Ninh", "Bắc Ninh", "Hải Dương", 
        "Hưng Yên", "Nam Định", "Thái Bình", "Vĩnh Phúc", "Ninh Bình",
        "Hà Nam", "Phú Thọ", "Bắc Giang", "Thái Nguyên", "Lạng Sơn"
    ],
    CENTRAL: [
        "Đà Nẵng", "Thừa Thiên Huế", "Khánh Hòa", "Nghệ An", "Thanh Hóa",
        "Hà Tĩnh", "Quảng Bình", "Quảng Trị", "Quảng Nam", "Quảng Ngãi",
        "Bình Định", "Phú Yên", "Ninh Thuận", "Bình Thuận", "Kon Tum",
        "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng"
    ],
    SOUTH: [
        "Hồ Chí Minh", "Bình Dương", "Đồng Nai", "Bà Rịa - Vũng Tàu", "Tây Ninh",
        "Bình Phước", "Long An", "Tiền Giang", "Bến Tre", "Trà Vinh",
        "Vĩnh Long", "Đồng Tháp", "An Giang", "Kiên Giang", "Cần Thơ",
        "Hậu Giang", "Sóc Trăng", "Bạc Liêu", "Cà Mau"
    ]
};

const getRegionName = (province: string) => {
    if (!province) return "Khác";
    if (VIETNAM_REGIONS_MAP.NORTH.some(p => province.includes(p))) return "Miền Bắc";
    if (VIETNAM_REGIONS_MAP.CENTRAL.some(p => province.includes(p))) return "Miền Trung";
    if (VIETNAM_REGIONS_MAP.SOUTH.some(p => province.includes(p))) return "Miền Nam";
    return "Khác";
};

// Helper để sort vùng miền theo thứ tự địa lý
const getRegionPriority = (regionName: string) => {
    if (regionName === "Miền Bắc") return 1;
    if (regionName === "Miền Trung") return 2;
    if (regionName === "Miền Nam") return 3;
    return 4;
};

// Helper sanitize tên file
const sanitizeFileName = (str: string) => {
    return str.replace(/[^a-zA-Z0-9\s\-_àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g, "")
              .trim()
              .substring(0, 50);
};

export const exportToMultiSheetExcel = (
  results: ProductData[], 
  groupedData: any[], 
  sources: SourceConfig[]
) => {
  const workbook = XLSX.utils.book_new();

  // --- HELPER: TÍNH GIÁ ĐÃ GIẢM ---
  const getDiscountedPrice = (price: number, sourceName: string, sources: SourceConfig[]) => {
      const config = sources.find(s => s.name === sourceName);
      if (config && config.name.toUpperCase().includes('SHOPEE') && config.voucherPercent && config.voucherPercent > 0) {
          return Math.round(price * (1 - config.voucherPercent / 100));
      }
      return price;
  };

  // --- SHEET 1: TOÀN BỘ DỮ LIỆU (RAW) ---
  const allDataSheet = results.map(item => {
    const sourceName = sources[item.sourceIndex - 1]?.name || `Source ${item.sourceIndex}`;
    const finalPrice = getDiscountedPrice(item.gia, sourceName, sources);
    
    return {
      "ID": item.id,
      "Tên chuẩn hóa": item.normalizedName || item.sanPham,
      "Tên gốc (Raw)": item.sanPham,
      "Giá Gốc": item.gia,
      "Giá Sau Voucher": finalPrice,
      "Nguồn": sourceName,
      "Phân loại (Tổng)": item.phanLoaiTong,
      "Phân loại (Chi tiết)": item.phanLoaiChiTiet,
      "Loại Combo": item.plCombo,
      "Link gốc": item.productUrl || item.url,
      "Trạng thái": item.status
    };
  });
  const wsAll = XLSX.utils.json_to_sheet(allDataSheet);
  // Auto width
  wsAll['!cols'] = [{wch: 10}, {wch: 40}, {wch: 40}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 50}, {wch: 10}];
  XLSX.utils.book_append_sheet(workbook, wsAll, "1. TỔNG HỢP");

  // --- SHEET 2 -> 6: TỪNG NGUỒN RIÊNG BIỆT ---
  sources.forEach((src, idx) => {
    const srcIndex = idx + 1;
    const srcItems = results.filter(r => r.sourceIndex === srcIndex);
    
    // Ngay cả khi không có dữ liệu cũng tạo sheet để giữ đúng cấu trúc
    const data = srcItems.map(item => {
        const finalPrice = getDiscountedPrice(item.gia, src.name, sources);
        return {
            "Tên sản phẩm": item.sanPham,
            "Tên chuẩn": item.normalizedName,
            "Giá bán": finalPrice,
            "Ghi chú giá": finalPrice < item.gia ? `Đã giảm ${src.voucherPercent}%` : "",
            "Phân loại": item.phanLoaiChiTiet,
            "Link sản phẩm": item.productUrl
        };
    });

    const wsSrc = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{"Thông báo": "Không có dữ liệu cho nguồn này"}]);
    wsSrc['!cols'] = [{wch: 50}, {wch: 40}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 50}];
    
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
    
    // Giá từng nguồn (đã được tính giảm giá ở groupedData truyền vào từ App.tsx, nhưng tính lại cho chắc ăn hoặc lấy từ group.prices)
    // Lưu ý: groupedData truyền vào từ App.tsx đã có giá sau voucher rồi.
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
  const sourceStatsHeader = ["Nguồn", "Số lượng", "Tỉ trọng (%)", "Voucher Áp Dụng (%)"];
  const sourceStatsRows = sources.map((src, idx) => {
    const count = results.filter(r => r.sourceIndex === idx + 1).length;
    const percent = totalProducts > 0 ? (count / totalProducts) : 0;
    const voucher = (src.name.toUpperCase().includes('SHOPEE') && src.voucherPercent) ? `${src.voucherPercent}%` : "0%";
    return [src.name, count, percent, voucher];
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
  wsDash['!cols'] = [{wch: 30}, {wch: 20}, {wch: 15}, {wch: 20}];
  XLSX.utils.book_append_sheet(workbook, wsDash, "8. DASHBOARD");

  // --- XUẤT FILE ---
  XLSX.writeFile(workbook, `SuperScraper_FullReport_${new Date().getTime()}.xlsx`);
};

// --- NEW FUNCTION: EXPORT STORE DATA (LOCATION SCOUT) ---
export const exportStoreDataToExcel = (
    stores: StoreResult[], 
    productName: string = "SanPham", 
    locationName: string = "KhuVuc"
) => {
    const workbook = XLSX.utils.book_new();

    // 1. Sắp xếp dữ liệu đa tầng:
    // Cấp 1: Vùng miền (Bắc -> Trung -> Nam)
    // Cấp 2: Tỉnh thành (A-Z)
    // Cấp 3: Tên Shop (A-Z)
    const sortedStores = [...stores].sort((a, b) => {
        const regionA = getRegionName(a.province || "");
        const regionB = getRegionName(b.province || "");
        
        // So sánh vùng
        const regionDiff = getRegionPriority(regionA) - getRegionPriority(regionB);
        if (regionDiff !== 0) return regionDiff;

        // So sánh tỉnh
        const provA = a.province || "ZZZ";
        const provB = b.province || "ZZZ";
        if (provA !== provB) return provA.localeCompare(provB);

        // So sánh tên shop
        return a.storeName.localeCompare(b.storeName);
    });

    // 2. Format dữ liệu cho Sheet Chi Tiết
    // Cấu trúc lại cột để đưa Thông tin liên hệ lên đầu
    const detailData = sortedStores.map((s, i) => ({
        "STT": i + 1,
        "Vùng Miền": getRegionName(s.province || ""),
        "Tỉnh / Thành phố": s.province || "Chưa xác định",
        "Tên Cửa Hàng / Kênh": s.storeName,
        "Số điện thoại": s.phone || "---", 
        "Email": s.email || "---", // Add Email
        "Địa chỉ chi tiết": s.address,     
        "Giá tham khảo": s.priceEstimate,
        "Giờ mở cửa": s.isOpen || "-",
        "Nguồn Website": s.websiteTitle,
        "Link truy cập": s.link
    }));

    // 3. Tạo Sheet Chi Tiết
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    
    // Set width cột cho đẹp
    wsDetail['!cols'] = [
        {wch: 5},  // STT
        {wch: 12}, // Vùng
        {wch: 18}, // Tỉnh
        {wch: 35}, // Tên Shop
        {wch: 15}, // Phone
        {wch: 25}, // Email (New)
        {wch: 50}, // Address
        {wch: 15}, // Giá
        {wch: 20}, // Giờ mở cửa
        {wch: 25}, // Website Source
        {wch: 40}  // Link
    ];

    // --- FIX LINK BẤM ĐƯỢC ---
    // Duyệt qua cột Link (Cột K - Index 10) và thêm thuộc tính Hyperlink
    // Dữ liệu bắt đầu từ dòng 2 (Index 1 trong SheetJS là dòng 1, dòng 0 là Header)
    // Lưu ý: detailData.length là số dòng dữ liệu
    
    // Duyệt qua tất cả các dòng dữ liệu để gán Hyperlink Object
    const range = XLSX.utils.decode_range(wsDetail['!ref'] || "A1:K1");
    // Cột Link là cột cuối cùng (K - index 10)
    const linkColIndex = 10; 

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({c: linkColIndex, r: R});
        const cell = wsDetail[cellAddress];
        
        if (cell && cell.v) {
            // Gán thuộc tính link (l) cho ô
            // Target: URL đích
            // Tooltip: Text hiển thị khi hover (tùy chọn)
            cell.l = { Target: String(cell.v), Tooltip: "Bấm để truy cập" };
            // Đảm bảo kiểu dữ liệu là string
            cell.t = 's'; 
        }
    }

    XLSX.utils.book_append_sheet(workbook, wsDetail, "Danh sách cửa hàng");

    // 4. Tạo Sheet Thống Kê (Dashboard Data)
    const statsByProv: Record<string, number> = {};
    const statsByRegion: Record<string, number> = { "Miền Bắc": 0, "Miền Trung": 0, "Miền Nam": 0, "Khác": 0 };

    sortedStores.forEach(s => {
        const prov = s.province || "Chưa xác định";
        statsByProv[prov] = (statsByProv[prov] || 0) + 1;
        const region = getRegionName(prov);
        statsByRegion[region] = (statsByRegion[region] || 0) + 1;
    });

    // Sort thống kê tỉnh giảm dần theo số lượng
    const sortedStatsProv = Object.entries(statsByProv).sort((a,b) => b[1] - a[1]);

    const dashboardData = [
        ["BÁO CÁO TÌM KIẾM ĐIỂM BÁN - LOCATION SCOUT"],
        ["SẢN PHẨM TÌM KIẾM:", productName.toUpperCase()],
        ["KHU VỰC / VÙNG:", locationName.toUpperCase()],
        ["Thời gian xuất:", new Date().toLocaleString()],
        ["Tổng số điểm bán tìm thấy:", stores.length],
        [],
        ["1. PHÂN BỔ THEO VÙNG MIỀN"],
        ["Vùng", "Số lượng điểm bán"],
        ["Miền Bắc", statsByRegion["Miền Bắc"]],
        ["Miền Trung", statsByRegion["Miền Trung"]],
        ["Miền Nam", statsByRegion["Miền Nam"]],
        [],
        ["2. THỐNG KÊ CHI TIẾT TỪNG TỈNH"],
        ["Tỉnh / Thành phố", "Số lượng"],
        ...sortedStatsProv
    ];

    const wsDash = XLSX.utils.aoa_to_sheet(dashboardData);
    wsDash['!cols'] = [{wch: 35}, {wch: 30}];
    XLSX.utils.book_append_sheet(workbook, wsDash, "Báo cáo Thống kê");

    // 5. Xuất file với tên chuẩn
    const fileName = `TimKiem_${sanitizeFileName(productName)}_${sanitizeFileName(locationName)}_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
};
