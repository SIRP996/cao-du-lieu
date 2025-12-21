import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { 
  Download, Play, Loader2, Code, 
  Package, ExternalLink, Search, Table2, LayoutGrid, Filter, SlidersHorizontal, Sparkles, Database, PieChart, TrendingUp, CheckCircle2, AlertCircle, X, Copy, Cpu, Zap, BrainCircuit, Wand2, PartyPopper, Radio, Laptop, Tag, LogOut, UploadCloud, User, Layers
} from 'lucide-react';
import { ProductData, AppStatus, SourceConfig, TrackingProduct } from './types';
import { parseRawProducts, processNormalization } from './services/geminiScraper';
import { exportToMultiSheetExcel } from './utils/excelExport';

// --- IMPORTS CHO AUTH & FIREBASE ---
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import PriceTrackingDashboard from './components/PriceTrackingDashboard';
import { saveScrapedDataToFirestore, getTrackedProducts } from './services/firebaseService';

const STORAGE_KEY = 'super_scraper_v22_standard_names';

// --- COMPONENT NHẬP LIỆU (OPTIMIZED) ---
const SourceInputCard = memo(({ 
  source, 
  index, 
  onUpdate 
}: { 
  source: SourceConfig, 
  index: number, 
  onUpdate: (idx: number, field: keyof SourceConfig, val: any) => void 
}) => {
  const htmlInputRef = useRef<HTMLTextAreaElement>(null);
  const urlsInputRef = useRef<HTMLTextAreaElement>(null);
  const isShopee = source.name.toUpperCase().includes('SHOPEE');

  useEffect(() => {
    if (htmlInputRef.current && htmlInputRef.current.value !== source.htmlHint) {
        htmlInputRef.current.value = source.htmlHint;
    }
    if (urlsInputRef.current && urlsInputRef.current.value !== source.urls.join('\n')) {
        urlsInputRef.current.value = source.urls.join('\n');
    }
  }, [source.htmlHint, source.urls]);

  return (
    <div className={`bg-white p-6 rounded-[2.5rem] border shadow-sm transition-all group ${source.htmlHint ? 'border-emerald-400 shadow-emerald-100 ring-4 ring-emerald-50' : 'border-slate-200 hover:border-indigo-200'}`}>
      <div className="flex items-center gap-4 mb-5 border-b border-slate-50 pb-4">
        <div className={`w-10 h-10 flex items-center justify-center rounded-2xl font-black text-xs transition-all ${source.htmlHint ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white'}`}>
          {index + 1}
        </div>
        <div className="flex-1">
           <input 
            type="text" 
            defaultValue={source.name} 
            onBlur={(e) => onUpdate(index, 'name', e.target.value)}
            className="bg-transparent border-none p-0 text-xs font-black uppercase tracking-widest text-slate-700 outline-none w-full focus:text-indigo-600 transition-colors"
           />
        </div>
        
        {isShopee && (
          <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100 animate-in fade-in zoom-in duration-300">
             <Tag className="w-3 h-3 text-orange-500" />
             <input 
               type="number"
               placeholder="% Voucher"
               min="0"
               max="100"
               defaultValue={source.voucherPercent || ''}
               onChange={(e) => onUpdate(index, 'voucherPercent', Number(e.target.value))}
               className="w-16 bg-transparent text-[10px] font-bold text-orange-600 placeholder:text-orange-300 outline-none text-right"
             />
             <span className="text-[9px] font-black text-orange-400">%</span>
          </div>
        )}

        {source.htmlHint && <span className="text-[9px] font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded-lg animate-pulse whitespace-nowrap">Đã nhập</span>}
      </div>
      <div className="space-y-4">
        <textarea 
          ref={urlsInputRef}
          defaultValue={source.urls.join('\n')}
          onBlur={(e) => onUpdate(index, 'urls', e.target.value.split('\n'))}
          placeholder="Dán danh sách URL (mỗi dòng 1 link)..."
          className="w-full p-5 h-32 bg-slate-50 border border-slate-100 rounded-3xl text-[11px] outline-none focus:ring-4 focus:ring-indigo-500/5 font-mono resize-none transition-all"
        />
        <div className="relative">
            <textarea 
              ref={htmlInputRef}
              defaultValue={source.htmlHint}
              onBlur={(e) => onUpdate(index, 'htmlHint', e.target.value)}
              placeholder="Paste HTML Code (Body) vào đây..."
              className="w-full p-5 h-40 bg-slate-50 border border-slate-100 rounded-3xl text-[10px] outline-none focus:ring-4 focus:ring-indigo-500/5 font-mono resize-none transition-all pr-10 text-slate-600"
            />
            <div className="absolute right-4 top-4 text-slate-300 group-hover:text-indigo-300 pointer-events-none">
                <Code className="w-4 h-4" />
            </div>
            <div className="absolute bottom-4 right-4 pointer-events-none">
              <span className="text-[9px] font-bold text-slate-300 bg-white/80 px-2 py-1 rounded-lg backdrop-blur-sm">
                 HTML INPUT
              </span>
            </div>
        </div>
      </div>
    </div>
  );
});

interface CrawlLog {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'ai' | 'matrix' | 'system';
}

// --- MAIN WORKSPACE COMPONENT (Trước đây là Dashboard, đổi tên để tránh nhầm lẫn) ---
const ScraperWorkspace: React.FC = () => {
  const { currentUser, logout } = useAuth(); 
  
  // -- STATE --
  const [sources, setSources] = useState<SourceConfig[]>(
    Array(5).fill(null).map((_, i) => {
      const names = ["SOCIOLA", "THEGIOISKINFOOD", "HASAKI", "SHOPEE", "LAZADA"];
      return { name: names[i], urls: [''], htmlHint: '' };
    })
  );
  const [results, setResults] = useState<ProductData[]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [normalizationStatus, setNormalizationStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Tracking & Filter State
  const [showTracking, setShowTracking] = useState(false);
  const [trackingData, setTrackingData] = useState<TrackingProduct[]>([]);
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'dashboard'>('table');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'retail' | 'combo'>('all');
  
  const logContainerRef = useRef<HTMLDivElement>(null);

  // -- EFFECTS --
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setResults(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    const savedSources = localStorage.getItem(STORAGE_KEY + '_sources');
    if (savedSources) {
      try { setSources(JSON.parse(savedSources)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  }, [results]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_sources', JSON.stringify(sources));
  }, [sources]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // -- EXTENSION LISTENER --
  useEffect(() => {
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SUPER_SCRAPER_EXTENSION_DATA') {
         const { html, url, title } = event.data.payload;
         typeLog(`[EXTENSION] Đã nhận dữ liệu từ: ${url}`, 'success');
         
         let targetName = "";
         const lowerUrl = url.toLowerCase();
         if (lowerUrl.includes("shopee")) targetName = "SHOPEE";
         else if (lowerUrl.includes("lazada")) targetName = "LAZADA";
         else if (lowerUrl.includes("tiki")) targetName = "TIKI";
         else if (lowerUrl.includes("hasaki")) targetName = "HASAKI";
         else if (lowerUrl.includes("sociolla")) targetName = "SOCIOLA";
         else if (lowerUrl.includes("thegioiskinfood")) targetName = "THEGIOISKINFOOD";

         setSources(prev => {
            const next = [...prev];
            let idx = next.findIndex(s => s.name.toUpperCase() === targetName);
            if (idx === -1) {
                idx = next.findIndex(s => !s.htmlHint && (!s.urls[0] || s.urls[0] === ''));
            }
            if (idx === -1) idx = 0;

            next[idx] = {
                ...next[idx],
                name: targetName || next[idx].name, 
                htmlHint: html, 
                urls: [url] 
            };
            typeLog(`[AUTO-FILL] Đã điền dữ liệu vào ô nguồn số ${idx + 1} (${next[idx].name})`, 'matrix');
            return next;
         });
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, []);

  // -- HANDLERS --
  const handleSyncToCloud = async () => {
    if (!currentUser || results.length === 0) return;
    const rawItems = results.filter(r => r.plCombo === 'Raw');
    if (rawItems.length > 0) {
        if(!confirm(`Có ${rawItems.length} sản phẩm chưa được chuẩn hóa tên (Giai đoạn 2). Dữ liệu lịch sử có thể bị phân tán. Bạn có muốn tiếp tục lưu không?`)) return;
    }
    try {
        setNormalizationStatus(AppStatus.PROCESSING);
        typeLog(`[CLOUD] Đang đẩy ${results.length} sản phẩm lên Firebase...`, 'system');
        await saveScrapedDataToFirestore(currentUser.uid, results, sources);
        typeLog(`[CLOUD] Đã lưu thành công! Chuyển qua tab Theo Dõi Giá để xem lịch sử.`, 'success');
        alert("Đã lưu dữ liệu vào Cloud thành công!");
    } catch (error: any) {
        typeLog(`[CLOUD ERR] Lỗi lưu trữ: ${error.message}`, 'error');
        console.error(error);
    } finally {
        setNormalizationStatus(AppStatus.IDLE);
    }
  };

  const loadTrackingData = async () => {
      if (!currentUser) return;
      setIsLoadingTracking(true);
      try {
          const data = await getTrackedProducts(currentUser.uid);
          setTrackingData(data);
      } catch (error) {
          console.error("Failed to load tracking data", error);
      } finally {
          setIsLoadingTracking(false);
      }
  };

  const updateSource = (index: number, field: keyof SourceConfig, val: any) => {
    setSources(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const typeLog = (message: string, type: CrawlLog['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setLogs(prev => [...prev, { id, message, type }].slice(-1000));
  };

  const handleRawCrawl = async () => {
    const activeTasks = sources.flatMap((src, srcIdx) => {
      const validUrls = src.urls.filter(u => u.trim().length > 0);
      if (validUrls.length > 0) {
        return validUrls.map(url => ({ src, srcIdx, url, html: src.htmlHint }));
      }
      if (src.htmlHint.trim().length > 50) {
        return [{ src, srcIdx, url: "html-input-manual", html: src.htmlHint }];
      }
      return [];
    });

    if (activeTasks.length === 0) {
      typeLog("!! LỖI: CHƯA NHẬP DỮ LIỆU (URL hoặc HTML Code).", "error");
      return;
    }

    setStatus(AppStatus.PROCESSING);
    setLogs([]);
    typeLog(`>>> GIAI ĐOẠN 1: QUÉT DỮ LIỆU THÔ.`, 'system');
    
    let completed = 0;
    for (const task of activeTasks) {
      typeLog(`[START] ${task.src.name} -> Bóc tách thô...`, 'info');
      try {
        const rawItems = await parseRawProducts(task.url, task.html, task.srcIdx + 1);
        if (rawItems.length > 0) {
          typeLog(`[OK] Tìm thấy ${rawItems.length} sản phẩm thô.`, 'success');
          const formatted = rawItems.map(p => ({
            ...p,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now()
          } as ProductData));
          setResults(prev => [...formatted, ...prev]);
        } else {
            typeLog(`[WARN] Không tìm thấy dữ liệu.`, 'warning');
        }
      } catch (err) {
        typeLog(`[ERR] Lỗi xử lý ${task.src.name}: ${String(err)}`, 'error');
      }
      completed++;
      setProgress(Math.round((completed / activeTasks.length) * 100));
    }
    typeLog(`>>> GIAI ĐOẠN 1 HOÀN TẤT. VUI LÒNG CHỌN TỐI ƯU HÓA Ở BẢNG KẾT QUẢ.`, 'system');
    setStatus(AppStatus.COMPLETED);
  };

  const handleOptimize = async (method: 'code' | 'ai') => {
    if (results.length === 0) return;
    setNormalizationStatus(AppStatus.PROCESSING);
    setProgress(0);
    typeLog(`>>> GIAI ĐOẠN 2: TỐI ƯU HÓA TÊN SP (${method === 'code' ? 'Thuật toán' : 'AI'})...`, 'system');
    try {
      const optimizedResults = await processNormalization(results, method, (percent) => setProgress(percent));
      setResults(optimizedResults);
      typeLog(`[OK] Đã tối ưu hóa ${optimizedResults.length} sản phẩm.`, 'success');
      setShowSuccessModal(true);
    } catch (e) {
      typeLog(`[ERR] Lỗi tối ưu hóa: ${String(e)}`, 'error');
    }
    setNormalizationStatus(AppStatus.COMPLETED);
  };

  // -- CALCULATIONS --
  const groupedResults = useMemo(() => {
    const groups: Record<string, any> = {};
    results.forEach(item => {
      const groupKey = (item.normalizedName || item.sanPham).trim();
      if (!groups[groupKey]) {
        groups[groupKey] = {
          normalizedName: groupKey,
          category: item.phanLoaiTong || "Khác",
          subCategory: item.phanLoaiChiTiet || "Khác",
          prices: {},
          urls: {},
          plCombo: item.plCombo || "Lẻ",
          displayName: item.normalizedName || item.sanPham 
        };
      }
      
      const sourceConfig = sources[item.sourceIndex - 1];
      let finalPrice = item.gia;
      if (sourceConfig && sourceConfig.name.toUpperCase().includes('SHOPEE') && sourceConfig.voucherPercent && sourceConfig.voucherPercent > 0) {
        finalPrice = item.gia * (1 - (sourceConfig.voucherPercent / 100));
        finalPrice = Math.round(finalPrice / 100) * 100;
      }
      const currentPrice = groups[groupKey].prices[item.sourceIndex];
      if (!currentPrice || (finalPrice > 0 && finalPrice < currentPrice)) {
          groups[groupKey].prices[item.sourceIndex] = finalPrice;
          groups[groupKey].urls[item.sourceIndex] = item.productUrl;
      }
      if (item.phanLoaiTong && item.phanLoaiTong !== "Khác") groups[groupKey].category = item.phanLoaiTong;
      if (item.phanLoaiChiTiet && item.phanLoaiChiTiet !== "Khác") groups[groupKey].subCategory = item.phanLoaiChiTiet;
      if (item.plCombo && item.plCombo !== "Raw") groups[groupKey].plCombo = item.plCombo;
    });

    let list = Object.values(groups);
    if (searchTerm) list = list.filter((g: any) => g.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
    if (typeFilter === 'retail') list = list.filter((g: any) => g.plCombo.toLowerCase().includes('lẻ') || (!g.plCombo.toLowerCase().includes('combo') && !g.plCombo.toLowerCase().includes('bộ')));
    else if (typeFilter === 'combo') list = list.filter((g: any) => g.plCombo.toLowerCase().includes('combo') || g.plCombo.toLowerCase().includes('bộ') || /\dx\d/i.test(g.plCombo));
    
    if (showDuplicatesOnly) {
      list = list.filter((g: any) => Object.values(g.prices).filter((p: any) => p > 0).length > 1);
    }
    return list.sort((a: any, b: any) => a.displayName.localeCompare(b.displayName));
  }, [results, searchTerm, showDuplicatesOnly, typeFilter, sources]);

  const stats = useMemo(() => {
    const allGroups: Record<string, any> = {};
    results.forEach(item => {
        const k = (item.normalizedName || item.sanPham).trim();
        if(!allGroups[k]) allGroups[k] = { prices: {} };
        const sourceConfig = sources[item.sourceIndex - 1];
        let finalPrice = item.gia;
        if (sourceConfig && sourceConfig.name.toUpperCase().includes('SHOPEE') && sourceConfig.voucherPercent && sourceConfig.voucherPercent > 0) {
            finalPrice = item.gia * (1 - (sourceConfig.voucherPercent / 100));
        }
        allGroups[k].prices[item.sourceIndex] = finalPrice;
    });
    const allGroupList = Object.values(allGroups);
    const totalRaw = results.length;
    const totalGroups = allGroupList.length;
    let totalGap = 0;
    let gapCount = 0;
    const topGaps = allGroupList.map((g: any) => {
        const prices = (Object.values(g.prices) as number[]).filter((p: number) => p > 0);
        if(prices.length < 2) return { ...g, gap: 0, minPrice: 0, maxPrice: 0 };
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const gap = Math.round(((max - min) / min) * 100);
        return { ...g, gap, minPrice: min, maxPrice: max };
    }).filter((g: any) => g.gap > 0).sort((a: any,b: any) => b.gap - a.gap).slice(0, 5);
    
    allGroupList.forEach((g: any) => {
       const prices = (Object.values(g.prices) as number[]).filter((p: number) => p > 0);
       if (prices.length > 1) {
         const min = Math.min(...prices);
         const max = Math.max(...prices);
         totalGap += ((max - min) / min) * 100;
         gapCount++;
       }
    });
    const avgGap = gapCount > 0 ? Math.round(totalGap / gapCount) : 0;
    const cats: Record<string, number> = {};
    results.forEach(r => { if(r.phanLoaiTong) cats[r.phanLoaiTong] = (cats[r.phanLoaiTong] || 0) + 1; });
    const sortedCats = Object.entries(cats).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const topCat = sortedCats.length > 0 ? sortedCats[0][0] : "Chưa có";
    const sourceStats = sources.map((src, idx) => {
        const srcIndex = idx + 1;
        const srcProducts = results.filter(r => r.sourceIndex === srcIndex);
        const total = srcProducts.length;
        const comboCounts: Record<string, number> = { "Lẻ": 0, "Combo 2": 0, "Combo 3": 0, "Combo 4+": 0 };
        srcProducts.forEach(p => {
            const pl = p.plCombo || "Lẻ";
            if (pl.toLowerCase().includes("lẻ") || !pl.includes("Combo")) { comboCounts["Lẻ"]++; } 
            else if (pl.includes("2")) { comboCounts["Combo 2"]++; } 
            else if (pl.includes("3")) { comboCounts["Combo 3"]++; } 
            else { comboCounts["Combo 4+"]++; }
        });
        return { name: src.name, total, comboCounts, active: total > 0 };
    });
    return { totalRaw, totalGroups, avgGap, topCat, sortedCats, topGaps, sourceStats };
  }, [results, sources]);

  // -- TRACKING MODE RENDER --
  if (showTracking) {
      return (
          <PriceTrackingDashboard 
             data={trackingData} 
             onBack={() => setShowTracking(false)} 
             isLoading={isLoadingTracking}
             onRefresh={loadTrackingData}
          />
      );
  }

  // -- MAIN RENDER --
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20 font-sans relative">
      
      {/* GLOBAL LOADING OVERLAY */}
      {normalizationStatus === AppStatus.PROCESSING && (
        <div className="fixed inset-0 bg-white/90 z-[1000] flex flex-col items-center justify-center p-8 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-md text-center space-y-8">
              <div className="relative mx-auto w-32 h-32">
                 <div className="absolute inset-0 border-8 border-indigo-100 rounded-full"></div>
                 <div className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <UploadCloud className="w-12 h-12 text-indigo-600 animate-bounce" />
                 </div>
              </div>
              <div>
                 <h3 className="text-2xl font-black uppercase text-indigo-900 tracking-tight">Đang đồng bộ...</h3>
                 <p className="text-slate-500 font-bold mt-2">Dữ liệu đang được đẩy lên Firebase</p>
              </div>
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto overflow-hidden">
                   <div className="h-full bg-indigo-600 animate-progress"></div>
              </div>
           </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
         <div className="fixed inset-0 bg-black/60 z-[1001] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
               <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <PartyPopper className="w-12 h-12 text-emerald-600" />
               </div>
               <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-2">Hoàn Tất!</h3>
               <p className="text-slate-500 font-medium mb-8">
                 Đã chuẩn hóa thành công <strong>{results.length}</strong> sản phẩm.<br/>
                 Dữ liệu đã được gộp nhóm và làm sạch.
               </p>
               <button 
                 onClick={() => setShowSuccessModal(false)}
                 className="px-10 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-widest shadow-lg"
               >
                 Xem Kết Quả
               </button>
            </div>
         </div>
      )}

      {/* HELP / EXTENSION MODAL */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-[2rem] p-8 max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black uppercase text-indigo-600 flex items-center gap-2">
                    <Laptop className="w-6 h-6 text-indigo-400" /> CÀI ĐẶT CHROME EXTENSION
                 </h3>
                 <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              
              <div className="space-y-4 text-sm text-slate-600">
                 <p className="font-bold text-slate-800">Để lấy dữ liệu tự động, bạn cần cài đặt Extension đi kèm:</p>
                 <ol className="list-decimal pl-5 space-y-2">
                     <li>Vào thư mục dự án, tìm folder <code>chrome_extension</code>.</li>
                     <li>Mở Chrome, gõ <code>chrome://extensions</code> vào thanh địa chỉ.</li>
                     <li>Bật chế độ <strong>Developer mode (Chế độ cho nhà phát triển)</strong> ở góc phải.</li>
                     <li>Bấm nút <strong>Load unpacked (Tải tiện ích đã giải nén)</strong>.</li>
                     <li>Chọn folder <code>chrome_extension</code> vừa tạo.</li>
                     <li>Mở Shopee/Lazada &rarr; Bấm icon Extension &rarr; <strong>"GỬI SANG SUPER SCRAPER"</strong>.</li>
                 </ol>
                 <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mt-4 text-xs font-bold text-amber-700">
                     Lưu ý: Tab Web App này phải đang mở sẵn thì Extension mới tìm thấy để gửi dữ liệu.
                 </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                 <button onClick={() => setShowHelp(false)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase hover:bg-indigo-700 transition-colors">Đã Hiểu</button>
              </div>
           </div>
        </div>
      )}

      <div className="max-w-[1700px] mx-auto p-4 md:p-8 space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-6">
            <div className="bg-indigo-600 p-5 rounded-[2rem] shadow-xl shadow-indigo-100">
              <Cpu className="w-8 h-8 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Ultra Matrix <span className="text-indigo-600">v2.4</span></h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Dual Stage: Raw Extraction &rarr; Normalization</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
             {currentUser && (
               <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl mr-4 border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Xin chào</span>
                      <span className="text-xs font-black text-slate-800 max-w-[100px] truncate">{currentUser.email}</span>
                  </div>
               </div>
             )}

             <button onClick={() => { if(confirm("Xóa toàn bộ dữ liệu tạm?")) setResults([]); }} className="px-6 py-3 text-[11px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-all">Clear Temp</button>
             
             <button onClick={() => logout()} className="p-3 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full transition-all" title="Đăng xuất">
                <LogOut className="w-5 h-5" />
             </button>

             <button onClick={() => exportToMultiSheetExcel(results, groupedResults, sources)} disabled={groupedResults.length === 0} className="flex items-center gap-3 px-10 py-5 bg-white text-indigo-600 border border-indigo-100 rounded-[2rem] hover:bg-indigo-50 disabled:opacity-50 font-black text-[13px] shadow-sm transition-all uppercase tracking-widest">
              <Download className="w-5 h-5" /> Xuất Excel
            </button>
          </div>
        </header>

        {/* Input & Console Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between px-4">
                <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Cấu hình nguồn & Dữ liệu</h3>
                <button onClick={() => setShowHelp(true)} className="flex items-center gap-2 text-[11px] font-bold text-indigo-500 bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition-all border border-indigo-100 animate-pulse">
                    <Laptop className="w-4 h-4" /> Cài đặt Chrome Extension
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sources.map((src, idx) => (
                <SourceInputCard 
                  key={idx} 
                  index={idx} 
                  source={src} 
                  onUpdate={updateSource} 
                />
              ))}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="bg-[#1e293b] rounded-[3rem] shadow-2xl flex flex-col h-full min-h-[600px] border border-white/5 overflow-hidden sticky top-8">
              <div className="px-10 py-6 bg-slate-800/50 border-b border-white/5 flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                </div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Bot_Console</span>
              </div>
              <div ref={logContainerRef} className="flex-1 p-10 overflow-y-auto font-mono text-[11px] space-y-3 bg-slate-900/40 custom-scrollbar">
                {logs.length === 0 && (
                   <div className="text-slate-600 italic text-center mt-20">
                      <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 inline-block">
                          <p>Chờ dữ liệu từ Extension...</p>
                          <p className="text-[10px] text-slate-500 mt-2">Hoặc nhập thủ công để bắt đầu</p>
                      </div>
                   </div>
                )}
                {logs.map((log) => (
                  <div key={log.id} className={`flex gap-4 leading-relaxed ${
                    log.type === 'error' ? 'text-rose-400' : 
                    log.type === 'success' ? 'text-emerald-400' : 
                    log.type === 'warning' ? 'text-amber-400' : 
                    log.type === 'matrix' ? 'text-indigo-300 font-bold' :
                    log.type === 'system' ? 'text-indigo-400 font-bold border-l-2 border-indigo-500 pl-4' : 'text-slate-500'
                  }`}>
                    <span className="opacity-20 shrink-0 select-none">#</span>
                    <span className="break-words">{log.message}</span>
                  </div>
                ))}
              </div>
              
              <div className="p-6 bg-slate-800/80">
                 <button 
                   onClick={handleRawCrawl}
                   disabled={status === AppStatus.PROCESSING}
                   className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-indigo-500 transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                 >
                   {status === AppStatus.PROCESSING ? <><Loader2 className="w-6 h-6 animate-spin" /> RUNNING {progress}%</> : <><Play className="w-6 h-6 fill-current" /> QUÉT DỮ LIỆU THÔ</>}
                 </button>
              </div>

            </div>
          </div>
        </div>

        {/* Matrix Results */}
        <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl overflow-hidden min-h-[500px]">
          <div className="px-12 py-8 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-8 bg-slate-50/30">
            <div className="flex items-center gap-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">KẾT QUẢ</h2>
                <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-[0.2em]">
                    {groupedResults.length} sản phẩm 
                    {showDuplicatesOnly ? ' trùng khớp' : ' được tìm thấy'}
                </p>
              </div>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button 
                  onClick={() => setViewMode('table')}
                  className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'table' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Table2 className="w-4 h-4" /> Dữ liệu chi tiết
                </button>
                <button 
                  onClick={() => {
                      loadTrackingData(); // Tải dữ liệu từ Firebase
                      setShowTracking(true); // Mở dashboard
                  }}
                  className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showTracking ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
                >
                  <TrendingUp className="w-4 h-4" /> Theo Dõi Giá (Cloud)
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
               <button 
                  onClick={handleSyncToCloud}
                  disabled={results.length === 0}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
               >
                   <UploadCloud className="w-4 h-4"/>
                   Lưu vào Firebase
               </button>

               <div className="h-8 w-px bg-slate-200 mx-2"></div>

               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Tối ưu hóa:</div>
               <button 
                  onClick={() => handleOptimize('code')}
                  disabled={normalizationStatus === AppStatus.PROCESSING || results.length === 0}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 hover:shadow-lg transition-all disabled:opacity-50"
               >
                   <Zap className="w-4 h-4 fill-current"/>
                   Thuật Toán
               </button>
               <button 
                  onClick={() => handleOptimize('ai')}
                  disabled={normalizationStatus === AppStatus.PROCESSING || results.length === 0}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-50 text-indigo-600 font-black text-[10px] uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 hover:shadow-lg transition-all disabled:opacity-50"
               >
                   <BrainCircuit className="w-4 h-4"/>
                   AI Gemini
               </button>
            </div>
          </div>

          <div className="px-8 pb-8 pt-4">
            {viewMode === 'table' && (
              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto mb-6">
                
                <div className="relative group">
                    <div className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600 text-[11px] font-black uppercase tracking-widest cursor-pointer hover:border-indigo-300 transition-all">
                        <SlidersHorizontal className="w-4 h-4" />
                        <span>
                            {typeFilter === 'all' ? 'Tất cả loại' : typeFilter === 'retail' ? 'Sản phẩm Lẻ' : 'Combo / Bộ'}
                        </span>
                    </div>
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 p-2 hidden group-hover:block z-50">
                        <div onClick={() => setTypeFilter('all')} className={`p-3 rounded-xl text-[11px] font-bold uppercase cursor-pointer hover:bg-slate-50 ${typeFilter === 'all' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}>Tất cả</div>
                        <div onClick={() => setTypeFilter('retail')} className={`p-3 rounded-xl text-[11px] font-bold uppercase cursor-pointer hover:bg-slate-50 ${typeFilter === 'retail' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}>Chỉ Sản phẩm Lẻ</div>
                        <div onClick={() => setTypeFilter('combo')} className={`p-3 rounded-xl text-[11px] font-bold uppercase cursor-pointer hover:bg-slate-50 ${typeFilter === 'combo' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}>Chỉ Combo</div>
                    </div>
                </div>

                <button 
                  onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border ${
                    showDuplicatesOnly 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' 
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                    <Filter className="w-4 h-4" />
                    {showDuplicatesOnly ? 'Đang lọc: Trùng khớp' : 'Chỉ hiện trùng khớp'}
                </button>

                <div className="relative w-full md:w-80">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm nhanh..."
                    className="w-full pl-14 pr-6 py-3 bg-white border border-slate-200 rounded-3xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner font-bold"
                  />
                </div>
              </div>
            )}

            {viewMode === 'table' ? (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1300px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-12 py-8 text-[11px] font-black uppercase text-slate-400 tracking-widest min-w-[450px]">Tên Sản Phẩm (Tên Chuẩn)</th>
                      <th className="px-6 py-8 text-[11px] font-black uppercase text-slate-400 tracking-widest text-center">Phân Loại</th>
                      {sources.map((src, i) => (
                        <th key={i} className="px-6 py-8 text-[11px] font-black uppercase text-indigo-600 tracking-widest text-center border-l border-slate-100 bg-indigo-50/10">
                          <div className="flex flex-col items-center">
                            <span>{src.name.toUpperCase()}</span>
                            {src.name.toUpperCase().includes('SHOPEE') && src.voucherPercent && src.voucherPercent > 0 && (
                                <span className="mt-1 text-[9px] bg-orange-500 text-white px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                                    -{src.voucherPercent}%
                                </span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-10 py-8 text-[11px] font-black uppercase text-rose-500 tracking-widest text-center border-l border-slate-100 bg-rose-50/10">Chênh Lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupedResults.length > 0 ? groupedResults.map((group, idx) => {
                      const activePrices = (Object.values(group.prices) as number[]).filter((p: number) => p > 0);
                      const minP = Math.min(...activePrices);
                      const maxP = Math.max(...activePrices);
                      const diff = activePrices.length > 1 ? Math.round(((maxP - minP) / minP) * 100) : 0;
                      return (
                        <tr key={idx} className="hover:bg-indigo-50/5 transition-all group/row">
                          <td className="px-12 py-8">
                            <div className="flex flex-col gap-2">
                              <span className="text-[15px] font-black text-slate-800 group-hover/row:text-indigo-600 transition-colors uppercase leading-tight tracking-tight">{group.displayName}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{group.category}</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{group.subCategory}</span>
                                {activePrices.length > 1 && (
                                    <div className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase">
                                    <CheckCircle2 className="w-3 h-3" /> {activePrices.length} nguồn
                                    </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-8 text-center">
                            <span className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase border ${group.plCombo.includes('Combo') || group.displayName.includes('+') ? 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm shadow-amber-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                              {group.plCombo}
                            </span>
                          </td>
                          {sources.map((_, i) => {
                            const p = group.prices[i+1];
                            const u = group.urls[i+1];
                            const isMin = p > 0 && p === minP && activePrices.length > 1;
                            return (
                              <td key={i} className={`px-6 py-8 text-center border-l border-slate-50 ${isMin ? 'bg-indigo-50/30' : ''}`}>
                                {p ? (
                                  <div className="flex flex-col items-center gap-3">
                                    <span className={`text-xl font-black tracking-tighter ${isMin ? 'text-indigo-600 scale-110' : 'text-slate-800'}`}>{p.toLocaleString()}đ</span>
                                    {u && u.length > 5 && (
                                        <a href={u} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[10px] font-black text-indigo-400 hover:text-indigo-700 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-95">
                                        Link <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                  </div>
                                ) : <span className="text-slate-200 font-bold italic opacity-30">--</span>}
                              </td>
                            );
                          })}
                          <td className={`px-10 py-8 text-center border-l border-slate-100 font-black ${diff > 15 ? 'text-rose-500 bg-rose-50/10' : 'text-slate-400'}`}>
                            {activePrices.length > 1 ? (
                              <div className="flex flex-col items-center">
                                <span className="text-lg">+{diff}%</span>
                                <span className="text-[8px] uppercase tracking-widest opacity-50">GAP</span>
                              </div>
                            ) : '--'}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={10} className="py-60 text-center opacity-10">
                          <div className="flex flex-col items-center">
                            <AlertCircle className="w-32 h-32 mb-8 text-indigo-600" />
                            <p className="text-sm font-black uppercase tracking-[1em]">Chưa có dữ liệu</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-12 animate-in fade-in zoom-in duration-300">
                {/* Stats & Charts UI */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Tổng sản phẩm quét</p>
                      <h3 className="text-4xl font-black text-slate-800">{stats.totalRaw}</h3>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Sản phẩm duy nhất</p>
                      <h3 className="text-4xl font-black text-slate-800">{stats.totalGroups}</h3>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Chênh lệch trung bình</p>
                      <h3 className="text-4xl font-black text-slate-800">{stats.avgGap}%</h3>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Ngành hàng hot</p>
                      <h3 className="text-lg font-black text-slate-800 truncate" title={stats.topCat}>{stats.topCat}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Category Chart */}
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-3">
                      <PieChart className="w-5 h-5 text-indigo-500" /> Phân bổ ngành hàng
                    </h3>
                    <div className="space-y-4">
                      {stats.sortedCats.map(([cat, count], i) => (
                        <div key={i} className="group">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                            <span>{cat}</span>
                            <span>{count} SP</span>
                          </div>
                          <div className="h-3 w-full bg-white rounded-full overflow-hidden shadow-sm">
                            <div 
                              className="h-full bg-indigo-500 rounded-full group-hover:bg-indigo-400 transition-all duration-500" 
                              style={{width: `${(count / stats.totalRaw) * 100}%`}}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Gaps List */}
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-rose-500" /> Top chênh lệch giá
                    </h3>
                    <div className="space-y-4">
                      {stats.topGaps.map((item, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                          <div className="w-[60%]">
                            <h4 className="text-[12px] font-bold text-slate-800 truncate mb-1">{item.displayName}</h4>
                            <div className="flex gap-2 text-[10px] font-bold text-slate-400">
                              <span>Min: {item.minPrice?.toLocaleString()}</span>
                              <span>Max: {item.maxPrice?.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="text-right">
                             <span className="text-lg font-black text-rose-500">+{item.gap}%</span>
                             <p className="text-[8px] font-black text-rose-300 uppercase">Gap</p>
                          </div>
                        </div>
                      ))}
                      {stats.topGaps.length === 0 && <p className="text-center text-slate-400 text-xs py-10">Chưa đủ dữ liệu để so sánh</p>}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-3 px-2">
                    <Database className="w-5 h-5 text-indigo-600" /> Thống kê chi tiết theo nguồn
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {stats.sourceStats.map((src, idx) => (
                      <div key={idx} className={`p-6 rounded-[2rem] border transition-all ${src.active ? 'bg-white border-indigo-100 shadow-lg shadow-indigo-50' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                         <h4 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-1">{src.name}</h4>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{src.total} Sản phẩm</p>
                         
                         <div className="space-y-3">
                            {Object.entries(src.comboCounts).map(([key, val], i) => (
                              <div key={i}>
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                  <span>{key}</span>
                                  <span>{val}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${key === 'Lẻ' ? 'bg-emerald-400' : 'bg-indigo-400'}`} 
                                    style={{width: src.total > 0 ? `${((val as number) / src.total) * 100}%` : '0%'}}
                                  ></div>
                                </div>
                              </div>
                            ))}
                         </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; border: 3px solid #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        .animate-progress { animation: progress 1.5s ease-in-out infinite; width: 50%; }
        @keyframes progress { 0% { margin-left: -50%; } 100% { margin-left: 100%; } }
      `}</style>
    </div>
  );
};

// --- AUTH GUARD COMPONENT ---
const AuthGuard = () => {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    return <Login />;
  }
  
  return <ScraperWorkspace />;
};

// --- ROOT APP ---
const App = () => {
    return (
        <AuthProvider>
            <AuthGuard />
        </AuthProvider>
    );
};

export default App;