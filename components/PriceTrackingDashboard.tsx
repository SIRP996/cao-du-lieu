
import React, { useState, useEffect, useMemo } from 'react';
import { TrackingProduct, TrackingSourceData } from '../types';
import { 
  TrendingUp, TrendingDown, Clock, ExternalLink, 
  Search, BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw, Zap
} from 'lucide-react';

interface Props {
  data: TrackingProduct[];
  onBack: () => void;
}

// --- SUB COMPONENT: MINI CHART (SVG) ---
const SparkLine = ({ data, color }: { data: number[], color: string }) => {
    if (data.length < 2) return <div className="h-10 w-24 bg-slate-50 rounded"></div>;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox="0 0 100 100" className="w-24 h-10 overflow-visible" preserveAspectRatio="none">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="3"
                points={points}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

const PriceTrackingDashboard: React.FC<Props> = ({ data, onBack }) => {
  const [selectedProduct, setSelectedProduct] = useState<TrackingProduct | null>(data[0] || null);
  const [currentTime, setCurrentTime