
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import ScraperTool from './components/ScraperTool';
import GmvComparator from './components/GmvComparator';
import VideoAnalytics from './components/VideoAnalytics';
import PdfExtractor from './components/PdfExtractor';
import PriceComparator from './components/PriceComparator';
import { Database, LineChart, Video, LogOut, FileText, TrendingDown, Cpu } from 'lucide-react';

type Module = 'scraper' | 'gmv' | 'video' | 'pdf' | 'price';

const MainLayout = () => {
    const { currentUser, logout } = useAuth();
    const [activeModule, setActiveModule] = useState<Module>('scraper');

    if (!currentUser) return <Login />;

    const navItems = [
        { id: 'scraper', label: 'Scraper Tool', icon: Database, color: 'indigo' },
        { id: 'gmv', label: 'GMV Comparator', icon: LineChart, color: 'emerald' },
        { id: 'price', label: 'Price History', icon: TrendingDown, color: 'amber' },
        { id: 'video', label: 'Video Analytics', icon: Video, color: 'rose' },
        { id: 'pdf', label: 'PDF Extractor AI', icon: FileText, color: 'blue' },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900">
            
            {/* TOP NAVIGATION BAR (TASKBAR) */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-[100] px-4 md:px-6 flex items-center justify-between shadow-sm">
                
                {/* 1. LOGO / BRAND */}
                <div className="flex items-center gap-3 min-w-fit">
                    <div className="bg-slate-900 p-1.5 rounded-lg">
                        <Cpu className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-tighter leading-none text-slate-900">
                            SirP <span className="text-indigo-600">96</span>
                        </h1>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                            Super App
                        </p>
                    </div>
                </div>

                {/* 2. NAVIGATION ITEMS (CENTER) */}
                <nav className="flex-1 flex items-center justify-center gap-1 md:gap-2 px-4 overflow-x-auto no-scrollbar">
                    {navItems.map((item) => {
                        const isActive = activeModule === item.id;
                        const Icon = item.icon;
                        
                        // Dynamic color classes based on active state and specific color
                        let activeClass = '';
                        switch(item.color) {
                            case 'indigo': activeClass = isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'; break;
                            case 'emerald': activeClass = isActive ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'; break;
                            case 'amber': activeClass = isActive ? 'bg-amber-500 text-white shadow-md shadow-amber-200' : 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'; break;
                            case 'rose': activeClass = isActive ? 'bg-rose-600 text-white shadow-md shadow-rose-200' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'; break;
                            case 'blue': activeClass = isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'; break;
                            default: activeClass = isActive ? 'bg-slate-900 text-white' : 'text-slate-500';
                        }

                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveModule(item.id as Module)}
                                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl transition-all duration-200 whitespace-nowrap group ${activeClass}`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
                                <span className="text-xs md:text-sm font-bold hidden md:inline-block">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* 3. USER & LOGOUT (RIGHT) */}
                <div className="flex items-center gap-3 min-w-fit pl-4 border-l border-slate-100">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-xs font-bold text-slate-700">{currentUser.email?.split('@')[0]}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Pro Plan</span>
                    </div>
                    <button 
                        onClick={() => logout()}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Đăng xuất"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 pt-20 px-4 md:px-6 pb-10 w-full max-w-[1920px] mx-auto animate-in fade-in duration-300">
                {activeModule === 'scraper' && <ScraperTool />}
                {activeModule === 'gmv' && <GmvComparator />}
                {activeModule === 'video' && <VideoAnalytics />}
                {activeModule === 'pdf' && <PdfExtractor />}
                {activeModule === 'price' && <PriceComparator />}
            </main>

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
