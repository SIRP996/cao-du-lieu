import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { 
  Download, Play, Loader2, Code, 
  Package, ExternalLink, Search, Table2, LayoutGrid, Filter, SlidersHorizontal, Sparkles, Database, PieChart, TrendingUp, CheckCircle2, AlertCircle, X, Copy, Cpu, Zap, BrainCircuit, Wand2, PartyPopper, Radio, Laptop, Tag, LogOut, UploadCloud, User, Layers, FolderPlus, FolderOpen, ChevronDown, Check, Edit2, Trash2, Plus, Settings, Save, Key, MapPin, Store, Globe, Phone, Clock, PauseCircle, StopCircle, BarChart3, Map, Grid3X3
} from 'lucide-react';
import { ProductData, AppStatus, SourceConfig, TrackingProduct, Project, StoreResult } from '../types';
import { parseRawProducts, processNormalization, searchLocalStoresWithGemini } from '../services/geminiScraper';
import { exportToMultiSheetExcel, exportStoreDataToExcel } from '../utils/excelExport';
import { useAuth } from '../contexts/AuthContext';
import PriceTrackingDashboard from './PriceTrackingDashboard';
import { 
    saveScrapedDataToFirestore, 
    getTrackedProducts, 
    getUserProjects, 
    createProject, 
    updateProject, 
    deleteProject,
    syncProjectWorkspace, 
    getProjectWorkspace   
} from '../services/firebaseService';

// --- DATA: VIETNAM REGIONS ---
const VIETNAM_REGIONS = {
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

const REGION_NAMES_DISPLAY: Record<string, string> = {
    'NORTH': 'Miền Bắc',
    'CENTRAL': 'Miền Trung',
    'SOUTH': 'Miền Nam'
};

const STORAGE_KEY = 'super_scraper_v22_standard_names';
const PROJECT_STORAGE_KEY = 'super_scraper_last_active_project_id';
const API_KEY_STORAGE = 'USER_GEMINI_API_KEY';

// --- COMPONENT: LOCATION ANALYTICS DASHBOARD ---
const LocationAnalytics = ({ results }: { results: StoreResult[] }) => {
    // Group Data Logic
    const stats = useMemo(() => {
        const provCounts: Record<string, number> = {};
        const regionCounts: Record<string, number> = { NORTH: 0, CENTRAL: 0, SOUTH: 0 };
        
        results.forEach(r => {
            if (r.province) {
                provCounts[r.province] = (provCounts[r.province] || 0) + 1;
                
                // Determine region
                if (VIETNAM_REGIONS.NORTH.includes(r.province)) regionCounts.NORTH++;
                else if (VIETNAM_REGIONS.CENTRAL.includes(r.province)) regionCounts.CENTRAL++;
                else if (VIETNAM_REGIONS.SOUTH.includes(r.province)) regionCounts.SOUTH++;
            }
        });

        const sortedProvs = Object.entries(provCounts).sort((a,b) => b[1] - a[1]);
        const top5 = sortedProvs.slice(0, 5);
        const maxCount = sortedProvs.length > 0 ? sortedProvs[0][1] : 1;

        return { provCounts, regionCounts, sortedProvs, top5, maxCount };
    }, [results]);

    if (results.length === 0) return null;

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-indigo-600 rounded-xl p-6 text-white shadow-xl shadow-indigo-200">
                    <div className="flex items-center justify-between mb-4">
                        <Store className="w-8 h-8 opacity-80" />
                        <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded">Total Stores</span>
                    </div>
                    <div className="text-4xl font-black tracking-tight">{results.length}</div>
                    <div className="text-xs font-medium opacity-80 mt-1">Cửa hàng/Điểm bán đang hiển thị</div>
                </div>
                
                <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <MapPin className="w-8 h-8 text-rose-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Khu Vực</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800 truncate">
                        {stats.top5.length > 0 ? stats.top5[0][0] : "Chưa có"}
                    </div>
                    <div className="text-xs font-bold text-slate-400 mt-1">
                        {stats.top5.length > 0 ? `${stats.top5[0][1]} địa điểm` : ""}
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <PieChart className="w-8 h-8 text-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phân Bổ Vùng</span>
                    </div>
                    <div className="flex items-end gap-2 h-10">
                        {['NORTH', 'CENTRAL', 'SOUTH'].map(reg => {
                            const count = stats.regionCounts[reg as keyof typeof stats.regionCounts];
                            const total = results.length || 1;
                            const h = Math.max((count/total)*100, 10);
                            return (
                                <div key={reg} className="flex-1 flex flex-col items-center gap-1 group">
                                    <div className="w-full bg-slate-100 rounded-t-sm relative overflow-hidden h-full">
                                        <div 
                                            className={`absolute bottom-0 w-full transition-all duration-500 ${reg==='NORTH'?'bg-rose-400':reg==='CENTRAL'?'bg-amber-400':'bg-indigo-400'}`} 
                                            style={{height: `${h}%`}}
                                        ></div>
                                    </div>
                                    <span className="text-[8px] font-bold uppercase">{reg.charAt(0)}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* HEATMAP GRID */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest mb-6 flex items-center gap-2">
                        <Grid3X3 className="w-4 h-4 text-indigo-500"/> Mật độ phân bổ (Heatmap)
                    </h3>
                    <div className="space-y-6">
                        {Object.entries(VIETNAM_REGIONS).map(([regionKey, provinces]) => {
                            return (
                                <div key={regionKey}>
                                    <div className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{regionKey} REGION</div>
                                    <div className="flex flex-wrap gap-2">
                                        {provinces.map(prov => {
                                            const count = stats.provCounts[prov] || 0;
                                            const intensity = count > 0 ? Math.ceil((count / stats.maxCount) * 5) : 0; // 0-5 scale
                                            // Colors based on intensity
                                            const bgClass = intensity === 0 ? 'bg-slate-50 text-slate-300 border-slate-100' :
                                                            intensity === 1 ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                            intensity === 2 ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                                                            intensity === 3 ? 'bg-indigo-300 text-white border-indigo-300' :
                                                            intensity === 4 ? 'bg-indigo-500 text-white border-indigo-500' :
                                                                              'bg-indigo-700 text-white border-indigo-700';
                                            
                                            return (
                                                <div 
                                                    key={prov} 
                                                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all ${bgClass}`}
                                                    title={`${prov}: ${count} stores`}
                                                >
                                                    {prov} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* TOP PROVINCES CHART */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest mb-6 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-rose-500"/> Top Tỉnh Thành
                    </h3>
                    <div className="space-y-4">
                        {stats.top5.map(([prov, count], i) => (
                            <div key={prov} className="group">
                                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                    <span>{i+1}. {prov}</span>
                                    <span>{count}</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ease-out group-hover:scale-x-105 origin-left"
                                        style={{width: `${(count / stats.maxCount) * 100}%`}}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {stats.top5.length === 0 && <p className="text-slate-400 text-xs italic">Chưa có dữ liệu</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- COMPONENT: SOURCE INPUT CARD ---
const SourceInputCard = memo(({ index, source, onUpdate, onFocusInput }: { 
    index: number; 
    source: SourceConfig; 
    onUpdate: (index: number, field: keyof SourceConfig, value: any) => void;
    onFocusInput: (index: number) => void;
}) => {
    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center font-black text-indigo-600 border border-indigo-100">
                        {index + 1}
                    </div>
                    {/* Editable Source Name */}
                    <input 
                        type="text" 
                        value={source.name} 
                        onChange={(e) => onUpdate(index, 'name', e.target.value)}
                        className="font-black text-sm text-slate-700 uppercase tracking-wide bg-transparent outline-none border-b border-transparent focus:border-indigo-300 transition-all placeholder:text-slate-300 w-32"
                        placeholder="Tên nguồn..."
                    />
                </div>
                {/* Voucher Input */}
                <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                    <Tag className="w-3 h-3 text-orange-500" />
                    <input 
                        type="number" 
                        value={source.voucherPercent || ''} 
                        onChange={(e) => onUpdate(index, 'voucherPercent', parseFloat(e.target.value))}
                        className="w-12 bg-transparent text-[11px] font-bold text-orange-600 outline-none placeholder:text-orange-300 text-center"
                        placeholder="0"
                    />
                    <span className="text-[10px] font-bold text-orange-400">% Voucher</span>
                </div>
            </div>

            <div className="space-y-3">
                {/* URL Input */}
                <div className="relative group/input">
                    <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" />
                    <input 
                        type="text" 
                        value={source.urls[0] || ''} 
                        onChange={(e) => onUpdate(index, 'urls', [e.target.value])}
                        onFocus={() => onFocusInput(index)}
                        className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                        placeholder="Dán Link sản phẩm (Shopee/Lazada)..."
                    />
                </div>
                
                {/* HTML Input */}
                <div className="relative group/input">
                    <Code className="absolute left-3 top-3 w-4 h-4 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" />
                    <textarea 
                        value={source.htmlHint || ''} 
                        onChange={(e) => onUpdate(index, 'htmlHint', e.target.value)}
                        onFocus={() => onFocusInput(index)}
                        className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all h-20 resize-none placeholder:text-slate-300 leading-relaxed custom-scrollbar"
                        placeholder="<HTML> Code (Nếu extension không tự động bắt)..."
                    />
                    {source.htmlHint && source.htmlHint.length > 10 && (
                        <div className="absolute right-2 bottom-2 text-[9px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Đã có Data
                        </div>
                    )}
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

const ScraperTool: React.FC = () => {
  const { currentUser } = useAuth(); 
  const [activeTab, setActiveTab] = useState<'scraper' | 'location'>('scraper');

  // -- SCRAPER STATE --
  const [sources, setSources] = useState<SourceConfig[]>(
    Array(5).fill(null).map((_, i) => {
      const names = ["SHOPEE", "LAZADA", "TIKTOK", "TIKI", "HASAKI"];
      return { name: names[i], urls: [''], htmlHint: '' };
    })
  );
  const focusedSourceIdxRef = useRef<number | null>(null);
  const [results, setResults] = useState<ProductData[]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [normalizationStatus, setNormalizationStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  
  // -- LOCATION SCOUT STATE --
  const [searchProduct, setSearchProduct] = useState('');
  const [searchMode, setSearchMode] = useState<'single' | 'region'>('single');
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<'NORTH' | 'CENTRAL' | 'SOUTH'>('SOUTH');
  const [locationViewMode, setLocationViewMode] = useState<'list' | 'dashboard'>('list');
  const [provinceFilter, setProvinceFilter] = useState<string>('ALL');
  
  const [storeResults, setStoreResults] = useState<StoreResult[]>([]);
  const [isSearchingStore, setIsSearchingStore] = useState(false);
  const [searchProgress, setSearchProgress] = useState<{current: number, total: number, currentProvince: string} | null>(null);
  const stopSearchRef = useRef(false);

  // Common State
  const [showHelp, setShowHelp] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [savingProgress, setSavingProgress] = useState<{current: number, total: number} | null>(null);
  const [showTracking, setShowTracking] = useState(false);
  const [trackingData, setTrackingData] = useState<TrackingProduct[]>([]);
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'dashboard'>('table');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'retail' | 'combo'>('all');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');

  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setResults(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    const savedSources = localStorage.getItem(STORAGE_KEY + '_sources');
    if (savedSources) {
      try { setSources(JSON.parse(savedSources)); } catch (e) { console.error(e); }
    }
    const savedKey = localStorage.getItem(API_KEY_STORAGE);
    if (savedKey) {
        setUserApiKey(savedKey);
    } else {
        setTimeout(() => setShowApiKeyModal(true), 800);
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

  useEffect(() => {
      if (currentUser) {
          refreshProjects();
      }
  }, [currentUser]);

  useEffect(() => {
    if (currentProject) {
        localStorage.setItem(PROJECT_STORAGE_KEY, currentProject.id);
    }
  }, [currentProject]);

  const refreshProjects = async () => {
      if (!currentUser) return;
      try {
          const projs = await getUserProjects(currentUser.uid);
          setProjects(projs);
          const savedId = localStorage.getItem(PROJECT_STORAGE_KEY);
          const foundProj = projs.find(p => p.id === savedId);
          if (foundProj) {
              setCurrentProject(foundProj);
          } else if (projs.length > 0 && !currentProject) {
              setCurrentProject(projs[0]);
          }
      } catch (e) {
          console.error("Load project failed:", e);
      }
  };

  const handleSelectProject = async (proj: Project) => {
      setCurrentProject(proj);
      setShowProjectManager(false);
      if (results.length > 0 && !confirm("Bạn có chắc muốn tải dự án mới? Dữ liệu chưa lưu hiện tại sẽ bị thay thế.")) return;

      typeLog(`[PROJECT] Đang tải dữ liệu dự án: ${proj.name}...`, 'system');
      try {
          const workspace = await getProjectWorkspace(proj.id);
          if (workspace.sources && workspace.sources.length > 0) {
              setSources(workspace.sources);
              typeLog(`[PROJECT] Đã khôi phục cấu hình nguồn (HTML/URL).`, 'success');
          }
          if (workspace.results && workspace.results.length > 0) {
              setResults(workspace.results);
              typeLog(`[PROJECT] Đã khôi phục ${workspace.results.length} sản phẩm.`, 'success');
          } else {
              setResults([]);
              typeLog(`[PROJECT] Dự án chưa có dữ liệu kết quả.`, 'info');
          }
      } catch (e: any) {
          typeLog(`[PROJECT ERR] Lỗi tải dữ liệu: ${e.message}`, 'error');
      }
  };

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
         else if (lowerUrl.includes("tiktok")) targetName = "TIKTOK"; 
         else if (lowerUrl.includes("hasaki")) targetName = "HASAKI";
         else if (lowerUrl.includes("sociolla")) targetName = "SOCIOLA";
         else if (lowerUrl.includes("thegioiskinfood")) targetName = "THEGIOISKINFOOD";

         setSources(prev => {
            const next = [...prev];
            let idx = -1;
            if (focusedSourceIdxRef.current !== null && focusedSourceIdxRef.current >= 0 && focusedSourceIdxRef.current < next.length) {
                idx = focusedSourceIdxRef.current;
                typeLog(`[AUTO-FILL] Phát hiện Focus: Nhập vào ô số ${idx + 1}`, 'matrix');
            } 
            else {
                idx = next.findIndex(s => s.name.toUpperCase() === targetName);
                if (idx === -1) idx = next.findIndex(s => !s.htmlHint && (!s.urls[0] || s.urls[0] === ''));
                if (idx === -1) idx = 0;
                typeLog(`[AUTO-FILL] Auto Detect: Nhập vào ô số ${idx + 1} (${next[idx].name})`, 'matrix');
            }
            const currentUrls = next[idx].urls || [];
            const newUrls = currentUrls.includes(url) ? currentUrls : [...currentUrls.filter(u => u.trim() !== ''), url];
            const currentHtml = next[idx].htmlHint || "";
            const newHtml = currentHtml ? currentHtml + "\n\n<!-- ================= NEXT PRODUCT DATA ================= -->\n\n" + html : html;
            const shouldRename = (targetName && next[idx].name !== targetName && (!next[idx].htmlHint || next[idx].htmlHint.length < 10));
            next[idx] = { ...next[idx], name: shouldRename ? targetName : next[idx].name, htmlHint: newHtml, urls: newUrls };
            return next;
         });
      }
    };
    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, []);

  const handleSaveApiKey = () => {
    const cleaned = userApiKey.trim();
    if (cleaned.length === 0) {
        if(confirm("Bạn muốn xóa toàn bộ Key và dùng mặc định?")) {
            localStorage.removeItem(API_KEY_STORAGE);
            setUserApiKey('');
            setShowApiKeyModal(false);
            alert("Đã xóa Key người dùng. Sẽ dùng Key hệ thống (nếu có).");
        }
        return;
    }
    const keys = cleaned.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 10);
    if (keys.length === 0) {
        alert("Không tìm thấy Key hợp lệ nào (Key phải dài hơn 10 ký tự).");
        return;
    }
    const savedString = keys.join(',');
    localStorage.setItem(API_KEY_STORAGE, savedString);
    setShowApiKeyModal(false);
    alert(`Đã lưu ${keys.length} API Key! Hệ thống sẽ tự động xoay vòng key.`);
  };

  const detectedKeysCount = useMemo(() => {
      if (!userApiKey) return 0;
      return userApiKey.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 10).length;
  }, [userApiKey]);

  const handleCreateProject = async () => {
      const name = prompt("Nhập tên dự án mới:");
      if (!name || !currentUser) return;
      try {
          const newProj = await createProject(currentUser.uid, name);
          setProjects(prev => [newProj, ...prev]);
          setCurrentProject(newProj);
          setSources(Array(5).fill(null).map((_, i) => {
              const names = ["SHOPEE", "LAZADA", "TIKTOK", "TIKI", "HASAKI"];
              return { name: names[i], urls: [''], htmlHint: '' };
          }));
          setResults([]);
          setShowProjectManager(false);
          typeLog(`[PROJECT] Đã tạo dự án: ${name}`, 'success');
      } catch (e: any) {
          console.error(e);
          alert("Lỗi tạo dự án: " + e.message);
      }
  };

  const handleEditProject = async (proj: Project) => {
      const newName = prompt("Đổi tên dự án:", proj.name);
      if (newName && newName !== proj.name) {
          try {
              await updateProject(proj.id, newName);
              setProjects(prev => prev.map(p => p.id === proj.id ? {...p, name: newName} : p));
              if (currentProject?.id === proj.id) setCurrentProject({...currentProject, name: newName});
          } catch (e: any) {
              alert("Lỗi cập nhật: " + e.message);
          }
      }
  };

  const handleDeleteProject = async (proj: Project) => {
      if (confirm(`Bạn chắc chắn muốn xóa dự án "${proj.name}"?`)) {
          try {
              await deleteProject(proj.id);
              const remaining = projects.filter(p => p.id !== proj.id);
              setProjects(remaining);
              if (currentProject?.id === proj.id) {
                  const next = remaining.length > 0 ? remaining[0] : null;
                  setCurrentProject(next);
                  if(!next) localStorage.removeItem(PROJECT_STORAGE_KEY);
              }
          } catch (e: any) {
               alert("Lỗi xóa: " + e.message);
          }
      }
  };

  const handleSyncToCloud = async () => {
    if (!currentUser) return;
    if (!currentProject) {
        alert("Vui lòng chọn hoặc tạo DỰ ÁN trước khi lưu!");
        return;
    }
    const totalToSave = results.length > 0 ? results.length : 1;
    setSavingProgress({ current: 0, total: totalToSave });
    
    try {
        if (results.length > 0) {
            typeLog(`[CLOUD] Đang lưu ${results.length} sản phẩm vào Theo dõi giá...`, 'system');
            await saveScrapedDataToFirestore(
                currentUser.uid, 
                currentProject.id, 
                results, 
                sources,
                (current, total) => {
                     setSavingProgress({ current, total });
                }
            );
        } else {
            typeLog(`[CLOUD] Chỉ lưu cấu hình nguồn (chưa có sản phẩm)...`, 'info');
        }
        typeLog(`[CLOUD] Đang đồng bộ trạng thái làm việc (HTML & Config)...`, 'system');
        await syncProjectWorkspace(currentProject.id, sources, results);
        typeLog(`[CLOUD] Đã lưu hoàn tất toàn bộ dữ liệu!`, 'success');
        refreshProjects(); 
    } catch (error: any) {
        typeLog(`[CLOUD ERR] Lỗi lưu trữ: ${error.message}`, 'error');
    } finally {
        setSavingProgress(null);
    }
  };

  const loadTrackingData = async () => {
      if (!currentUser) return;
      setIsLoadingTracking(true);
      try {
          const data = await getTrackedProducts(currentUser.uid, currentProject?.id);
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
      if (validUrls.length > 0) return validUrls.map(url => ({ src, srcIdx, url, html: src.htmlHint }));
      if (src.htmlHint.trim().length > 50) return [{ src, srcIdx, url: "html-input-manual", html: src.htmlHint }];
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
      typeLog(`[START] ${task.src.name} -> Bóc tách thô (Link: ${task.url.substring(0, 30)}...)...`, 'info');
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
      } catch (err: any) {
        const msg = String(err.message || err);
        if (msg.includes("MISSING_API_KEY") || msg.includes("API key not valid") || msg.includes("400")) {
             typeLog(`[CRITICAL] Lỗi Key: ${msg}`, 'error');
             setShowApiKeyModal(true); 
             setStatus(AppStatus.ERROR);
             return; 
        }
        typeLog(`[ERR] Lỗi xử lý ${task.src.name}: ${msg}`, 'error');
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
    } catch (e: any) {
      const msg = String(e.message || e);
       if (msg.includes("MISSING_API_KEY") || msg.includes("API key not valid")) {
             typeLog(`[CRITICAL] Lỗi Key khi tối ưu: ${msg}`, 'error');
             setShowApiKeyModal(true); 
      } else {
        typeLog(`[ERR] Lỗi tối ưu hóa: ${msg}`, 'error');
      }
    }
    setNormalizationStatus(AppStatus.COMPLETED);
  };
  
  const handleStoreSearch = async () => {
    if (!searchProduct.trim()) {
        alert("Vui lòng nhập tên sản phẩm!");
        return;
    }
    
    if (searchMode === 'single' && !searchLocation.trim()) {
        alert("Vui lòng nhập khu vực tìm kiếm!");
        return;
    }

    setIsSearchingStore(true);
    stopSearchRef.current = false;
    
    if (searchMode === 'single') {
        setStoreResults([]);
        try {
            const results = await searchLocalStoresWithGemini(searchProduct, searchLocation);
            const taggedResults = results.map(r => ({
                ...r,
                province: searchLocation 
            }));
            setStoreResults(taggedResults);
        } catch (e: any) {
            alert("Lỗi tìm kiếm: " + e.message);
            if (e.message.includes("MISSING_API_KEY")) setShowApiKeyModal(true);
        } finally {
            setIsSearchingStore(false);
        }
    } 
    else {
        setStoreResults([]); 
        const provinces = VIETNAM_REGIONS[selectedRegion];
        const total = provinces.length;
        
        try {
            for (let i = 0; i < total; i++) {
                if (stopSearchRef.current) break; 

                const province = provinces[i];
                setSearchProgress({ current: i + 1, total, currentProvince: province });
                
                const localResults = await searchLocalStoresWithGemini(searchProduct, province);
                
                const taggedResults = localResults.map(r => ({
                    ...r,
                    address: r.address.includes(province) ? r.address : `${r.address} (${province})`,
                    province: province 
                }));

                setStoreResults(prev => [...prev, ...taggedResults]);
                
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        } catch (e: any) {
            alert("Có lỗi xảy ra trong quá trình quét: " + e.message);
            if (e.message.includes("MISSING_API_KEY")) setShowApiKeyModal(true);
        } finally {
            setIsSearchingStore(false);
            setSearchProgress(null);
        }
    }
  };

  const stopStoreSearch = () => {
      stopSearchRef.current = true;
      setIsSearchingStore(false); 
      setSearchProgress(null);
  };

  const uniqueProvinces = useMemo(() => {
      const provs = new Set(storeResults.map(s => s.province).filter(Boolean));
      return Array.from(provs).sort();
  }, [storeResults]);

  const filteredStoreResults = useMemo(() => {
      if (provinceFilter === 'ALL') return storeResults;
      return storeResults.filter(s => s.province === provinceFilter);
  }, [storeResults, provinceFilter]);

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
      if (sourceConfig && (sourceConfig.name.toUpperCase().includes('SHOPEE') || sourceConfig.name.toUpperCase().includes('TIKTOK')) && sourceConfig.voucherPercent && sourceConfig.voucherPercent > 0) {
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
        if (sourceConfig && (sourceConfig.name.toUpperCase().includes('SHOPEE') || sourceConfig.name.toUpperCase().includes('TIKTOK')) && sourceConfig.voucherPercent && sourceConfig.voucherPercent > 0) {
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
        const srcProducts = results.filter(r => r.sourceIndex === idx + 1);
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* (MODALS & TOASTS - Copied from Original App) */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-slate-900/90 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-[#1e293b] rounded-xl p-8 max-w-lg w-full shadow-2xl border border-slate-700 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-rose-500"></div>
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600/20 p-3 rounded-xl">
                        <Key className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Cài đặt API Key</h3>
                        <p className="text-xs text-slate-400 font-bold">Quản lý kết nối Gemini AI</p>
                    </div>
                </div>
                <button onClick={() => setShowApiKeyModal(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
              </div>

              <div className="space-y-4 mb-8">
                  <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl flex items-start gap-3">
                      <Zap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                          <p className="text-xs font-bold text-indigo-200">Rotation System (Hệ thống xoay vòng)</p>
                          <p className="text-[10px] text-indigo-400 mt-1">
                              Bạn có thể nhập <strong>nhiều API Key</strong> ngăn cách bởi dấu phẩy (,) hoặc xuống dòng. 
                              Hệ thống sẽ tự động đổi key khi hết hạn mức (429) hoặc lỗi (400).
                          </p>
                      </div>
                  </div>

                  <div>
                      <div className="flex justify-between items-center mb-2">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Danh sách Google Gemini Key</label>
                         {detectedKeysCount > 0 && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">Đã phát hiện {detectedKeysCount} key</span>}
                      </div>
                      
                      <textarea 
                          value={userApiKey}
                          onChange={(e) => setUserApiKey(e.target.value)}
                          placeholder="AIzaSy..., AIzaSy..., AIzaSy..."
                          className="w-full h-32 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono resize-none leading-relaxed"
                      />
                      <p className="text-[10px] text-slate-500 mt-2 flex justify-between">
                          <span>Chưa có Key? <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-400 hover:underline">Lấy miễn phí tại đây</a></span>
                          <span className="text-slate-600">Mỗi key cách nhau dấu phẩy</span>
                      </p>
                  </div>
              </div>

              <div className="flex gap-3">
                  <button onClick={() => setShowApiKeyModal(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-xs uppercase hover:bg-slate-700 transition-colors">Đóng</button>
                  <button onClick={handleSaveApiKey} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                      <Save className="w-4 h-4" /> Lưu Cấu Hình
                  </button>
              </div>
           </div>
        </div>
      )}

      {savingProgress && (
          <div className="fixed bottom-6 right-6 z-[1000] bg-white rounded-xl shadow-2xl border border-indigo-100 p-5 w-80 animate-in slide-in-from-right duration-300">
              <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                      <div className="relative">
                          <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
                          <div className="relative bg-indigo-50 text-indigo-600 p-2 rounded-full">
                              <UploadCloud className="w-5 h-5" />
                          </div>
                      </div>
                      <div>
                          <h4 className="text-sm font-black text-slate-800">Đang đồng bộ...</h4>
                          <p className="text-[10px] text-slate-500 font-bold">Dự án: {currentProject?.name}</p>
                      </div>
                  </div>
                  <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
              </div>
              
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                    style={{width: `${(savingProgress.current / savingProgress.total) * 100}%`}}
                  ></div>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>Tiến độ</span>
                  <span>{savingProgress.current} / {savingProgress.total}</span>
              </div>
          </div>
      )}

      {showProjectManager && (
          <div className="fixed inset-0 bg-black/60 z-[1002] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in duration-300">
              <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl overflow-hidden relative">
                  <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                          <div className="bg-indigo-100 p-3 rounded-xl">
                              <FolderOpen className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div>
                              <h3 className="text-xl font-black uppercase text-slate-800">Quản Lý Dự Án</h3>
                              <p className="text-xs text-slate-500 font-bold">Danh sách các dự án đã tạo</p>
                          </div>
                      </div>
                      <button onClick={() => setShowProjectManager(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 space-y-3 mb-6">
                      {projects.map(p => (
                          <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl border ${currentProject?.id === p.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 bg-slate-50'}`}>
                              <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => handleSelectProject(p)}>
                                  <div className={`w-3 h-3 rounded-full ${currentProject?.id === p.id ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                  <div>
                                      <h4 className={`text-sm font-black hover:underline ${currentProject?.id === p.id ? 'text-indigo-700' : 'text-slate-700'}`}>{p.name}</h4>
                                      <p className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleDateString('vi-VN')} • {p.productCount || 0} sản phẩm</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); handleEditProject(p); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                              </div>
                          </div>
                      ))}
                      {projects.length === 0 && <div className="text-center text-slate-400 py-10 text-sm">Chưa có dự án nào</div>}
                  </div>

                  <button 
                      onClick={handleCreateProject}
                      className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                      <Plus className="w-4 h-4" /> Tạo Dự Án Mới
                  </button>
              </div>
          </div>
      )}

      {normalizationStatus === AppStatus.PROCESSING && (
        <div className="fixed inset-0 bg-white/90 z-[1000] flex flex-col items-center justify-center p-8 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-md text-center space-y-8">
              <div className="relative mx-auto w-32 h-32">
                 <div className="absolute inset-0 border-8 border-indigo-100 rounded-full"></div>
                 <div className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <BrainCircuit className="w-12 h-12 text-indigo-600 animate-pulse" />
                 </div>
              </div>
              <div>
                 <h3 className="text-2xl font-black uppercase text-indigo-900 tracking-tight">Đang tối ưu hóa...</h3>
                 <p className="text-slate-500 font-bold mt-2">AI đang phân tích và chuẩn hóa dữ liệu</p>
              </div>
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto overflow-hidden">
                   <div className="h-full bg-indigo-600 animate-progress"></div>
              </div>
           </div>
        </div>
      )}

      {showSuccessModal && (
         <div className="fixed inset-0 bg-black/60 z-[1001] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in duration-300">
            <div className="bg-white rounded-xl p-10 max-w-lg w-full shadow-2xl text-center relative overflow-hidden">
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
                 className="px-10 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-widest shadow-lg"
               >
                 Xem Kết Quả
               </button>
            </div>
         </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in duration-200">
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

        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-6">
            <div className="bg-indigo-600 p-5 rounded-xl shadow-xl shadow-indigo-100">
              <Cpu className="w-8 h-8 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900"> SirP <span className="text-indigo-600">96</span></h1>
              <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg">
                      <FolderOpen className="w-3 h-3" />
                      {currentProject ? currentProject.name : "Chưa chọn dự án"}
                  </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
             {currentUser && (
               <div 
                 onClick={() => { refreshProjects(); setShowProjectManager(true); }}
                 className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl mr-4 border border-slate-100 cursor-pointer hover:bg-indigo-50 hover:border-indigo-100 transition-all group"
               >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                      <User className="w-4 h-4 text-indigo-600 group-hover:text-white" />
                  </div>
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Xin chào</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800 max-w-[100px] truncate">{currentUser.email}</span>
                        <Settings className="w-3 h-3 text-slate-300 group-hover:text-indigo-500" />
                      </div>
                  </div>
               </div>
             )}

             <button 
                onClick={() => setShowApiKeyModal(true)}
                className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-yellow-400 hover:bg-slate-800 rounded-xl transition-all border-2 border-slate-800 hover:border-yellow-400 shadow-xl" 
                title="Cài đặt API Key"
             >
                <Key className="w-5 h-5" />
                <span className="text-[11px] font-black uppercase tracking-widest">KEY</span>
             </button>

             <button onClick={() => { if(confirm("Xóa toàn bộ dữ liệu tạm?")) setResults([]); }} className="px-6 py-3 text-[11px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-all">Clear</button>
             
             <button onClick={() => exportToMultiSheetExcel(results, groupedResults, sources)} disabled={groupedResults.length === 0} className="flex items-center gap-3 px-10 py-5 bg-white text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-50 disabled:opacity-50 font-black text-[13px] shadow-sm transition-all uppercase tracking-widest">
              <Download className="w-5 h-5" /> Xuất Excel
            </button>
          </div>
        </header>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 bg-white/50 p-2 rounded-2xl border border-slate-200 shadow-sm w-fit">
            <button 
                onClick={() => setActiveTab('scraper')}
                className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    activeTab === 'scraper' 
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                    : 'text-slate-500 hover:bg-white hover:text-slate-700'
                }`}
            >
                <Database className="w-4 h-4" /> Phân Tích Giá Sàn
            </button>
            <button 
                onClick={() => setActiveTab('location')}
                className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    activeTab === 'location' 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : 'text-slate-500 hover:bg-white hover:text-indigo-600'
                }`}
            >
                <MapPin className="w-4 h-4" /> Tìm Điểm Bán (Google)
            </button>
        </div>

        {activeTab === 'scraper' && (
            <>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                          onFocusInput={(i) => focusedSourceIdxRef.current = i}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <div className="bg-[#1e293b] rounded-xl shadow-2xl flex flex-col h-full min-h-[600px] border border-white/5 overflow-hidden sticky top-8">
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
                              <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5 inline-block">
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
                           className="w-full py-6 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-indigo-500 transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                         >
                           {status === AppStatus.PROCESSING ? <><Loader2 className="w-6 h-6 animate-spin" /> RUNNING {progress}%</> : <><Play className="w-6 h-6 fill-current" /> QUÉT DỮ LIỆU THÔ</>}
                         </button>
                      </div>

                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                  <div className="px-12 py-8 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-8 bg-slate-50/30">
                    <div className="flex items-center gap-8">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">KẾT QUẢ</h2>
                        <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-[0.2em]">
                            {groupedResults.length} sản phẩm 
                            {showDuplicatesOnly ? ' trùng khớp' : ' được tìm thấy'}
                        </p>
                      </div>
                      <div className="flex bg-slate-100 p-1.5 rounded-xl">
                        <button 
                          onClick={() => setViewMode('table')}
                          className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'table' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          <Table2 className="w-4 h-4" /> Chi tiết
                        </button>
                        <button 
                          onClick={() => setViewMode('dashboard')}
                          className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'dashboard' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          <LayoutGrid className="w-4 h-4" /> Phân Tích
                        </button>
                        <button 
                          onClick={() => {
                              loadTrackingData(); 
                              setShowTracking(true);
                          }}
                          className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showTracking ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
                        >
                          <TrendingUp className="w-4 h-4" /> Theo Dõi Giá
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                       <button 
                          onClick={handleSyncToCloud}
                          disabled={!currentProject || savingProgress !== null}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
                       >
                           <UploadCloud className="w-4 h-4"/>
                           {savingProgress ? 'Đang lưu...' : (results.length > 0 ? 'Lưu Kết Quả' : 'Lưu Cấu Hình')}
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
                            <div className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-black uppercase tracking-widest cursor-pointer hover:border-indigo-300 transition-all">
                                <SlidersHorizontal className="w-4 h-4" />
                                <span>
                                    {typeFilter === 'all' ? 'Tất cả loại' : typeFilter === 'retail' ? 'Sản phẩm Lẻ' : 'Combo / Bộ'}
                                </span>
                            </div>
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 p-2 hidden group-hover:block z-50">
                                <div onClick={() => setTypeFilter('all')} className={`p-3 rounded-xl text-[11px] font-bold uppercase cursor-pointer hover:bg-slate-50 ${typeFilter === 'all' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}>Tất cả</div>
                                <div onClick={() => setTypeFilter('retail')} className={`p-3 rounded-xl text-[11px] font-bold uppercase cursor-pointer hover:bg-slate-50 ${typeFilter === 'retail' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}>Chỉ Sản phẩm Lẻ</div>
                                <div onClick={() => setTypeFilter('combo')} className={`p-3 rounded-xl text-[11px] font-bold uppercase cursor-pointer hover:bg-slate-50 ${typeFilter === 'combo' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}>Chỉ Combo</div>
                            </div>
                        </div>

                        <button 
                          onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${
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
                            className="w-full pl-14 pr-6 py-3 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner font-bold"
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
                                    {/* Hiển thị badge voucher cho cả Shopee và TikTok */}
                                    {(src.name.toUpperCase().includes('SHOPEE') || src.name.toUpperCase().includes('TIKTOK')) && src.voucherPercent && src.voucherPercent > 0 && (
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
                          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Tổng sản phẩm quét</p>
                              <h3 className="text-4xl font-black text-slate-800">{stats.totalRaw}</h3>
                          </div>
                          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Sản phẩm duy nhất</p>
                              <h3 className="text-4xl font-black text-slate-800">{stats.totalGroups}</h3>
                          </div>
                          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Chênh lệch trung bình</p>
                              <h3 className="text-4xl font-black text-slate-800">{stats.avgGap}%</h3>
                          </div>
                          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Ngành hàng hot</p>
                              <h3 className="text-lg font-black text-slate-800 truncate" title={stats.topCat}>{stats.topCat}</h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Category Chart */}
                          <div className="bg-slate-50 p-8 rounded-xl border border-slate-100">
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
                          <div className="bg-slate-50 p-8 rounded-xl border border-slate-100">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-3">
                              <TrendingUp className="w-5 h-5 text-rose-500" /> Top chênh lệch giá
                            </h3>
                            <div className="space-y-4">
                              {stats.topGaps.map((item, i) => (
                                <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
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
                              <div key={idx} className={`p-6 rounded-xl border transition-all ${src.active ? 'bg-white border-indigo-100 shadow-lg shadow-indigo-50' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
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
            </>
        )}

        {activeTab === 'location' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                 
                 <div className="bg-white p-8 rounded-xl border border-indigo-100 shadow-xl shadow-indigo-100/50">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tight mb-2">
                                <span className="text-indigo-600">Google</span> Location Scout
                            </h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Tìm điểm bán thực tế & Check giá thị trường theo khu vực
                            </p>
                        </div>
                        
                        <div className="flex justify-center mb-6">
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button 
                                    onClick={() => setSearchMode('single')}
                                    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${searchMode === 'single' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Tìm 1 địa điểm
                                </button>
                                <button 
                                    onClick={() => setSearchMode('region')}
                                    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${searchMode === 'region' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Quét toàn vùng (Mass Scan)
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-[1.5] space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tên sản phẩm / Thương hiệu</label>
                                <div className="relative">
                                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                                    <input 
                                        type="text" 
                                        value={searchProduct}
                                        onChange={(e) => setSearchProduct(e.target.value)}
                                        placeholder="Ví dụ: Mặt nạ bí đao Cocoon, La Roche-Posay B5..."
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                    {searchMode === 'single' ? 'Khu vực cụ thể' : 'Chọn Vùng Miền'}
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-400" />
                                    {searchMode === 'single' ? (
                                        <input 
                                            type="text" 
                                            value={searchLocation}
                                            onChange={(e) => setSearchLocation(e.target.value)}
                                            placeholder="Ví dụ: Quận 7 TP.HCM..."
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all"
                                        />
                                    ) : (
                                        <select 
                                            value={selectedRegion}
                                            onChange={(e) => setSelectedRegion(e.target.value as any)}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="NORTH">Miền Bắc (15 Tỉnh/Thành)</option>
                                            <option value="CENTRAL">Miền Trung (19 Tỉnh/Thành)</option>
                                            <option value="SOUTH">Miền Nam (19 Tỉnh/Thành)</option>
                                        </select>
                                    )}
                                    {searchMode === 'region' && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-end">
                                {isSearchingStore ? (
                                    <button 
                                        onClick={stopStoreSearch}
                                        className="w-full md:w-auto px-8 py-4 bg-rose-100 text-rose-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-rose-200 transition-all flex items-center justify-center gap-2 h-[54px]"
                                    >
                                        <StopCircle className="w-5 h-5" /> Dừng Quét
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleStoreSearch}
                                        className="w-full md:w-auto px-8 py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2 h-[54px]"
                                    >
                                        <Search className="w-5 h-5" /> Tìm Ngay
                                    </button>
                                )}
                            </div>
                        </div>

                        {searchProgress && (
                            <div className="mt-4 bg-slate-50 border border-slate-100 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                                <div className="flex justify-between items-center mb-2 text-xs font-bold text-slate-500">
                                    <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin text-indigo-500"/> Đang quét: <span className="text-indigo-600 uppercase">{searchProgress.currentProvince}</span></span>
                                    <span>{searchProgress.current} / {searchProgress.total} Tỉnh thành</span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-indigo-600 h-full transition-all duration-500 ease-out" 
                                        style={{width: `${(searchProgress.current / searchProgress.total) * 100}%`}}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>
                 </div>

                 {storeResults.length > 0 && (
                     <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-4">
                         
                         <div className="flex bg-white border border-slate-200 p-1.5 rounded-xl shadow-sm">
                             <button 
                                 onClick={() => setLocationViewMode('list')}
                                 className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${locationViewMode === 'list' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                             >
                                 <LayoutGrid className="w-4 h-4"/> Danh sách
                             </button>
                             <button 
                                 onClick={() => setLocationViewMode('dashboard')}
                                 className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${locationViewMode === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                             >
                                 <BarChart3 className="w-4 h-4"/> Dashboard
                             </button>
                         </div>

                         <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-xl shadow-sm px-4">
                             <Filter className="w-4 h-4 text-slate-400" />
                             <select 
                                value={provinceFilter}
                                onChange={(e) => setProvinceFilter(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none cursor-pointer pr-8 py-2 uppercase"
                             >
                                 <option value="ALL">Tất cả tỉnh thành ({storeResults.length})</option>
                                 {uniqueProvinces.map(prov => (
                                     <option key={prov} value={prov}>{prov}</option>
                                 ))}
                             </select>
                         </div>

                         <button 
                            onClick={() => {
                                const finalLocation = provinceFilter !== 'ALL' 
                                    ? provinceFilter 
                                    : (searchMode === 'single' 
                                        ? searchLocation 
                                        : REGION_NAMES_DISPLAY[selectedRegion] || selectedRegion);
                                
                                exportStoreDataToExcel(filteredStoreResults, searchProduct, finalLocation);
                            }}
                            className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 border border-emerald-500 rounded-xl text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700 hover:border-emerald-600 transition-all shadow-md shadow-emerald-200 active:scale-95"
                         >
                             <Download className="w-4 h-4" /> Xuất Excel (Báo Cáo)
                         </button>
                     </div>
                 )}

                 {locationViewMode === 'dashboard' && filteredStoreResults.length > 0 && (
                     <LocationAnalytics results={filteredStoreResults} />
                 )}

                 {locationViewMode === 'list' && filteredStoreResults.length > 0 && (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-8 duration-500">
                         {filteredStoreResults.map((store, idx) => (
                             <div key={store.id + idx} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-xl hover:border-indigo-200 transition-all group animate-in zoom-in duration-300 relative overflow-hidden">
                                 
                                 {store.province && (
                                     <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-bl-xl shadow-lg z-10">
                                         {store.province}
                                     </div>
                                 )}

                                 <div className="flex justify-between items-start mb-4 pr-16">
                                     <div className="bg-indigo-50 p-3 rounded-xl group-hover:bg-indigo-600 transition-colors">
                                         <Store className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                                     </div>
                                     <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border border-emerald-100">
                                         {store.priceEstimate || 'Liên hệ'}
                                     </span>
                                 </div>
                                 
                                 <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight pr-4">{store.storeName}</h3>
                                 
                                 <div className="space-y-3 mb-6">
                                     <div className="flex items-start gap-3">
                                         <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                         <p className="text-xs font-medium text-slate-600 leading-relaxed">{store.address || 'Online / Không có địa chỉ cụ thể'}</p>
                                     </div>
                                     {store.phone && (
                                         <div className="flex items-center gap-3">
                                             <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                                             <p className="text-xs font-bold text-slate-600">{store.phone}</p>
                                         </div>
                                     )}
                                     {store.isOpen && (
                                         <div className="flex items-center gap-3">
                                             <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                             <p className="text-xs font-medium text-slate-500">{store.isOpen}</p>
                                         </div>
                                     )}
                                 </div>

                                 {store.link && (
                                     <a 
                                        href={store.link} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center justify-center gap-2 w-full py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all uppercase tracking-wide"
                                     >
                                         <Globe className="w-4 h-4" /> Truy cập Website
                                     </a>
                                 )}
                             </div>
                         ))}
                     </div>
                 )}
                 
                 {storeResults.length === 0 && !isSearchingStore && (
                     <div className="text-center py-20 opacity-50">
                         <MapPin className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                         <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Chưa có kết quả tìm kiếm</p>
                     </div>
                 )}
            </div>
        )}
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

export default ScraperTool;