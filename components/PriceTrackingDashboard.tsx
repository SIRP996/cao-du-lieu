import React, { useState, useEffect, useMemo } from 'react';
import { TrackingProduct } from '../types';
import { 
  TrendingUp, TrendingDown, Clock, ExternalLink, 
  Search, BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw, Zap, ArrowLeft
} from 'lucide-react';

interface Props {
  data: TrackingProduct[];
  onBack: () => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const HistoryChart = ({ history, color }: { history: any[], color: string }) => {
    if (!history || history.length < 2) return <div className="h-20 flex items-center justify-center text-[10px] text-slate-300">Chưa đủ dữ liệu</div>;
    
    const prices = history.map(h => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    
    const points = prices.map((val, i) => {
        const x = (i / (prices.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 80 - 10; 
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative h-24 w-full">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    points={points}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
                {prices.map((val, i) => {
                     const x = (i / (prices.length - 1)) * 100;
                     const y = 100 - ((val - min) / range) * 80 - 10;
                     return <circle key={i} cx={x} cy={y} r="3" fill="white" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                })}
            </svg>
            <div className="absolute top-0 left-0 text-[9px] text-slate-400 font-bold bg-white/80 px-1 rounded">{max.toLocaleString()}</div>
            <div className="absolute bottom-0 left-0 text-[9px] text-slate-400 font-bold bg-white/80 px-1 rounded">{min.toLocaleString()}</div>
        </div>
    );
};

const PriceTrackingDashboard: React.FC<Props> = ({ data, onBack, isLoading = false, onRefresh = () => {} }) => {
  const [selectedProduct, setSelectedProduct] = useState<TrackingProduct | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (data.length > 0 && !selectedProduct) {
        setSelectedProduct(data[0]);
    }
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data, searchTerm]);

  if (isLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="text-center">
                  <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Đang tải dữ liệu từ Cloud...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-3 hover:bg-slate-100 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div>
                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                    <TrendingUp className="w-8 h-8 text-indigo-600" /> Price Tracker
                </h1>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Giám sát biến động giá theo thời gian thực</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
             <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Tìm sản phẩm..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 w-64"
                 />
             </div>
             <button onClick={onRefresh} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                 <RefreshCw className="w-5 h-5" />
             </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-180px)]">
         
         <div className="col-span-4 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Danh sách theo dõi ({filteredData.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {filteredData.map(product => (
                    <div 
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`p-5 rounded-2xl cursor-pointer transition-all border ${selectedProduct?.id === product.id ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}`}
                    >
                        <h4 className={`text-xs font-bold mb-2 line-clamp-2 leading-relaxed ${selectedProduct?.id === product.id ? 'text-white' : 'text-slate-800'}`}>
                            {product.name}
                        </h4>
                        <div className="flex justify-between items-end">
                            <span className={`text-[10px] uppercase font-black tracking-wider px-2 py-1 rounded-md ${selectedProduct?.id === product.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {product.category}
                            </span>
                            <span className={`text-[10px] ${selectedProduct?.id === product.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {new Date(product.lastUpdated).toLocaleDateString('vi-VN')}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
         </div>

         <div className="col-span-8 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            {selectedProduct ? (
                <>
                   <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100%] -mr-10 -mt-10"></div>
                       <h2 className="text-2xl font-black text-slate-800 mb-6 relative z-10">{selectedProduct.name}</h2>
                       
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
                           {Object.entries(selectedProduct.sources).map(([source, data]: [string, any]) => {
                               const history = data.history || [];
                               const currentPrice = data.price;
                               const prevPrice = history.length > 1 ? history[history.length - 2].price : currentPrice;
                               const diff = currentPrice - prevPrice;
                               const percent = prevPrice > 0 ? (diff / prevPrice) * 100 : 0;

                               return (
                                   <div key={source} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                                       <div className="flex justify-between items-start mb-3">
                                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{source}</span>
                                           <a href={data.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-600"><ExternalLink className="w-4 h-4" /></a>
                                       </div>
                                       <div className="flex items-baseline gap-2 mb-1">
                                           <span className="text-xl font-black text-slate-800">{currentPrice.toLocaleString()}đ</span>
                                       </div>
                                       
                                       {diff !== 0 && (
                                            <div className={`flex items-center gap-1 text-[10px] font-bold ${diff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                <span>{Math.abs(percent).toFixed(1)}%</span>
                                            </div>
                                       )}
                                       {diff === 0 && <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Ổn định</span>}

                                       <div className="mt-4 pt-4 border-t border-slate-100 opacity-50 group-hover:opacity-100 transition-opacity">
                                           <HistoryChart history={history} color={diff > 0 ? '#f43f5e' : (diff < 0 ? '#10b981' : '#6366f1')} />
                                       </div>
                                   </div>
                               );
                           })}
                       </div>
                   </div>
                </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-[2.5rem] border border-slate-200 border-dashed">
                    <BarChart3 className="w-16 h-16 mb-4 opacity-50" />
                    <p className="font-bold uppercase tracking-widest">Chọn sản phẩm để xem chi tiết</p>
                </div>
            )}
         </div>

      </div>
    </div>
  );
};

export default PriceTrackingDashboard;