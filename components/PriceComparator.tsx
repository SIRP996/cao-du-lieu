
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, FileSpreadsheet, Download, RefreshCw, Trash2, AlertCircle, 
  CheckCircle2, TrendingUp, TrendingDown, Minus, Filter, Search, Table2, 
  BarChart2, ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProcessedRow, ProcessingStatus } from '../types';
import { processFiles } from '../utils/dataProcessor';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: string;
  direction: SortDirection;
}

const PriceComparator: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle', message: '', progress: 0 });
  const [result, setResult] = useState<{ rows: ProcessedRow[], columns: string[] } | null>(null);
  const [rows, setRows] = useState<ProcessedRow[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filterText, setFilterText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (result) setRows(result.rows);
  }, [result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (result && files.length <= 1) handleReset();
  };

  const handleReset = () => {
      setFiles([]);
      setResult(null);
      setRows([]);
      setStatus({ step: 'idle', message: '', progress: 0 });
  };

  const handleProcess = async () => {
    if (files.length < 1) return;
    try {
      // Metric = 'price' triggers MIN aggregation and looks for price columns
      const res = await processFiles(files, 'standard', setStatus, 'price');
      setResult(res);
    } catch (error: any) {
      setStatus({ step: 'error', message: error.message, progress: 0 });
    }
  };

  const handleSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const processedRows = useMemo(() => {
    let items = [...rows];
    
    // 1. Filter
    if (filterText) {
        const lower = filterText.toLowerCase();
        items = items.filter(r => 
            r.productName.toLowerCase().includes(lower) || 
            r.brand.toLowerCase().includes(lower)
        );
    }

    // 2. Sort
    if (sortConfig) {
      items.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        // Handle numeric sorting for price columns
        if (result?.columns.includes(sortConfig.key)) {
             return sortConfig.direction === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
        }
        
        // String sorting
        const aStr = String(aVal || '');
        const bStr = String(bVal || '');
        return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    } else {
        // Default sort: Highest Price change or just Name
        items.sort((a, b) => a.productName.localeCompare(b.productName));
    }
    return items;
  }, [rows, sortConfig, filterText, result]);

  const handleDownload = () => {
      if (!result || processedRows.length === 0) {
          alert("Không có dữ liệu để xuất file!");
          return;
      }
      const ws = XLSX.utils.json_to_sheet(processedRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Price_History");
      XLSX.writeFile(wb, `Price_Comparison_${new Date().getTime()}.xlsx`);
  };

  // Helper to render mini chart
  const renderSparkline = (row: ProcessedRow) => {
      if (!result || result.columns.length < 2) return null;
      const data = result.columns.map(col => ({
          name: col,
          price: row[col] || 0
      })).filter(d => d.price > 0);

      if (data.length < 2) return <div className="text-xs text-slate-300 italic">Không đủ dữ liệu</div>;

      const isIncreasing = data[data.length - 1].price > data[0].price;
      const color = isIncreasing ? '#ef4444' : '#10b981'; // Red = Expensive, Green = Cheaper

      return (
          <div className="h-8 w-24">
              <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                      <Area type="monotone" dataKey="price" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
              </ResponsiveContainer>
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* HEADER & UPLOAD */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-100 p-3 rounded-xl">
                            <TrendingDown className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">So Sánh Giá (Price History)</h2>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Theo dõi biến động giá sau Voucher theo tháng</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <input 
                            type="file" 
                            multiple 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={handleFileChange}
                        />
                        {!result ? (
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
                            >
                                <Upload className="w-4 h-4" /> Tải Files (Tháng 8, Tháng 9...)
                            </button>
                        ) : (
                            <button 
                                onClick={handleReset}
                                className="px-4 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> Reset
                            </button>
                        )}
                        
                        {files.length > 0 && !result && (
                            <button 
                                onClick={handleProcess}
                                disabled={status.step === 'processing'}
                                className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                            >
                                {status.step === 'processing' ? <RefreshCw className="w-4 h-4 animate-spin"/> : <BarChart2 className="w-4 h-4"/>}
                                Phân Tích Ngay
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* FILE LIST */}
            {files.length > 0 && !result && (
                <div className="p-6 bg-slate-50 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span className="text-xs font-medium truncate">{f.name}</span>
                            </div>
                            <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* RESULTS TABLE */}
        {result && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 flex flex-col min-h-[400px]">
                {/* TOOLBAR */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-20 rounded-t-2xl">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input 
                            type="text" 
                            placeholder="Lọc tên sản phẩm..." 
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Giá Giảm</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Giá Tăng</span>
                        </div>
                        <button 
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-lg text-xs uppercase hover:bg-emerald-100 transition-all"
                        >
                            <Download className="w-4 h-4" /> Xuất Excel
                        </button>
                    </div>
                </div>

                {/* EMPTY STATE CHECK */}
                {rows.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className="bg-amber-50 p-6 rounded-full mb-4">
                            <AlertCircle className="w-12 h-12 text-amber-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Không tìm thấy sản phẩm nào!</h3>
                        <p className="text-slate-500 text-sm max-w-md mb-6">
                            Hệ thống đã đọc file nhưng không tìm thấy cột "Tên sản phẩm" hoặc cột "Giá".
                            Vui lòng kiểm tra lại header của file Excel.
                        </p>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left text-sm text-slate-600 max-w-md w-full">
                            <p className="font-bold mb-2 text-indigo-600">Header hợp lệ bao gồm:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                                <li><strong>Tên SP:</strong> Tên sản phẩm, Product Name, Tên chuẩn hóa, Item Name...</li>
                                <li><strong>Giá:</strong> Giá sau voucher, Giá bán, Price, Final Price...</li>
                            </ul>
                        </div>
                        <button onClick={handleReset} className="mt-8 text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
                            Tải lại file khác
                        </button>
                    </div>
                ) : (
                    /* TABLE */
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 border-b border-slate-200 min-w-[300px] cursor-pointer hover:text-slate-700" onClick={() => handleSort('productName')}>Sản Phẩm</th>
                                    <th className="p-4 border-b border-slate-200 min-w-[100px] text-center">Trend</th>
                                    {result.columns.map(col => (
                                        <th key={col} className="p-4 border-b border-slate-200 text-right min-w-[120px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort(col)}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm">
                                {processedRows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">{row.productName}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">{row.brand} • {row.category}</div>
                                        </td>
                                        <td className="p-4 flex justify-center">
                                            {renderSparkline(row)}
                                        </td>
                                        {result.columns.map((col, cIdx) => {
                                            const price = row[col] || 0;
                                            // Calculate diff with previous month
                                            let diffPercent = 0;
                                            let isCheaper = false;
                                            let isExpensive = false;
                                            
                                            if (cIdx > 0) {
                                                const prevPrice = row[result.columns[cIdx - 1]] || 0;
                                                if (prevPrice > 0 && price > 0) {
                                                    diffPercent = ((price - prevPrice) / prevPrice) * 100;
                                                    if (price < prevPrice) isCheaper = true;
                                                    if (price > prevPrice) isExpensive = true;
                                                }
                                            }

                                            return (
                                                <td key={col} className={`p-4 text-right align-top ${isCheaper ? 'bg-emerald-50/30' : isExpensive ? 'bg-rose-50/30' : ''}`}>
                                                    <div className={`font-mono font-bold ${isCheaper ? 'text-emerald-600' : isExpensive ? 'text-rose-600' : 'text-slate-600'}`}>
                                                        {price > 0 ? price.toLocaleString('vi-VN') : '-'}
                                                    </div>
                                                    {diffPercent !== 0 && (
                                                        <div className={`text-[10px] font-bold flex items-center justify-end gap-0.5 mt-1 ${isCheaper ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {isCheaper ? <TrendingDown className="w-3 h-3"/> : <TrendingUp className="w-3 h-3"/>}
                                                            {Math.abs(diffPercent).toFixed(1)}%
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default PriceComparator;
