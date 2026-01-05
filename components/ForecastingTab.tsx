import React from 'react';
import { ProcessedRow } from '../types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  rows: ProcessedRow[];
  columns: string[];
}

const ForecastingTab: React.FC<Props> = ({ rows, columns }) => {
  // Chỉ dự báo nếu có ít nhất 2 cột dữ liệu
  if (columns.length < 2) {
      return (
          <div className="text-center py-20 text-slate-400">
              Cần ít nhất 2 kỳ dữ liệu (tháng/quý) để thực hiện dự báo xu hướng.
          </div>
      );
  }

  // Lấy 2 cột cuối cùng để so sánh xu hướng gần nhất
  const lastCol = columns[columns.length - 1];
  const prevCol = columns[columns.length - 2];

  // Tính toán Top tăng trưởng
  const growthData = rows.map(r => {
      const current = Number(r[lastCol]) || 0;
      const prev = Number(r[prevCol]) || 0;
      const diff = current - prev;
      const percent = prev > 0 ? (diff / prev) * 100 : 0;
      return { ...r, current, prev, diff, percent };
  }).sort((a,b) => b.percent - a.percent);

  const topGrowers = growthData.filter(x => x.prev > 1000000).slice(0, 5); // Lọc rác (doanh thu quá nhỏ)
  const topLosers = [...growthData].filter(x => x.prev > 1000000).sort((a,b) => a.percent - b.percent).slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl">
            <h2 className="text-lg font-black text-indigo-800 uppercase mb-2">Phân tích Xu hướng & Dự báo</h2>
            <p className="text-sm text-indigo-600">
                So sánh dữ liệu kỳ mới nhất <strong>({lastCol})</strong> so với kỳ trước <strong>({prevCol})</strong>.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* WINNERS */}
            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm">
                <h3 className="flex items-center gap-2 text-emerald-600 font-bold uppercase mb-4">
                    <TrendingUp className="w-5 h-5" /> Top Tăng Trưởng (MoM)
                </h3>
                <div className="space-y-3">
                    {topGrowers.map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-emerald-50/50 rounded-xl">
                            <div className="truncate pr-4">
                                <p className="font-bold text-slate-700 text-sm truncate w-[200px]">{item.productName}</p>
                                <p className="text-xs text-slate-500">{item.brand}</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-emerald-600 font-black">+{item.percent.toFixed(1)}%</span>
                                <span className="text-[10px] text-emerald-400">+{item.diff.toLocaleString()}đ</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* LOSERS */}
            <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm">
                <h3 className="flex items-center gap-2 text-rose-600 font-bold uppercase mb-4">
                    <TrendingDown className="w-5 h-5" /> Top Suy Giảm (MoM)
                </h3>
                <div className="space-y-3">
                    {topLosers.map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-rose-50/50 rounded-xl">
                            <div className="truncate pr-4">
                                <p className="font-bold text-slate-700 text-sm truncate w-[200px]">{item.productName}</p>
                                <p className="text-xs text-slate-500">{item.brand}</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-rose-600 font-black">{item.percent.toFixed(1)}%</span>
                                <span className="text-[10px] text-rose-400">{item.diff.toLocaleString()}đ</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};

export default ForecastingTab;
