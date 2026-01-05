import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import ScraperTool from './components/ScraperTool';
import GmvComparator from './components/GmvComparator';
import VideoAnalytics from './components/VideoAnalytics';
import { Database, LineChart, Video, LogOut, ChevronRight, Menu } from 'lucide-react';

type Module = 'scraper' | 'gmv' | 'video';

const MainLayout = () => {
    const { currentUser, logout } = useAuth();
    const [activeModule, setActiveModule] = useState<Module>('scraper');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    if (!currentUser) return <Login />;

    return (
        <div className="min-h-screen bg-[#f8fafc] flex relative overflow-hidden">
            
            {/* MAIN CONTENT AREA */}
            <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'mr-[280px]' : 'mr-0'} p-6 overflow-y-auto h-screen custom-scrollbar`}>
                <div className="max-w-[1700px] mx-auto pb-20">
                    {/* TOP HEADER MOBILE TOGGLE */}
                    <button 
                        className={`fixed top-4 right-4 z-50 p-3 bg-white shadow-lg rounded-xl border border-slate-200 text-slate-600 hover:text-indigo-600 transition-all ${isSidebarOpen ? 'hidden' : 'block'}`}
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    {/* MODULE CONTENT */}
                    <div className="animate-in fade-in zoom-in duration-300">
                        {activeModule === 'scraper' && <ScraperTool />}
                        {activeModule === 'gmv' && <GmvComparator />}
                        {activeModule === 'video' && <VideoAnalytics />}
                    </div>
                </div>
            </div>

            {/* RIGHT SIDEBAR NAVIGATION */}
            <div className={`fixed top-0 right-0 h-full bg-white border-l border-slate-200 shadow-2xl z-40 transition-transform duration-300 w-[280px] flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* Sidebar Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-sm font-black uppercase text-slate-800 tracking-widest">Công Cụ</h2>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">SirP 96 Super App</p>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Modules List */}
                <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <button 
                        onClick={() => setActiveModule('scraper')}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all group text-left relative overflow-hidden ${activeModule === 'scraper' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        <div className={`p-2 rounded-lg ${activeModule === 'scraper' ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600 group-hover:bg-white'}`}>
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="block text-sm font-bold">Scraper Tool</span>
                            <span className={`text-[10px] ${activeModule === 'scraper' ? 'text-indigo-200' : 'text-slate-400'}`}>Cào giá & Tìm điểm bán</span>
                        </div>
                        {activeModule === 'scraper' && <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20"></div>}
                    </button>

                    <button 
                        onClick={() => setActiveModule('gmv')}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all group text-left relative overflow-hidden ${activeModule === 'gmv' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        <div className={`p-2 rounded-lg ${activeModule === 'gmv' ? 'bg-white/20' : 'bg-emerald-50 text-emerald-600 group-hover:bg-white'}`}>
                            <LineChart className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="block text-sm font-bold">GMV Comparator</span>
                            <span className={`text-[10px] ${activeModule === 'gmv' ? 'text-emerald-200' : 'text-slate-400'}`}>So sánh & Phân tích DT</span>
                        </div>
                        {activeModule === 'gmv' && <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20"></div>}
                    </button>

                    <button 
                        onClick={() => setActiveModule('video')}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all group text-left relative overflow-hidden ${activeModule === 'video' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        <div className={`p-2 rounded-lg ${activeModule === 'video' ? 'bg-white/20' : 'bg-rose-50 text-rose-600 group-hover:bg-white'}`}>
                            <Video className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="block text-sm font-bold">Video Analytics</span>
                            <span className={`text-[10px] ${activeModule === 'video' ? 'text-rose-200' : 'text-slate-400'}`}>Chuyển đổi Video</span>
                        </div>
                        {activeModule === 'video' && <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20"></div>}
                    </button>
                </div>

                {/* Footer User Info */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tài khoản</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{currentUser.email}</p>
                    </div>
                    <button 
                        onClick={() => logout()}
                        className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                        <LogOut className="w-4 h-4" /> Đăng Xuất
                    </button>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    return (
        <AuthProvider>
            <MainLayout />
        </AuthProvider>
    );
};

export default App;
