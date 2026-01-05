
import React, { useMemo, useState, useRef } from 'react';
import { ProcessedRow } from '../types';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, Area, AreaChart, ComposedChart, ReferenceLine, LabelList
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon, Activity, Zap, Award, Target,
  ArrowUpRight, ArrowDownRight, Package, Calendar, BarChart2, Users, Filter, X, Search, ChevronDown, FileDown, Loader2, Printer, ChevronUp
} from 'lucide-react';

interface Props {
  rows: ProcessedRow[];
  columns: string[]; // List of GMV columns (e.g., "GMV T9", "GMV T10")
}

// Helper to format currency
const formatVND = (value: number) => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toLocaleString('vi-VN');
};

const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

// Helper to clean product name for charts
const cleanProductName = (name: string) => {
    if (!name) return "";
    let n = name.replace(/\[.*?\]/g, "").trim(); // Remove [Tags]
    n = n.replace(/^[-: ]+/, ""); // Remove leading dashes
    if (n.length > 40) {
      return n.substring(0, 38) + "...";
    }
    return n;
};

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#06b6d4'
];

// Color for "Others" category
const OTHER_COLOR = '#94a3b8'; 

const AnalyticsDashboard: React.FC<Props> = ({ rows, columns }) => {
  
  // --- DASHBOARD LOCAL FILTERS ---
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // State for expanding the Top 50 brands table
  const [showAllBrands, setShowAllBrands] = useState(false);
  
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Extract unique options for filters
  const { uniqueBrands, uniqueCategories } = useMemo(() => {
      const b = new Set<string>();
      const c = new Set<string>();
      rows.forEach(r => {
          if (r.brand) b.add(r.brand);
          if (r.category) c.add(r.category);
      });
      return {
          uniqueBrands: Array.from(b).sort(),
          uniqueCategories: Array.from(c).sort()
      };
  }, [rows]);

  // --- FILTER THE DATA ---
  const filteredRows = useMemo(() => {
      return rows.filter(r => {
          const matchBrand = selectedBrand ? r.brand === selectedBrand : true;
          const matchCat = selectedCategory ? r.category === selectedCategory : true;
          const matchSearch = searchTerm ? r.productName.toLowerCase().includes(searchTerm.toLowerCase()) : true;
          return matchBrand && matchCat && matchSearch;
      });
  }, [rows, selectedBrand, selectedCategory, searchTerm]);


  // --- DATA PREPARATION (Based on filteredRows) ---
  const { 
    summaryStats,
    generalTrendData,
    lineChartData, 
    pieChartData, 
    heatmapData, 
    stackedBarData,
    marketGrowthData,
    categoryDriversData,
    risingStarsData,
    activeProductsData,
    growthReportData, // Renamed from brandGrowthReport
    insights
  } = useMemo(() => {
    // 1. Pre-calculation maps
    const categoryMonthMap: Record<string, Record<string, number>> = {};
    const brandMonthMap: Record<string, Record<string, number>> = {};
    const categoryTotalMap: Record<string, number> = {};
    const productTotalMap: Record<string, number> = {};
    const monthlyTotalMap: Record<string, number> = {};
    
    // New: Product Monthly Map for Rising Stars
    const productMonthlyMap: Record<string, Record<string, any>> = {};

    const categories = new Set<string>();
    const brands = new Set<string>();

    columns.forEach(col => monthlyTotalMap[col] = 0);

    filteredRows.forEach((row, idx) => {
      const cat = row.category || "Khác";
      const brand = row.brand || "Khác";
      categories.add(cat);
      brands.add(brand);

      if (!categoryMonthMap[cat]) categoryMonthMap[cat] = {};
      if (!brandMonthMap[brand]) brandMonthMap[brand] = {};

      let rowTotal = 0;
      const productKey = `${idx}_${row.productName}`; 
      productMonthlyMap[productKey] = { name: row.productName };

      columns.forEach(col => {
        const val = Number(row[col]) || 0;
        
        // Category Aggregation
        categoryMonthMap[cat][col] = (categoryMonthMap[cat][col] || 0) + val;
        categoryTotalMap[cat] = (categoryTotalMap[cat] || 0) + val;
        
        // Brand Aggregation
        brandMonthMap[brand][col] = (brandMonthMap[brand][col] || 0) + val;
        
        // Monthly Total
        monthlyTotalMap[col] += val;

        // Product Maps
        productMonthlyMap[productKey][col] = val;

        rowTotal += val;
      });

      productTotalMap[`[${brand}] ${row.productName}`] = rowTotal;
    });

    const uniqueCategoriesFiltered = Array.from(categories);

    // --- PART 0: SUMMARY STATS ---
    const totalGMV = Object.values(monthlyTotalMap).reduce((a, b) => a + b, 0);
    const firstMonthVal = monthlyTotalMap[columns[0]] || 0;
    const lastMonthVal = monthlyTotalMap[columns[columns.length - 1]] || 0;
    const growthRate = firstMonthVal > 0 ? ((lastMonthVal - firstMonthVal) / firstMonthVal) * 100 : 0;
    
    let bestMonth = { name: '', val: 0 };
    Object.entries(monthlyTotalMap).forEach(([key, val]) => {
        if (val > bestMonth.val) bestMonth = { name: key, val };
    });

    const summaryStats = {
        totalGMV,
        growthRate,
        bestMonth,
        totalProducts: filteredRows.length,
        totalBrands: brands.size
    };

    // --- PART 0.5: GENERAL TREND ---
    const generalTrendData = columns.map(col => ({
        name: col.replace('GMV ', ''),
        value: monthlyTotalMap[col]
    }));

    // --- CHART 1: MARKET GROWTH (FIXED) ---
    const marketGrowthData = columns.map((col, idx) => {
        const currentGMV = monthlyTotalMap[col];
        let growthPct = 0;
        if (idx > 0) {
            const prevGMV = monthlyTotalMap[columns[idx - 1]];
            growthPct = prevGMV > 0 ? ((currentGMV - prevGMV) / prevGMV) * 100 : 0;
        }
        return {
            name: col.replace('GMV ', ''),
            gmv: currentGMV / 1000000, // Show in Millions for cleaner axis
            growth: idx === 0 ? 0 : parseFloat(growthPct.toFixed(1)) // Ensure first month is 0 growth
        };
    });

    // --- NEW: GROWTH REPORT (Brand vs Product Logic) ---
    let growthReportData;

    if (selectedBrand) {
        // === PRODUCT LEVEL VIEW (When a brand is selected) ===
        growthReportData = filteredRows.map(row => {
            const rowData: any = { name: row.productName, type: 'PRODUCT' };
            let total = 0;
            columns.forEach((col, idx) => {
                const currentVal = Number(row[col]) || 0;
                total += currentVal;

                let growth = 0;
                let status: 'new' | 'increase' | 'decrease' | 'stable' = 'stable';

                if (idx > 0) {
                    const prevVal = Number(row[columns[idx-1]]) || 0;
                    if (prevVal === 0 && currentVal > 0) {
                        status = 'new';
                    } else if (prevVal > 0) {
                        growth = ((currentVal - prevVal) / prevVal) * 100;
                        status = growth > 0 ? 'increase' : (growth < 0 ? 'decrease' : 'stable');
                    }
                } else {
                    status = currentVal > 0 ? 'stable' : 'stable';
                }

                rowData[col] = {
                    value: currentVal,
                    growth: growth,
                    status: status
                };
            });
            rowData.totalGMV = total;
            return rowData;
        }).sort((a, b) => b.totalGMV - a.totalGMV);

    } else {
        // === BRAND LEVEL VIEW (Default) ===
        growthReportData = Array.from(brands).map(brand => {
            const rowData: any = { name: brand, type: 'BRAND' };
            let total = 0;
            columns.forEach((col, idx) => {
                const currentVal = brandMonthMap[brand][col] || 0;
                total += currentVal;
                
                let growth = 0;
                let status: 'new' | 'increase' | 'decrease' | 'stable' = 'stable';
                
                if (idx > 0) {
                    const prevVal = brandMonthMap[brand][columns[idx-1]] || 0;
                    if (prevVal === 0 && currentVal > 0) {
                        status = 'new';
                    } else if (prevVal > 0) {
                        growth = ((currentVal - prevVal) / prevVal) * 100;
                        status = growth > 0 ? 'increase' : (growth < 0 ? 'decrease' : 'stable');
                    }
                } else {
                    status = currentVal > 0 ? 'stable' : 'stable';
                }

                rowData[col] = {
                    value: currentVal,
                    growth: growth,
                    status: status
                };
            });
            rowData.totalGMV = total;
            return rowData;
        }).sort((a, b) => b.totalGMV - a.totalGMV);
    }


    // --- CHART 2: CATEGORY DRIVERS ---
    const categoryDriversData = uniqueCategoriesFiltered.map(cat => {
        const first = categoryMonthMap[cat][columns[0]] || 0;
        const last = categoryMonthMap[cat][columns[columns.length - 1]] || 0;
        const diff = last - first;
        return {
            name: cat,
            value: diff / 1000000,
            rawDiff: diff
        };
    }).sort((a, b) => b.value - a.value);

    // --- CHART 3: RISING STARS ---
    const risingStarsData = Object.values(productMonthlyMap).map((p: any) => {
        const first = p[columns[0]] || 0;
        const last = p[columns[columns.length - 1]] || 0;
        const diff = last - first;
        return {
            name: cleanProductName(p.name),
            fullName: p.name,
            value: diff / 1000000,
            rawDiff: diff
        };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

    // --- CHART 4: ACTIVE PRODUCTS ---
    const activeProductsData = columns.map(col => {
        let count = 0;
        filteredRows.forEach(r => {
            if ((Number(r[col]) || 0) > 0) count++;
        });
        return {
            name: col.replace('GMV ', ''),
            count
        };
    });

    // --- EXISTING CHARTS ---
    const lineChartData = columns.map(col => {
      const point: any = { name: col.replace('GMV ', '') };
      uniqueCategoriesFiltered.forEach(cat => {
        point[cat] = categoryMonthMap[cat][col] || 0;
      });
      return point;
    });

    // --- OPTIMIZED PIE CHART DATA (Group Small Values) ---
    const rawPieData = uniqueCategoriesFiltered
      .map(cat => ({ name: cat, value: categoryTotalMap[cat] }))
      .sort((a, b) => b.value - a.value);
    
    let pieChartData = rawPieData;
    
    // If more than 8 categories, group them into "Khác"
    const MAX_PIE_SLICES = 8;
    if (rawPieData.length > MAX_PIE_SLICES) {
        const top = rawPieData.slice(0, MAX_PIE_SLICES);
        const others = rawPieData.slice(MAX_PIE_SLICES);
        const otherTotal = others.reduce((sum, item) => sum + item.value, 0);
        
        if (otherTotal > 0) {
            top.push({ name: 'Khác', value: otherTotal });
        }
        pieChartData = top;
    }

    // Heatmap
    let maxCellVal = 0;
    const heatmapRows = uniqueCategoriesFiltered.map(cat => {
      const cellData = columns.map(col => {
        const val = categoryMonthMap[cat][col] || 0;
        if (val > maxCellVal) maxCellVal = val;
        return { col, val };
      });
      return { category: cat, cells: cellData };
    });
    heatmapRows.sort((a, b) => categoryTotalMap[b.category] - categoryTotalMap[a.category]);
    const heatmapData = { rows: heatmapRows, maxVal: maxCellVal };

    // Stacked Bar
    const topBrands = Array.from(brands)
      .map(b => {
        const total = columns.reduce((sum, col) => sum + (brandMonthMap[b][col] || 0), 0);
        return { name: b, total };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(b => b.name);

    const stackedBarData = topBrands.map(brand => {
      const point: any = { name: brand };
      columns.forEach(col => {
        point[col] = brandMonthMap[brand][col] || 0;
      });
      return point;
    });

    // --- AUTOMATED INSIGHTS ---
    const insightsList: { title: string, content: string, type: 'positive' | 'negative' | 'neutral' }[] = [];

    const lastGrowth = marketGrowthData[marketGrowthData.length - 1].growth;
    const peakGrowth = Math.max(...marketGrowthData.map(m => m.growth));
    insightsList.push({
        title: "Tốc độ tăng trưởng thị trường",
        content: `Tháng cuối đạt tốc độ ${lastGrowth > 0 ? '+' : ''}${lastGrowth}%. Đỉnh điểm tăng trưởng là +${peakGrowth}% trong giai đoạn này.`,
        type: lastGrowth > 0 ? 'positive' : 'neutral'
    });

    if (categoryDriversData.length > 0) {
      const topDriver = categoryDriversData[0];
      insightsList.push({
          title: "Động cơ tăng trưởng (Ngành hàng)",
          content: `${topDriver.name} là động lực chính, mang về thêm ${formatVND(topDriver.rawDiff)} so với đầu kỳ.`,
          type: 'positive'
      });
    }

    return { 
      summaryStats,
      generalTrendData,
      marketGrowthData,
      categoryDriversData,
      risingStarsData,
      activeProductsData,
      growthReportData,
      lineChartData, 
      pieChartData, 
      heatmapData, 
      stackedBarData,
      insights: insightsList 
    };

  }, [filteredRows, columns, selectedBrand]); // Re-run when filteredRows or selectedBrand changes

  const getHeatmapColor = (value: number, max: number) => {
    if (value === 0) return '#f1f5f9';
    const intensity = value / max;
    return `rgba(37, 99, 235, ${0.1 + (intensity * 0.9)})`;
  };

  const resetFilters = () => {
      setSelectedBrand('');
      setSelectedCategory('');
      setSearchTerm('');
  };

  const handlePrint = () => {
      window.print();
  };

  return (
    <div id="dashboard-print-container" className="space-y-8 animate-in fade-in duration-500 bg-slate-50 p-2 md:p-0" ref={dashboardRef}>
      
      {/* === DASHBOARD FILTERS (Hidden on Print) === */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-0 z-20 no-print">
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="p-2 bg-slate-100 rounded-lg"><Filter className="w-5 h-5 text-slate-500" /></div>
                  <h3 className="font-bold text-slate-700 hidden md:block">Bộ lọc Dashboard</h3>
              </div>

              <div className="flex flex-col md:flex-row gap-2 w-full">
                  {/* Brand Filter */}
                  <div className="relative group min-w-[200px]">
                      <select 
                        value={selectedBrand}
                        onChange={(e) => setSelectedBrand(e.target.value)}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium cursor-pointer hover:bg-slate-100"
                      >
                          <option value="">Tất cả Thương hiệu</option>
                          {uniqueBrands.map(b => (
                              <option key={b} value={b}>{b}</option>
                          ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Category Filter */}
                  <div className="relative group min-w-[200px]">
                      <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium cursor-pointer hover:bg-slate-100"
                      >
                          <option value="">Tất cả Ngành hàng</option>
                          {uniqueCategories.map(c => (
                              <option key={c} value={c}>{c}</option>
                          ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Search Input */}
                  <div className="relative flex-grow">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Tìm theo tên sản phẩm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-9 pr-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                  </div>
              </div>

              <div className="flex items-center gap-2">
                 {/* Reset Button */}
                {(selectedBrand || selectedCategory || searchTerm) && (
                    <button 
                        onClick={resetFilters}
                        className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium whitespace-nowrap px-3 py-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                        <X className="w-4 h-4" />
                        Xóa lọc
                    </button>
                )}

                 {/* Print Button */}
                 <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap"
                 >
                    <Printer className="w-4 h-4" />
                    In Báo Cáo / Lưu PDF
                 </button>
              </div>
              
          </div>
          <div className="mt-2 text-xs text-slate-400 flex justify-end">
              Đang hiển thị {summaryStats.totalProducts} sản phẩm
          </div>
      </div>

      {/* === 1. GENERAL OVERVIEW === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 break-inside-avoid">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><DollarSign className="w-5 h-5"/></div>
                  <span className="text-slate-500 text-sm font-medium">Tổng GMV (Tích lũy)</span>
              </div>
              <div className="text-2xl font-bold text-slate-800">{formatVND(summaryStats.totalGMV)}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${summaryStats.growthRate >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                     {summaryStats.growthRate >= 0 ? <TrendingUp className="w-5 h-5"/> : <TrendingDown className="w-5 h-5"/>}
                  </div>
                  <span className="text-slate-500 text-sm font-medium">Tăng trưởng toàn đợt</span>
              </div>
              <div className={`text-2xl font-bold ${summaryStats.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summaryStats.growthRate > 0 ? '+' : ''}{summaryStats.growthRate.toFixed(1)}%
              </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Calendar className="w-5 h-5"/></div>
                  <span className="text-slate-500 text-sm font-medium">Tháng Cao Điểm</span>
              </div>
              <div className="text-2xl font-bold text-slate-800">{summaryStats.bestMonth.name.replace('GMV ', '')}</div>
              <div className="text-xs text-slate-400 mt-1">{formatVND(summaryStats.bestMonth.val)}</div>
          </div>
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Package className="w-5 h-5"/></div>
                  <span className="text-slate-500 text-sm font-medium">Sản phẩm / Thương hiệu</span>
              </div>
              <div className="text-2xl font-bold text-slate-800">{summaryStats.totalProducts} <span className="text-sm text-slate-400 font-normal">SKUs</span></div>
              <div className="text-xs text-slate-400 mt-1">Từ {summaryStats.totalBrands} thương hiệu</div>
          </div>
      </div>

      {/* === 2. NEW CHARTS: GROWTH & PERFORMANCE === */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-6 border-l-4 border-emerald-500 pl-3 flex items-center gap-2 break-inside-avoid">
            Phân tích Tăng trưởng & Hiệu suất 
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* CHART 1: Market Growth Speed (FIXED) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Tốc độ tăng trưởng toàn thị trường</h3>
                        <p className="text-xs text-slate-400">Kết hợp Tổng GMV (Cột) và % Tăng trưởng (Đường)</p>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-lg"><BarChart2 className="w-5 h-5 text-emerald-600" /></div>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={marketGrowthData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} dy={10} />
                            
                            {/* Left Axis: Money (GMV) */}
                            <YAxis 
                                yAxisId="left" 
                                orientation="left" 
                                stroke="#66cdaa" 
                                label={{ value: 'Tổng GMV (Triệu VNĐ)', angle: -90, position: 'insideLeft', fill: '#66cdaa', fontSize: 11 }} 
                                tickFormatter={(val) => val.toLocaleString()} 
                            />
                            
                            {/* Right Axis: Percentage (Growth) */}
                            <YAxis 
                                yAxisId="right" 
                                orientation="right" 
                                stroke="#ff7f50" 
                                label={{ value: 'Tăng trưởng (%)', angle: 90, position: 'insideRight', fill: '#ff7f50', fontSize: 11 }} 
                            />
                            
                            <Tooltip 
                                formatter={(value: any, name: string) => {
                                    if (name === '% Tăng trưởng') return [`${value}%`, name];
                                    return [formatVND(value * 1000000), name];
                                }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            
                            <Bar yAxisId="left" dataKey="gmv" fill="#66cdaa" barSize={50} radius={[4, 4, 0, 0]} name="Doanh số" />
                            {/* Explicitly bind Line to right axis */}
                            <Line yAxisId="right" type="monotone" dataKey="growth" stroke="#ff7f50" strokeWidth={3} dot={{r: 4}} name="% Tăng trưởng" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* CHART 2: Category Drivers (FIXED: Increased YAxis width and margins) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Ngành hàng nào đang kéo/đẩy đà tăng trưởng?</h3>
                        <p className="text-xs text-slate-400">Chênh lệch GMV tuyệt đối (Tháng cuối vs Tháng đầu)</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg"><ArrowUpRight className="w-5 h-5 text-blue-600" /></div>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={categoryDriversData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                            <XAxis type="number" tickFormatter={(val) => formatVND(val * 1000000)} label={{ value: 'Mức tăng/giảm GMV (Triệu VNĐ)', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={180} tick={{fontSize: 11}} interval={0} />
                            <Tooltip formatter={(value: number) => formatVND(value * 1000000)} />
                            <ReferenceLine x={0} stroke="#000" />
                            <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]}>
                                {categoryDriversData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* CHART 3: Rising Stars */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Top 5 "Ngôi sao đang lên"</h3>
                        <p className="text-xs text-slate-400">Sản phẩm có mức tăng doanh số tuyệt đối cao nhất (T_cuối vs T_đầu)</p>
                    </div>
                    <div className="p-2 bg-yellow-50 rounded-lg"><Award className="w-5 h-5 text-yellow-600" /></div>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={risingStarsData} margin={{left: 0, right: 50, top: 0, bottom: 0}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={0} tick={false} axisLine={false} />
                            <Tooltip 
                                cursor={{fill: '#f8fafc'}}
                                content={({ payload, active }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white p-2 border border-slate-200 shadow-lg rounded text-xs max-w-[300px]">
                                                <p className="font-bold mb-1">{data.fullName}</p>
                                                <p className="text-emerald-600">+{formatVND(data.rawDiff)}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="value" fill="#8da0cb" barSize={40} radius={[0, 4, 4, 0]}>
                                 <LabelList 
                                    dataKey="name" 
                                    position="insideLeft" 
                                    style={{ fill: '#fff', fontSize: '11px', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }} 
                                 />
                                 <LabelList 
                                    dataKey="rawDiff" 
                                    position="right" 
                                    formatter={(val: number) => formatVND(val)}
                                    style={{ fill: '#64748b', fontSize: '11px', fontWeight: 'bold' }} 
                                 />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

             {/* CHART 4: Active Products */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Số lượng sản phẩm có phát sinh đơn hàng</h3>
                        <p className="text-xs text-slate-400">Độ sâu của danh mục sản phẩm (Active Products)</p>
                    </div>
                    <div className="p-2 bg-pink-50 rounded-lg"><Users className="w-5 h-5 text-pink-600" /></div>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activeProductsData}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                            <Tooltip />
                            <Area type="monotone" dataKey="count" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" name="Số SP Active" />
                            {/* Labels on points */}
                            <Line type="monotone" dataKey="count" stroke="none" label={{ position: 'top', fill: '#000', fontSize: 12, fontWeight: 'bold' }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
      </div>

      {/* === 3. NEW: MONTHLY REVENUE GROWTH REPORT (Top Brands / Products) === */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
          <div className="flex justify-between items-center mb-6">
            <div>
                 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-indigo-600" />
                    {selectedBrand ? `Chi tiết Sản phẩm thuộc Brand: ${selectedBrand}` : 'Báo cáo so sánh tăng trưởng doanh thu theo tháng'}
                 </h3>
                 <p className="text-slate-500 text-sm mt-1">Chi tiết doanh số và % tăng trưởng theo từng tháng cho Brand/Category đang lọc</p>
            </div>
            <div className="text-xs font-medium px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                {showAllBrands ? `Hiển thị Top 50 ${selectedBrand ? 'Sản phẩm' : 'Brand'} hàng đầu` : `Hiển thị Top 10 ${selectedBrand ? 'Sản phẩm' : 'Brand'} hàng đầu`}
            </div>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="border-b border-slate-200">
                          <th className="py-4 px-4 font-semibold text-slate-500 text-sm uppercase tracking-wider min-w-[250px]">
                              {selectedBrand ? 'TÊN SẢN PHẨM' : 'TÊN (BRAND/CATEGORY)'}
                          </th>
                          {columns.map((col, idx) => (
                              <th key={col} className="py-4 px-4 font-semibold text-slate-500 text-sm text-right min-w-[150px]">
                                  <div className="flex flex-col">
                                    <span className="uppercase">{col.replace('GMV ', '')}</span>
                                    {idx > 0 && <span className="text-[10px] normal-case font-normal text-slate-400">vs tháng trước</span>}
                                  </div>
                              </th>
                          ))}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {growthReportData.slice(0, showAllBrands ? 50 : 10).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${idx < 3 ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                      <div>
                                          <div className="font-bold text-slate-700 text-sm">{row.name}</div>
                                          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{row.type}</div>
                                      </div>
                                  </div>
                              </td>
                              {columns.map(col => {
                                  const cellData = row[col];
                                  const isZero = cellData.value === 0;
                                  
                                  return (
                                    <td key={col} className="py-4 px-4 text-right align-top">
                                        <div className="font-medium text-slate-700 mb-1">
                                            {isZero ? '-' : formatVND(cellData.value)}
                                        </div>
                                        {!isZero && cellData.status !== 'stable' && (
                                            <div className={`text-xs font-bold inline-flex items-center gap-1 ${
                                                cellData.status === 'new' ? 'text-emerald-600 bg-emerald-50 px-1.5 rounded' : 
                                                cellData.status === 'increase' ? 'text-emerald-500' : 'text-red-500'
                                            }`}>
                                                {cellData.status === 'increase' && <TrendingUp className="w-3 h-3" />}
                                                {cellData.status === 'decrease' && <TrendingDown className="w-3 h-3" />}
                                                
                                                {cellData.status === 'new' ? 'New' : formatPercent(cellData.growth)}
                                            </div>
                                        )}
                                    </td>
                                  )
                              })}
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
          
          <div className="mt-4 flex justify-center no-print">
            <button 
                onClick={() => setShowAllBrands(!showAllBrands)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-semibold rounded-lg transition-all"
            >
                {showAllBrands ? (
                    <>
                        <ChevronUp className="w-4 h-4" />
                        Thu gọn
                    </>
                ) : (
                    <>
                        <ChevronDown className="w-4 h-4" />
                        Xem thêm Top 50 {selectedBrand ? 'Sản phẩm' : 'Brand'}
                    </>
                )}
            </button>
          </div>
      </div>

      {/* === 4. ORIGINAL CHARTS: Category & Brand === */}
      <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4 border-l-4 border-blue-500 pl-3 break-inside-avoid">Phân tích Chi tiết Khác</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 break-inside-avoid">
        
        {/* A. LINE CHART */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Xu hướng GMV theo Ngành hàng
            </h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => formatVND(val)} />
                <Tooltip 
                   // FIX: Removed 'shared={false}' which was making single items appear. 
                   // We want a shared tooltip but FILTERED to only top items to avoid overflow.
                   trigger="hover"
                   content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                            // 1. Sort by Value Descending
                            const sortedPayload = [...payload].sort((a: any, b: any) => Number(b.value) - Number(a.value));
                            // 2. Take Top 5
                            const topItems = sortedPayload.slice(0, 5);
                            const remainingCount = sortedPayload.length - 5;

                            return (
                                <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg min-w-[200px] z-50">
                                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</p>
                                    {topItems.map((entry: any, index: number) => (
                                        <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
                                            <div className="w-2 h-2 rounded-full shadow-sm shrink-0" style={{ backgroundColor: entry.color }}></div>
                                            <span className="text-sm font-medium text-slate-600 truncate flex-1" title={entry.name}>{entry.name}</span>
                                            <span className="text-sm font-bold text-slate-800">{formatVND(Number(entry.value))}</span>
                                        </div>
                                    ))}
                                    {remainingCount > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500 italic text-center">
                                            ... và {remainingCount} ngành hàng khác
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                   }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                {Object.keys(lineChartData[0] || {}).filter(k => k !== 'name').map((cat, idx) => (
                  <Line 
                    key={cat} 
                    type="monotone" 
                    dataKey={cat} 
                    stroke={COLORS[idx % COLORS.length]} 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* B. PIE CHART */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
           <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-emerald-600" />
              Tỷ trọng GMV theo Ngành hàng
            </h3>
          </div>
          <div className="h-[350px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell 
                        key={`cell-${index}`} 
                        fill={entry.name === 'Khác' ? OTHER_COLOR : COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatVND(value)} />
                <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle" 
                    wrapperStyle={{ 
                        fontSize: '11px', 
                        maxWidth: '120px', 
                        maxHeight: '300px', // FIX: Constrain height
                        overflowY: 'auto', // FIX: Scroll if too many items (though we grouped them now)
                        paddingRight: '10px'
                    }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pr-[120px]">
               <div className="text-center">
                 <span className="block text-xs text-slate-400">Total</span>
                 <span className="block text-xl font-bold text-slate-700">
                    {formatVND(pieChartData.reduce((a,b) => a + b.value, 0))}
                 </span>
               </div>
            </div>
          </div>
        </div>

        {/* C. HEATMAP */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden break-inside-avoid">
           <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" />
              Heatmap: Ngành hàng vs Tháng
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium bg-slate-50 rounded-tl-lg">Ngành hàng</th>
                  {columns.map(col => (
                    <th key={col} className="py-2 px-2 text-slate-500 font-medium min-w-[80px] bg-slate-50 last:rounded-tr-lg">
                      {col.replace('GMV ', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.rows.map((row) => (
                  <tr key={row.category} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                     <td className="text-left py-2 px-3 font-medium text-slate-700 truncate max-w-[140px]" title={row.category}>
                        {row.category}
                     </td>
                     {row.cells.map(cell => (
                       <td key={cell.col} className="p-1">
                          <div 
                            className="w-full h-8 rounded flex items-center justify-center text-[10px] text-slate-700 font-medium transition-all hover:scale-105 cursor-default"
                            style={{ 
                              backgroundColor: getHeatmapColor(cell.val, heatmapData.maxVal),
                              color: cell.val / heatmapData.maxVal > 0.6 ? 'white' : '#334155'
                            }}
                            title={`${formatVND(cell.val)}`}
                          >
                             {formatVND(cell.val)}
                          </div>
                       </td>
                     ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* D. STACKED BAR */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
           <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              Top 10 Thương hiệu lớn nhất
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedBarData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={100}
                  tick={{ fontSize: 11, fill: '#475569' }} 
                />
                <Tooltip 
                   cursor={{fill: '#f1f5f9'}}
                   formatter={(value: number) => formatVND(value)}
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {columns.map((col, idx) => (
                  <Bar 
                    key={col} 
                    dataKey={col} 
                    stackId="a" 
                    fill={COLORS[idx % COLORS.length]} 
                    name={col.replace('GMV ', '')}
                    radius={idx === columns.length -1 ? [0, 4, 4, 0] : [0,0,0,0]}
                    barSize={20}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* === 5. INSIGHTS === */}
      <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-6 border border-indigo-100 shadow-sm break-inside-avoid">
         <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Zap className="w-6 h-6" />
            </div>
            <div>
                <h3 className="text-xl font-bold text-slate-800">Insight Phân tích Chuyên sâu</h3>
                <p className="text-sm text-slate-500">Phân tích tự động dựa trên dữ liệu ngành hàng, sản phẩm và thời gian</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                         {insight.type === 'positive' && <ArrowUpRight className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />}
                         {insight.type === 'negative' && <ArrowDownRight className="w-5 h-5 text-red-500 mt-1 shrink-0" />}
                         {insight.type === 'neutral' && <Target className="w-5 h-5 text-blue-500 mt-1 shrink-0" />}
                         
                         <div>
                             <h4 className="font-bold text-slate-800 text-sm mb-1">{insight.title}</h4>
                             <p className="text-sm text-slate-600 leading-relaxed">
                                 {insight.content}
                             </p>
                         </div>
                    </div>
                </div>
            ))}
         </div>
         
         <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
             <Award className="w-5 h-5 text-amber-600 mt-1 shrink-0" />
             <div>
                 <h4 className="font-bold text-slate-800 text-sm mb-1">Đề xuất Hành động (Actionable)</h4>
                 <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                     <li>Đẩy mạnh tồn kho cho nhóm <strong>{insights[0]?.title.includes('Ngành hàng') ? insights[0].title.replace('🏆 ', '') : 'Sản phẩm chủ lực'}</strong> trong tháng tới.</li>
                     <li>Review lại chiến lược giá cho các nhóm có dấu hiệu suy giảm nhiệt.</li>
                     <li>Tập trung marketing vào {summaryStats.bestMonth.name.replace('GMV ', '')} năm sau để tối ưu doanh thu.</li>
                 </ul>
             </div>
         </div>
      </div>

    </div>
  );
};

export default AnalyticsDashboard;
