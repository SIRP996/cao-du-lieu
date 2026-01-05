
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell 
} from 'recharts';
import { 
  Upload, FileText, CheckCircle2, AlertCircle, TrendingUp, 
  MousePointerClick, Eye, DollarSign, Video, Lightbulb, ArrowRight
} from 'lucide-react';

interface VideoMetric {
  id: number;
  productName: string;
  videoCount: number;
  impressions: number;
  clicks: number;
  orders: number;
  revenue: number;
  // Calculated
  cvr: number;     
  aov: number;     
  revPerVideo: number; 
}

const VideoAnalytics = () => {
  const [data, setData] = useState<VideoMetric[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // --- HELPER: Clean Product Name ---
  const cleanProductName = (name: string) => {
    if (!name) return "";
    // 1. Remove content inside square brackets [] (e.g. [ĐỘC QUYỀN])
    let n = name.replace(/\[.*?\]/g, " ").trim();
    
    // 2. Remove extra spaces created by removal
    n = n.replace(/\s+/g, " ");

    // 3. Remove leading dashes/colons
    n = n.replace(/^[-: ]+/, "");

    // 4. Smart Truncate
    if (n.length > 50) {
      return n.substring(0, 48) + "...";
    }
    return n;
  };

  // --- 1. DATA PROCESSING ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFileName(file.name);
      setIsProcessing(true);

      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json(ws);
        
        processData(rawData);
      };
      reader.readAsBinaryString(file);
    }
  };

  const processData = (rawData: any[]) => {
    // Helper: Clean number parsing
    const parseNum = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const clean = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '');
      return parseFloat(clean) || 0;
    };

    const processed: VideoMetric[] = rawData.map((row: any, index: number) => {
      // Mapping Vietnamese Headers
      const productName = row['Tên sản phẩm'] || row['Product Name'] || `Unknown Product ${index}`;
      
      const videoCount = parseNum(row['Count of Video ID']);
      const impressions = parseNum(row['Sum of Product ad impressions']);
      const clicks = parseNum(row['Sum of Product ad clicks']);
      const orders = parseNum(row['Sum of SKU orders']);
      const revenue = parseNum(row['Sum of Gross revenue']);

      // Metrics Calculation
      const cvr = clicks > 0 ? (orders / clicks) * 100 : 0;
      const aov = orders > 0 ? revenue / orders : 0;
      const revPerVideo = videoCount > 0 ? revenue / videoCount : 0;

      return {
        id: index,
        productName,
        videoCount,
        impressions,
        clicks,
        orders,
        revenue,
        cvr,
        aov,
        revPerVideo
      };
    });

    // Filter noise: Remove rows with 0 revenue AND 0 impressions
    const cleaned = processed
      .filter(d => d.revenue > 0 || d.impressions > 0)
      .sort((a, b) => b.revenue - a.revenue);

    setData(cleaned);
    setIsProcessing(false);
  };

  // --- 2. AGGREGATIONS & CHART DATA ---
  const kpis = useMemo(() => {
    const totalRev = data.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalOrders = data.reduce((acc, curr) => acc + curr.orders, 0);
    const totalImpressions = data.reduce((acc, curr) => acc + curr.impressions, 0);
    const topProduct = data.length > 0 ? cleanProductName(data[0].productName) : "N/A";
    
    return { totalRev, totalOrders, totalImpressions, topProduct };
  }, [data]);

  const top10Revenue = data.slice(0, 10);
  
  const top10CVR = useMemo(() => {
    // Filter: Must have significant data (> 50 clicks) to compare CVR fairly
    return [...data]
      .filter(d => d.clicks > 50)
      .sort((a, b) => b.cvr - a.cvr)
      .slice(0, 10);
  }, [data]);

  const top10RevPerVideo = useMemo(() => {
    return [...data]
      .filter(d => d.videoCount > 0)
      .sort((a, b) => b.revPerVideo - a.revPerVideo)
      .slice(0, 10);
  }, [data]);

  // --- 3. AUTOMATED INSIGHTS ---
  const insights = useMemo(() => {
    if (data.length === 0) return null;

    const avgCVR = data.reduce((acc, c) => acc + c.cvr, 0) / data.length;
    const avgImp = data.reduce((acc, c) => acc + c.impressions, 0) / data.length;

    // Recommendation Logic
    const highPotential = data.filter(d => d.cvr > avgCVR && d.impressions < avgImp);
    const inefficient = data.filter(d => d.cvr < avgCVR && d.impressions > avgImp);

    return {
      avgCVR: avgCVR.toFixed(2),
      highPotentialCount: highPotential.length,
      inefficientCount: inefficient.length,
      topExample: highPotential.length > 0 ? cleanProductName(highPotential[0].productName) : null
    };
  }, [data]);

  const formatVND = (val: number) => {
    if (val >= 1000000000) return (val / 1000000000).toFixed(1) + 'B';
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return val.toString();
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
        <div className="p-6 bg-white rounded-full shadow-lg mb-6">
          <Video className="w-16 h-16 text-indigo-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Phân Tích Hiệu Quả Video</h3>
        <p className="text-slate-500 mb-8 text-center max-w-lg">
          Upload file Excel chứa dữ liệu video (Tên sản phẩm, Impressions, Clicks, Orders, Revenue...) để hệ thống tự động phân tích chiến lược.
        </p>
        <label className="cursor-pointer px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          {isProcessing ? "Đang xử lý..." : "Chọn File Excel"}
          <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                <Video className="w-5 h-5" />
            </div>
            <div>
                <h2 className="font-bold text-slate-800">Video Performance Analytics</h2>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <FileText className="w-3 h-3" />
                    <span>{fileName}</span>
                    <span>•</span>
                    <span>{data.length} Sản phẩm</span>
                </div>
            </div>
         </div>
         <label className="text-sm font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer hover:underline">
            Upload file khác
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
         </label>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-2 mb-2 text-slate-500 text-sm font-bold uppercase tracking-wider">
             <DollarSign className="w-4 h-4 text-emerald-500"/> Tổng Doanh Thu
           </div>
           <div className="text-2xl font-black text-slate-800">{formatVND(kpis.totalRev)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-2 mb-2 text-slate-500 text-sm font-bold uppercase tracking-wider">
             <MousePointerClick className="w-4 h-4 text-blue-500"/> Tổng Đơn Hàng
           </div>
           <div className="text-2xl font-black text-slate-800">{kpis.totalOrders.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-2 mb-2 text-slate-500 text-sm font-bold uppercase tracking-wider">
             <Eye className="w-4 h-4 text-purple-500"/> Tổng Lượt Xem
           </div>
           <div className="text-2xl font-black text-slate-800">{formatVND(kpis.totalImpressions)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-2 mb-2 text-slate-500 text-sm font-bold uppercase tracking-wider">
             <TrendingUp className="w-4 h-4 text-amber-500"/> Top 1 Sản Phẩm
           </div>
           <div className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight" title={kpis.topProduct}>
             {kpis.topProduct}
           </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Top Revenue */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            Top 10 Sản Phẩm Theo Doanh Thu (GMV)
          </h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={top10Revenue} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                <XAxis type="number" tickFormatter={(v) => formatVND(v)} />
                <YAxis type="category" dataKey="productName" width={10} tick={false} />
                <Tooltip 
                    contentStyle={{borderRadius: '8px'}}
                    labelStyle={{display: 'none'}}
                    formatter={(val: number, name: string, props: any) => [new Intl.NumberFormat('vi-VN').format(val), props.payload.productName]}
                />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20}>
                    {top10Revenue.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#4338ca', '#4f46e5', '#6366f1', '#818cf8'][index % 4] || '#a5b4fc'} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
             {/* Custom Labels Overlay with Cleaned Name */}
             <div className="mt-[-400px] ml-2 pointer-events-none absolute h-[400px] w-full flex flex-col justify-around py-2">
                 {top10Revenue.map((d, i) => (
                     <div key={i} className="text-[10px] text-slate-600 font-medium truncate w-[60%] bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                         {cleanProductName(d.productName)}
                     </div>
                 ))}
             </div>
          </div>
        </div>

        {/* Chart 2: Scatter Plot (Impressions vs Revenue) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            Tương Quan: Tiếp Cận (Impressions) vs Doanh Thu
          </h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="impressions" name="Lượt Hiển Thị" unit="" tickFormatter={(v) => formatVND(v)} label={{ value: 'Lượt Hiển Thị (Impressions)', position: 'insideBottom', offset: -10, fontSize: 12 }} />
                <YAxis type="number" dataKey="revenue" name="Doanh Thu" unit=" VNĐ" tickFormatter={(v) => formatVND(v)} label={{ value: 'Doanh Thu (VNĐ)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                <ZAxis type="number" dataKey="cvr" range={[50, 500]} name="CVR" unit="%" />
                <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                                <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg text-xs">
                                    <p className="font-bold mb-1 max-w-[200px] truncate">{cleanProductName(data.productName)}</p>
                                    <p>Impressions: <span className="font-semibold">{data.impressions.toLocaleString()}</span></p>
                                    <p>Revenue: <span className="font-semibold text-emerald-600">{data.revenue.toLocaleString()}</span></p>
                                    <p>CVR: <span className="font-semibold text-blue-600">{data.cvr.toFixed(2)}%</span></p>
                                    <p>Orders: {data.orders}</p>
                                </div>
                            );
                        }
                        return null;
                    }}
                />
                <Legend />
                <Scatter name="Sản phẩm" data={data} fill="#6366f1" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Top CVR */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
           <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            Top 10 Sản Phẩm Có Tỷ Lệ Chuyển Đổi (CVR) Cao Nhất
            <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">(Min &gt; 50 clicks)</span>
          </h3>
          <div className="h-[400px]">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={top10CVR} margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="productName" width={10} tick={false} />
                <Tooltip 
                    contentStyle={{borderRadius: '8px'}}
                    labelStyle={{display: 'none'}}
                    formatter={(val: number, name: string, props: any) => [`${val.toFixed(2)}%`, props.payload.productName]}
                />
                <Bar dataKey="cvr" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', formatter: (v: number) => `${v.toFixed(2)}%`, fontSize: 11, fill: '#334155' }}>
                    {top10CVR.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#9d174d', '#be185d', '#db2777', '#ec4899'][index % 4]} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Custom Labels Overlay with Cleaned Name */}
            <div className="mt-[-400px] ml-2 pointer-events-none absolute h-[400px] w-full flex flex-col justify-around py-2">
                 {top10CVR.map((d, i) => (
                     <div key={i} className="text-[10px] text-slate-600 font-medium truncate w-[60%] bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                         {cleanProductName(d.productName)}
                     </div>
                 ))}
            </div>
          </div>
        </div>

        {/* Chart 4: Rev Per Video */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
           <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            Hiệu Quả Nội Dung: Doanh Thu Trung Bình Trên Mỗi Video
          </h3>
          <div className="h-[400px]">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={top10RevPerVideo} margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tickFormatter={(v) => formatVND(v)}/>
                <YAxis type="category" dataKey="productName" width={10} tick={false} />
                <Tooltip 
                    contentStyle={{borderRadius: '8px'}}
                    labelStyle={{display: 'none'}}
                    formatter={(val: number, name: string, props: any) => [`${new Intl.NumberFormat('vi-VN').format(val)} đ/video`, props.payload.productName]}
                />
                <Bar dataKey="revPerVideo" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', formatter: (v: number) => formatVND(v), fontSize: 11, fill: '#334155' }}>
                     {top10RevPerVideo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#78350f', '#92400e', '#b45309', '#d97706', '#f59e0b', '#fbbf24'][index % 6]} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Custom Labels Overlay with Cleaned Name */}
            <div className="mt-[-400px] ml-2 pointer-events-none absolute h-[400px] w-full flex flex-col justify-around py-2">
                 {top10RevPerVideo.map((d, i) => (
                     <div key={i} className="text-[10px] text-slate-600 font-medium truncate w-[60%] bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                         {cleanProductName(d.productName)}
                     </div>
                 ))}
            </div>
          </div>
        </div>

      </div>

      {/* 4. Automated Text Insight */}
      {insights && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl p-8 shadow-lg">
           <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-xl">
                 <Lightbulb className="w-8 h-8 text-yellow-300" />
              </div>
              <div className="flex-1">
                 <h3 className="text-xl font-bold mb-4 text-white">Executive Summary & Đề xuất Chiến lược Tháng Tới</h3>
                 
                 <div className="space-y-4 text-slate-200 leading-relaxed">
                    <p>
                        <strong className="text-white">1. Tổng quan hiệu suất:</strong> Chiến dịch ghi nhận tổng doanh thu <strong className="text-emerald-400">{formatVND(kpis.totalRev)}</strong> từ <strong className="text-white">{kpis.totalOrders.toLocaleString()}</strong> đơn hàng. 
                        Sản phẩm dẫn đầu doanh số là <strong className="text-white">"{cleanProductName(kpis.topProduct)}"</strong>.
                    </p>
                    
                    <p>
                        <strong className="text-white">2. Phân tích chuyển đổi:</strong> Tỷ lệ chuyển đổi (CVR) trung bình toàn gian hàng đạt <strong className="text-blue-300">{insights.avgCVR}%</strong>. 
                    </p>

                    <div className="bg-white/10 p-4 rounded-xl border border-white/10 mt-4">
                        <h4 className="text-white font-bold flex items-center gap-2 mb-2">
                            <ArrowRight className="w-4 h-4 text-emerald-400" />
                            Gợi ý hành động (Action Plan):
                        </h4>
                        <ul className="list-disc list-inside space-y-2 text-sm">
                            {insights.highPotentialCount > 0 ? (
                                <li>
                                    <strong>Scale Up (Mở rộng):</strong> Phát hiện <span className="text-emerald-300 font-bold">{insights.highPotentialCount} sản phẩm tiềm năng</span> có CVR cao hơn trung bình ({insights.avgCVR}%) nhưng lượt hiển thị (Impressions) còn thấp. 
                                    <br/>
                                    <em>Ví dụ: "{insights.topExample}".</em>
                                    <br/>
                                    <span className="text-slate-400">-&gt; Đề xuất: Tăng ngân sách Ads hoặc Booking thêm KOC cho nhóm này để tận dụng tỷ lệ chốt đơn tốt.</span>
                                </li>
                            ) : (
                                <li>Hiện tại các sản phẩm có CVR cao đều đã có lượng hiển thị tốt. Hãy duy trì ngân sách hiện tại.</li>
                            )}
                            
                            {insights.inefficientCount > 0 && (
                                <li>
                                    <strong>Optimize (Tối ưu):</strong> Có <span className="text-red-300 font-bold">{insights.inefficientCount} sản phẩm</span> có nhiều lượt xem nhưng CVR thấp.
                                    <br/>
                                    <span className="text-slate-400">-&gt; Đề xuất: Kiểm tra lại nội dung Video (Hook/CTA) hoặc xem lại giá bán/Landing Page xem có rào cản mua hàng nào không.</span>
                                </li>
                            )}
                        </ul>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default VideoAnalytics;
