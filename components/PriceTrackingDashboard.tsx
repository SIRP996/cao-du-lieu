import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TrackingProduct, TrackingSourceData } from '../types';
import { 
  TrendingUp, TrendingDown, Clock, ExternalLink, 
  Search, RefreshCw, ArrowLeft, Play, Pause, Activity, Zap, Layers, AlertCircle, Loader2, Minus
} from 'lucide-react';
import { refreshAllPrices } from '../services/trackingService';

interface Props {
  data: TrackingProduct[];
  onBack: () => void;
  isLoading: boolean;
  onRefresh: () => void;
}

// --- CONFIG ---
const AUTO_SCAN_INTERVAL_MINUTES = 60; // Quét thật mỗi 60 phút (theo yêu cầu 1-2 tiếng/lần)

// --- HELPER COMPONENTS ---
const MiniSparkline = ({ history, color }: { history: any[], color: string }) => {
    if (!history || history.length < 2) return <div className="h-8 w-16 bg-slate-700/30 rounded opacity-30"></div>;
    const prices = history.slice(-7).map(h => h.avgPrice || h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    
    const points = prices.map((val, i) => {
        const x = (i / (prices.length - 1)) * 60;
        const y = 30 - ((val - min) / range) * 20 - 5;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width="60" height="30" className="overflow-visible">
            <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={(prices.length-1) * (60/(prices.length-1))} cy={30 - ((prices[prices.length-1] - min) / range) * 20 - 5} r="2.5" fill={color} />
        </svg>
    );
};

const PriceCell = ({ data }: { data: any }) => {
    if (!data) return <div className="text-center text-slate-600 font-mono">-</div>;
    
    const currentPrice = data.price;
    const history = data.history || [];
    const prevPrice = history.length > 1 ? history[history.length - 2].avgPrice : currentPrice;
    
    const diff = currentPrice - prevPrice;
    const percent = prevPrice > 0 ? (diff / prevPrice) * 100 : 0;
    
    // Logic màu mới cho Dark Mode:
    // Tăng -> Xanh (Emerald 400)
    // Giảm -> Đỏ (Rose 400)
    // Không đổi -> Vàng (Yellow 400)
    let colorClass = '';
    let arrowIcon = null;
    let containerClass = '';

    if (diff > 0) {
        // TĂNG
        colorClass = 'text-emerald-400';
        containerClass = 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.15)]';
        arrowIcon = <TrendingUp className="w-3 h-3 text-emerald-400" />;
    } else if (diff < 0) {
        // GIẢM
        colorClass = 'text-rose-400';
        containerClass = 'bg-rose-500/10 border-rose-500/20 shadow-[0_0_15px_rgba(251,113,133,0.15)]';
        arrowIcon = <TrendingDown className="w-3 h-3 text-rose-400" />;
    } else {
        // KHÔNG ĐỔI
        colorClass = 'text-yellow-400';
        containerClass = 'bg-yellow-500/5 border-yellow-500/10'; // Nền vàng rất nhẹ
        arrowIcon = <Minus className="w-3 h-3 text-yellow-500/50" />;
    }

    return (
        <div className={`flex flex-col items-end justify-center p-2.5 rounded-xl border transition-all duration-300 ${containerClass}`}>
            <div className={`text-[13px] font-black tracking-tighter flex items-center gap-1.5 ${colorClass}`}>
                {arrowIcon}
                {currentPrice.toLocaleString()}đ
            </div>
            {diff !== 0 ? (
                <div className="text-[10px] font-bold opacity-80 flex items-center gap-1 mt-0.5 text-slate-400">
                    <span className="line-through opacity-50">{prevPrice.toLocaleString()}</span>
                    <span className={`${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ({diff > 0 ? '+' : ''}{percent.toFixed(1)}%)
                    </span>
                </div>
            ) : (
                <div className="text-[9px] font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                   <Clock className="w-2.5 h-2.5" />
                   {history.length > 0 ? `Cập nhật: ${history[history.length-1].logs?.slice(-1)[0]?.time || 'Hôm nay'}` : 'Chưa có log'}
                </div>
            )}
        </div>
    );
};

const PriceTrackingDashboard: React.FC<Props> = ({ data, onBack, isLoading: parentLoading, onRefresh }) => {
  const [localData, setLocalData] = useState<TrackingProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Real Scanning State
  const [isAutoScanMode, setIsAutoScanMode] = useState(false); // Chế độ tự động
  const [isScanning, setIsScanning] = useState(false); // Đang thực sự quét
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  
  const scanIntervalRef = useRef<any>(null);

  useEffect(() => {
      setLocalData(data);
  }, [data]);

  // --- AUTO SCAN TIMER ---
  useEffect(() => {
      if (isAutoScanMode) {
          // Set timer để quét mỗi X phút
          scanIntervalRef.current = setInterval(() => {
              if (!isScanning) {
                  handleRealScan();
              }
          }, AUTO_SCAN_INTERVAL_MINUTES * 60 * 1000);
      } else {
          clearInterval(scanIntervalRef.current);
      }
      return () => clearInterval(scanIntervalRef.current);
  }, [isAutoScanMode, isScanning]); // Thêm dependencies

  // --- CORE SCAN FUNCTION ---
  const handleRealScan = async () => {
      if (isScanning || localData.length === 0) return;
      
      setIsScanning(true);
      setScanProgress(0);
      setScanMessage("Đang khởi động...");

      try {
          // Gọi service quét thật
          const updated = await refreshAllPrices(localData, (msg, percent) => {
              setScanMessage(msg);
              setScanProgress(percent);
          });
          
          setLocalData([...updated]);
          setLastScanTime(new Date());
          onRefresh(); // Trigger parent refresh (optional)
      } catch (e) {
          console.error("Scan error:", e);
          setScanMessage("Lỗi khi quét!");
      } finally {
          setIsScanning(false);
          setScanMessage("");
      }
  };

  const filteredData = useMemo(() => {
    return localData.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [localData, searchTerm]);

  const sourceColumns = useMemo(() => {
      const sources = new Set<string>();
      localData.forEach(p => Object.keys(p.sources).forEach(s => sources.add(s)));
      
      const priority = ['shopee', 'lazada', 'tiki', 'tiktok', 'web'];
      
      return Array.from(sources).sort((a, b) => {
          // So sánh không phân biệt hoa thường để tìm trong priority
          const idxA = priority.indexOf(a.toLowerCase()) !== -1 ? priority.indexOf(a.toLowerCase()) : 99;
          const idxB = priority.indexOf(b.toLowerCase()) !== -1 ? priority.indexOf(b.toLowerCase()) : 99;
          
          if (idxA !== idxB) return idxA - idxB; // Sắp xếp theo ưu tiên sàn TMĐT
          return a.localeCompare(b); // Nếu cùng độ ưu tiên (vd cùng là web khác), sắp xếp alpha
      }).slice(0, 5);
  }, [localData]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-6 animate-in fade-in duration-500 font-sans relative">
      
      {/* SCANNING TOAST (NON-BLOCKING) */}
      {isScanning && (
          <div className="fixed bottom-6 right-6 z-[100] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-indigo-100 p-5 w-80 animate-in slide-in-from-right duration-300 pointer-events-auto">
              <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                      <div className="relative">
                          <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
                          <div className="relative bg-indigo-50 text-indigo-600 p-2 rounded-full">
                              <RefreshCw className="w-5 h-5 animate-spin" />
                          </div>
                      </div>
                      <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Đang Quét Giá...</h4>
                          <p className="text-[10px] text-slate-500 font-bold truncate pr-2">{scanMessage}</p>
                      </div>
                  </div>
                  <span className="text-xs font-black text-indigo-600">{scanProgress}%</span>
              </div>
              
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                    style={{width: `${scanProgress}%`}}
                  ></div>
              </div>
          </div>
      )}

      {/* HEADER CONTROL */}
      <div className="sticky top-0 z-50 bg-[#1e293b]/90 backdrop-blur-md p-4 rounded-3xl border border-slate-700 shadow-2xl mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={onBack} className="p-3 hover:bg-slate-700 rounded-2xl transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
                <h1 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Zap className="w-6 h-6 text-yellow-400 fill-current" /> 
                    Real-Time Board
                </h1>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    <span>{filteredData.length} Mã</span>
                    <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                    <span>Last Update: {lastScanTime ? lastScanTime.toLocaleTimeString() : 'Chờ lệnh'}</span>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
             {/* Auto Mode Switch */}
             <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700 mr-2">
                 <button 
                    onClick={() => setIsAutoScanMode(false)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${!isAutoScanMode ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                    Thủ công
                 </button>
                 <button 
                    onClick={() => setIsAutoScanMode(true)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${isAutoScanMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                    <Clock className="w-3 h-3" /> Auto (1h)
                 </button>
             </div>

             {/* Manual Trigger Button */}
             <button 
                onClick={handleRealScan}
                disabled={isScanning}
                className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg ${isScanning ? 'bg-indigo-900/50 text-indigo-400 cursor-not-allowed border border-indigo-800' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/50'}`}
             >
                {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {isScanning ? 'Đang chạy nền...' : 'Cập nhật giá ngay'}
             </button>

             <div className="relative flex-1 md:w-56">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                 <input 
                   type="text" 
                   placeholder="Lọc mã..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                 />
             </div>
        </div>
      </div>

      {/* MATRIX TABLE */}
      <div className="bg-[#1e293b] rounded-[2rem] border border-slate-700 shadow-2xl overflow-hidden min-h-[600px]">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                    <tr className="bg-slate-800/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-700">
                        <th className="p-6 w-[25%]">Sản Phẩm / Mã SKU</th>
                        {sourceColumns.map((src, i) => (
                            <th key={i} className="p-6 text-right w-[12%] bg-slate-800/30 border-l border-slate-700">
                                {src.toUpperCase()}
                            </th>
                        ))}
                        <th className="p-6 text-center w-[10%] border-l border-slate-700">Trend</th>
                        <th className="p-6 text-center w-[5%] border-l border-slate-700">Alert</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-sm">
                    {filteredData.map((product) => {
                        const totalChanges = (Object.values(product.sources) as TrackingSourceData[]).reduce((acc, src) => {
                            const uniquePrices = new Set((src.history || []).map((h: any) => h.avgPrice || h.price));
                            return acc + (uniquePrices.size - 1 > 0 ? uniquePrices.size - 1 : 0);
                        }, 0);

                        return (
                            <tr key={product.id} className="hover:bg-slate-700/30 transition-colors group">
                                <td className="p-6">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-white font-bold leading-snug group-hover:text-indigo-400 transition-colors">{product.name}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600 uppercase tracking-wider">{product.category}</span>
                                        </div>
                                    </div>
                                </td>

                                {sourceColumns.map((colKey, i) => {
                                    // Tìm key chính xác trong product.sources (phân biệt hoa thường)
                                    // Vì colKey có thể là "Lazada" nhưng trong DB cũ là "lazada", hoặc ngược lại
                                    const actualKey = Object.keys(product.sources).find(k => k.toLowerCase() === colKey.toLowerCase()) || colKey;
                                    const sourceData = product.sources[actualKey];
                                    return (
                                        <td key={i} className="p-4 border-l border-slate-700/50 bg-slate-800/10">
                                            <PriceCell data={sourceData} />
                                        </td>
                                    );
                                })}

                                <td className="p-4 text-center border-l border-slate-700/50">
                                    <div className="flex justify-center">
                                        <MiniSparkline 
                                            history={Object.values(product.sources)[0]?.history || []} 
                                            color="#6366f1" 
                                        />
                                    </div>
                                </td>

                                <td className="p-4 text-center border-l border-slate-700/50">
                                    {totalChanges > 0 ? (
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                                            !
                                        </div>
                                    ) : (
                                        <div className="text-slate-600 opacity-50"><Activity className="w-4 h-4"/></div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    {filteredData.length === 0 && (
                        <tr>
                            <td colSpan={10} className="py-20 text-center text-slate-500 italic">
                                <div className="flex flex-col items-center gap-4">
                                    <AlertCircle className="w-10 h-10 text-slate-600" />
                                    <span>Chưa có sản phẩm theo dõi</span>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>
      </div>
      
      <div className="mt-6 text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">
         {isAutoScanMode ? 'AUTO-PILOT ACTIVE: WILL SCAN EVERY 60 MINS' : 'MANUAL MODE'} • KEEP TAB OPEN
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
};

export default PriceTrackingDashboard;