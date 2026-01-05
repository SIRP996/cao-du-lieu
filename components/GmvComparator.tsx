import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, FileSpreadsheet, Download, RefreshCw, Trash2, AlertCircle, 
  CheckCircle2, Layers, PlusCircle, ArrowUpDown, ArrowUp, ArrowDown, 
  LayoutDashboard, Table2, Pencil, Save, Search, Filter, PieChart, 
  BrainCircuit
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FileData, ProcessedRow, ProcessingStatus } from '../types';
import { processFiles } from '../utils/dataProcessor';
import AnalyticsDashboard from './AnalyticsDashboard';
import ForecastingTab from './ForecastingTab';

type ProcessingMode = 'standard' | 'append' | 'analysis';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'table' | 'dashboard' | 'forecasting';

interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface FilterConfig {
  brand: string;
  category: string;
  productName: string;
}

const GmvComparator: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<ProcessingMode>('standard');
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle', message: '', progress: 0 });
  const [result, setResult] = useState<{ rows: ProcessedRow[], columns: string[] } | null>(null);
  const [rows, setRows] = useState<ProcessedRow[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isEditMode, setIsEditMode] = useState(false);
  const [filters, setFilters] = useState<FilterConfig>({ brand: '', category: '', productName: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (result) {
        setRows(result.rows);
    } else {
        setRows([]);
    }
  }, [result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (result) {
        setResult(null);
        setRows([]);
        setStatus({ step: 'idle', message: '', progress: 0 });
        setSortConfig(null);
        setViewMode('table');
        setFilters({ brand: '', category: '', productName: '' });
    }
  };

  const handleProcess = async () => {
    if (files.length < 1) return;
    setResult(null);
    setSortConfig(null);
    setFilters({ brand: '', category: '', productName: '' });
    
    try {
      const { rows, columns } = await processFiles(files, mode, setStatus);
      setResult({ rows, columns });
      if (mode === 'analysis') {
        setViewMode('dashboard');
      }
    } catch (error: any) {
      setStatus({ step: 'error', message: error.message || "Đã xảy ra lỗi không xác định", progress: 0 });
    }
  };

  const handleRowUpdate = (index: number, field: keyof ProcessedRow, value: string) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const handleSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (field: keyof FilterConfig, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const processedRows = useMemo(() => {
    let items = [...rows];
    if (filters.brand || filters.category || filters.productName) {
        const bFilter = filters.brand.toLowerCase();
        const cFilter = filters.category.toLowerCase();
        const nFilter = filters.productName.toLowerCase();
        items = items.filter(item => {
            const b = String(item.brand || '').toLowerCase();
            const c = String(item.category || '').toLowerCase();
            const n = String(item.productName || '').toLowerCase();
            return b.includes(bFilter) && c.includes(cFilter) && n.includes(nFilter);
        });
    }
    if (sortConfig !== null) {
      items.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        const aNum = typeof aVal === 'number' ? aVal : (aVal === undefined || aVal === null ? -Infinity : NaN);
        const bNum = typeof bVal === 'number' ? bVal : (bVal === undefined || bVal === null ? -Infinity : NaN);
        if (!isNaN(aNum) && !isNaN(bNum)) {
             return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }
        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();
        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [rows, sortConfig, filters]);

  const handleDownload = () => {
    if (!result) return;
    const exportData = processedRows.map(row => {
      const out: any = {
        "Brand": row.brand,
        "Phân loại": row.category,
        "Tên sản phẩm": row.productName
      };
      result.columns.forEach(col => {
        out[col] = row[col];
      });
      return out;
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Comparison");
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
    XLSX.writeFile(workbook, `so_sanh_gmv_nhieu_thang_${timestamp}.xlsx`);
  };

  const resetAll = () => {
    setFiles([]);
    setResult(null);
    setRows([]);
    setSortConfig(null);
    setStatus({ step: 'idle', message: '', progress: 0 });
    setViewMode('table');
    setFilters({ brand: '', category: '', productName: '' });
  };

  const renderSortIcon = (columnKey: string) => {
    if (sortConfig?.key !== columnKey) {
      return <ArrowUpDown className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" /> 
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const canProcess = () => {
      if (files.length === 0) return false;
      if (mode === 'append') return files.length >= 2;
      return true; 
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        {/* Mode Select */}
        {!result && (
            <div className="flex justify-center mb-6">
                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex flex-wrap justify-center gap-1">
                    <button 
                        onClick={() => setMode('standard')}
                        className={`flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'standard' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Layers className="w-4 h-4" />
                        Tạo mới (Standard)
                    </button>
                    <button 
                        onClick={() => setMode('append')}
                        className={`flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'append' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <PlusCircle className="w-4 h-4" />
                        Nối dữ liệu (Append)
                    </button>
                    <button 
                        onClick={() => setMode('analysis')}
                        className={`flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'analysis' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <PieChart className="w-4 h-4" />
                        Phân tích có sẵn
                    </button>
                </div>
            </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          
          {/* Info Banner */}
          {!result && (
            <div className={`px-6 py-3 text-sm font-medium border-b flex items-center gap-2 
                ${mode === 'standard' ? 'bg-blue-50/50 text-blue-800 border-blue-100' : 
                  mode === 'append' ? 'bg-indigo-50/50 text-indigo-800 border-indigo-100' :
                  'bg-emerald-50/50 text-emerald-800 border-emerald-100'
                }`}>
                <AlertCircle className="w-4 h-4" />
                {mode === 'standard' && "Chọn tất cả các file thô (T9, T10...). Hệ thống sẽ gộp dựa trên Brand + Tên SP."}
                {mode === 'append' && "Chọn 1 File Tổng Hợp Cũ + File Tháng Mới để nối thêm cột."}
                {mode === 'analysis' && "Chọn 1 file Excel đã tổng hợp sẵn để xem Dashboard."}
            </div>
          )}

          {/* Top Actions Bar */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-4 w-full md:w-auto">
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
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-md shadow-blue-200 active:scale-95 w-full md:w-auto justify-center"
                    >
                    <Upload className="w-5 h-5" />
                    {files.length === 0 ? "Chọn File Excel" : "Thêm File Khác"}
                    </button>
                ) : (
                    <div className="flex flex-wrap bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'table' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Table2 className="w-4 h-4" />
                            Dữ liệu
                        </button>
                        <button
                            onClick={() => setViewMode('dashboard')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            Dashboard
                        </button>
                        <button
                            onClick={() => setViewMode('forecasting')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'forecasting' ? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <BrainCircuit className="w-4 h-4" />
                            Dự báo AI
                        </button>
                    </div>
                )}
                
                {files.length > 0 && (
                   <button 
                     onClick={resetAll}
                     className="px-4 py-3 text-slate-500 hover:text-red-500 font-medium transition-colors"
                     title="Xóa tất cả & Làm lại"
                   >
                     <Trash2 className="w-5 h-5" />
                   </button>
                )}
             </div>

             <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                {status.step !== 'processing' && status.step !== 'reading' ? (
                   !result && (
                    <button
                        disabled={!canProcess()}
                        onClick={handleProcess}
                        className={`flex items-center gap-2 px-8 py-3 font-bold rounded-lg transition-all shadow-md w-full md:w-auto justify-center ${
                        canProcess()
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200 cursor-pointer active:scale-95' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <RefreshCw className="w-5 h-5" />
                        Xử Lý Ngay
                    </button>
                   )
                ) : (
                  <div className="flex items-center gap-3 px-6 py-2 bg-slate-100 rounded-lg border border-slate-200 w-full md:w-auto">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium text-slate-600 whitespace-nowrap">{status.message}</span>
                  </div>
                )}
             </div>
          </div>

          {/* File List */}
          {files.length > 0 && !result && (
             <div className="p-6 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {files.map((file, idx) => (
                    <div key={idx} className="relative flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg group hover:border-blue-300 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-green-100 text-green-700 rounded-md">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 truncate" title={file.name}>{file.name}</span>
                      </div>
                      <button 
                        onClick={() => removeFile(idx)} 
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {/* Error Message */}
          {status.step === 'error' && (
            <div className="p-6 bg-red-50 border-t border-red-100 flex items-center gap-3 text-red-700">
              <AlertCircle className="w-6 h-6" />
              <p>{status.message}</p>
            </div>
          )}
          
          {/* Results Area */}
          {result && status.step === 'completed' && (
            <div className="border-t border-slate-200">
              
              {/* Header Action Row */}
              <div className="p-6 bg-emerald-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                     <CheckCircle2 className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="text-lg font-bold text-slate-800">Xử lý hoàn tất!</h3>
                     <p className="text-slate-500 text-sm">Đã tổng hợp {rows.length} sản phẩm.</p>
                   </div>
                 </div>
                 <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg shadow-emerald-200 transition-all active:scale-95 w-full md:w-auto justify-center"
                 >
                   <Download className="w-5 h-5" />
                   Xuất Excel
                 </button>
              </div>

              {viewMode === 'forecasting' && (
                  <div className="p-6 bg-slate-50/50">
                      <ForecastingTab rows={rows} columns={result.columns} />
                  </div>
              )}

              {viewMode === 'dashboard' && (
                  <div className="p-6 bg-slate-50/50">
                      <AnalyticsDashboard rows={rows} columns={result.columns} />
                  </div>
              )}

              {viewMode === 'table' && (
                <div className="flex flex-col">
                    <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-20">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                             <Filter className="w-4 h-4" />
                             <span>Bộ lọc nhanh:</span>
                        </div>
                        <button
                            onClick={() => setIsEditMode(!isEditMode)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${
                                isEditMode 
                                ? 'bg-amber-100 text-amber-700 shadow-inner' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {isEditMode ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                            {isEditMode ? 'Hoàn tất' : 'Chỉnh sửa'}
                        </button>
                    </div>

                    <div className="overflow-x-auto max-h-[700px] border-b border-slate-200">
                        <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="py-3 px-4 border-b border-slate-200 min-w-[150px]">
                                    <div className="flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => handleSort('brand')}>Brand {renderSortIcon('brand')}</div>
                                    <input type="text" placeholder="Lọc Brand..." className="mt-2 w-full px-2 py-1 text-xs border rounded font-normal" value={filters.brand} onChange={(e) => handleFilterChange('brand', e.target.value)} />
                                </th>
                                <th className="py-3 px-4 border-b border-slate-200 min-w-[150px]">
                                    <div className="flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => handleSort('category')}>Category {renderSortIcon('category')}</div>
                                    <input type="text" placeholder="Lọc Category..." className="mt-2 w-full px-2 py-1 text-xs border rounded font-normal" value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)} />
                                </th>
                                <th className="py-3 px-4 border-b border-slate-200 min-w-[300px]">
                                    <div className="flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => handleSort('productName')}>Sản Phẩm {renderSortIcon('productName')}</div>
                                    <input type="text" placeholder="Tìm tên SP..." className="mt-2 w-full px-2 py-1 text-xs border rounded font-normal" value={filters.productName} onChange={(e) => handleFilterChange('productName', e.target.value)} />
                                </th>
                                {result.columns.map(col => (
                                    <th key={col} className="py-3 px-4 border-b border-slate-200 text-right cursor-pointer hover:bg-slate-200 min-w-[120px]" onClick={() => handleSort(col)}>
                                        <div className="flex items-center justify-end gap-1">{col} {renderSortIcon(col)}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {processedRows.slice(0, 500).map((row, i) => {
                                const originalIndex = rows.indexOf(row); 
                                return (
                                    <tr key={i} className={`hover:bg-blue-50/30 transition-colors`}>
                                        <td className="py-3 px-4 font-medium text-slate-700">
                                            {isEditMode ? <input type="text" className="w-full p-1 border rounded text-sm" value={row.brand} onChange={(e) => handleRowUpdate(originalIndex, 'brand', e.target.value)} /> : row.brand}
                                        </td>
                                        <td className="py-3 px-4 text-slate-600">
                                            {isEditMode ? <input type="text" className="w-full p-1 border rounded text-sm" value={row.category} onChange={(e) => handleRowUpdate(originalIndex, 'category', e.target.value)} /> : row.category}
                                        </td>
                                        <td className="py-3 px-4 text-slate-800">
                                             {isEditMode ? <input type="text" className="w-full p-1 border rounded text-sm" value={row.productName} onChange={(e) => handleRowUpdate(originalIndex, 'productName', e.target.value)} /> : row.productName}
                                        </td>
                                        {result.columns.map(col => (
                                            <td key={col} className="py-3 px-4 text-right text-slate-600 font-mono">
                                                {row[col] ? row[col].toLocaleString('vi-VN') : '-'}
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}
                        </tbody>
                        </table>
                    </div>
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
};

export default GmvComparator;
