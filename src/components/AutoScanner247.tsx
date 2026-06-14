import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, AlertCircle, BarChart2, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchCurrentPrice } from '../services/marketData';

const AUTO_SCAN_ASSETS = [
    { pair: "EURUSD", type: "Forex" },
    { pair: "GBPUSD", type: "Forex" },
    { pair: "USDJPY", type: "Forex" },
    { pair: "AUDUSD", type: "Forex" },
    { pair: "NAS100", type: "Índices" },
    { pair: "US30", type: "Índices" },
    { pair: "XAUUSD", type: "Metais" },
    { pair: "XAGUSD", type: "Metais" },
    { pair: "BTCUSD", type: "Criptomoedas" },
    { pair: "ETHUSD", type: "Criptomoedas" }
];

const ANALYSIS_CRITERIA = [
    "Tendência", "BOS", "CHOCH", "Liquidez", "Volume", "Momentum", "FVG", "Order Blocks", "Notícias"
];

interface AssetAnalysis {
    pair: string;
    type: string;
    price: string;
    metrics: Record<string, 'Bullish' | 'Bearish' | 'Neutral'>;
    overall: 'BUY' | 'SELL' | 'WAIT';
    confidence: number;
    lastUpdated: number;
}

export const AutoScanner247 = ({ userData }: { userData: any }) => {
    const [analyses, setAnalyses] = useState<AssetAnalysis[]>([]);
    const [isScanning, setIsScanning] = useState(false);

    const generateMockAnalysis = async (pair: string, type: string): Promise<AssetAnalysis> => {
        const metrics: Record<string, 'Bullish' | 'Bearish' | 'Neutral'> = {};
        let bullCount = 0;
        let bearCount = 0;

        ANALYSIS_CRITERIA.forEach(criteria => {
            const val = Math.random();
            let result: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
            if (val > 0.6) {
                result = 'Bullish';
                bullCount++;
            } else if (val < 0.4) {
                result = 'Bearish';
                bearCount++;
            }
            metrics[criteria] = result;
        });

        let overall: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
        let confidence = 20 + Math.floor(Math.random() * 80); // 20 to 99

        if (bullCount > bearCount + 2) {
            overall = 'BUY';
            confidence = 65 + Math.floor(Math.random() * 34); // 65 to 99
        } else if (bearCount > bullCount + 2) {
            overall = 'SELL';
            confidence = 65 + Math.floor(Math.random() * 34); // 65 to 99
        } else {
            confidence = 10 + Math.floor(Math.random() * 55); // 10 to 65
        }

        let currentPrice = "1.0000";
        try {
            const price = await fetchCurrentPrice(pair);
            if (price) {
                currentPrice = price.toFixed(5);
            }
        } catch (e) {
            currentPrice = "N/A";
        }

        return {
            pair,
            type,
            price: currentPrice,
            metrics,
            overall,
            confidence,
            lastUpdated: Date.now()
        };
    };

    const performScan = async () => {
        setIsScanning(true);
        const newAnalyses = await Promise.all(AUTO_SCAN_ASSETS.map(asset => generateMockAnalysis(asset.pair, asset.type)));
        setAnalyses(newAnalyses);
        setIsScanning(false);
    };

    useEffect(() => {
        performScan();
        // Auto scan every real-time minute or so
        const interval = setInterval(() => {
            performScan();
        }, 60000); // 1 minute
        return () => clearInterval(interval);
    }, []);

    const getTypeColor = (type: string) => {
        switch(type) {
            case 'Forex': return 'text-blue-400 border-blue-400/20 bg-blue-400/10';
            case 'Índices': return 'text-purple-400 border-purple-400/20 bg-purple-400/10';
            case 'Metais': return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10';
            case 'Criptomoedas': return 'text-orange-400 border-orange-400/20 bg-orange-400/10';
            default: return 'text-zinc-400 border-zinc-400/20 bg-zinc-400/10';
        }
    };

    const getHeatmapCategory = (analysis: AssetAnalysis) => {
        if (analysis.overall === 'BUY') {
            return analysis.confidence >= 80 ? 'COMPRA FORTE' : 'COMPRA MODERADA';
        }
        if (analysis.overall === 'SELL') {
            return analysis.confidence >= 80 ? 'VENDA FORTE' : 'VENDA MODERADA';
        }
        return 'NEUTRO';
    };

    const getHeatmapColor = (category: string) => {
        switch(category) {
            case 'COMPRA FORTE': return 'bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]';
            case 'COMPRA MODERADA': return 'bg-green-500/10 text-green-500/80 border-green-500/20';
            case 'VENDA FORTE': return 'bg-brand-red/20 text-brand-red border-brand-red/50 shadow-[0_0_15px_rgba(255,0,0,0.2)]';
            case 'VENDA MODERADA': return 'bg-brand-red/10 text-brand-red/80 border-brand-red/20';
            default: return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50';
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#0a0000] border border-brand-red/20 rounded-2xl p-6 shadow-[0_0_20px_rgba(255,0,0,0.05)]">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-brand-red/10 rounded-xl">
                            <Activity size={24} className="text-brand-red animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                                AUTO SCANNER 24/7
                                {isScanning && <RefreshCw size={14} className="animate-spin text-brand-red" />}
                            </h2>
                            <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest mt-1">
                                Análise Quantitativa em Tempo Real
                            </p>
                        </div>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest bg-brand-red/20 text-brand-red px-3 py-1.5 rounded-full border border-brand-red/30 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-red shadow-[0_0_8px_rgba(255,0,0,0.8)] animate-pulse" />
                        SYSTEM ONLINE
                    </div>
                </div>

                {/* Heatmap Section */}
                <div className="mb-10">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
                        <BarChart2 size={16} className="text-brand-red" />
                        Heatmap Inteligente
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {analyses.map(analysis => {
                            const category = getHeatmapCategory(analysis);
                            return (
                                <div key={`heat-${analysis.pair}`} className={cn("rounded-xl p-4 border flex flex-col items-center justify-center text-center transition-all", getHeatmapColor(category))}>
                                    <span className="text-lg font-black tracking-widest mb-1 text-white">{analysis.pair}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-90 mb-3">{category}</span>
                                    <div className="flex bg-black/40 rounded px-2 py-1 items-center gap-2 border border-white/5">
                                        <span className="text-[10px] font-black uppercase tracking-widest">{analysis.overall}</span>
                                        <span className="text-xs font-mono">{analysis.confidence}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mb-4">
                     <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2">
                        <Zap size={16} className="text-brand-red" />
                        Análise Detalhada
                    </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analyses.map((analysis) => (
                        <div key={analysis.pair} className="bg-black/60 border border-white/5 rounded-xl p-5 hover:border-brand-red/30 transition-colors">
                            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-black text-white tracking-widest">{analysis.pair}</span>
                                        <span className={cn("text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border", getTypeColor(analysis.type))}>
                                            {analysis.type}
                                        </span>
                                    </div>
                                    <span className="text-xs font-mono text-zinc-400">{analysis.price}</span>
                                </div>
                                <div className={cn(
                                    "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border",
                                    analysis.overall === 'BUY' ? "bg-green-500/10 border-green-500/30 text-green-500" :
                                    analysis.overall === 'SELL' ? "bg-brand-red/10 border-brand-red/30 text-brand-red" :
                                    "bg-zinc-500/10 border-zinc-500/30 text-zinc-500"
                                )}>
                                    {analysis.overall}
                                </div>
                            </div>
                            
                            <div className="space-y-2 mb-4">
                                {ANALYSIS_CRITERIA.map(criteria => (
                                    <div key={criteria} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest border-b border-white/5 last:border-0 pb-1 last:pb-0">
                                        <span className="text-zinc-500">{criteria}</span>
                                        <span className={cn(
                                            analysis.metrics[criteria] === 'Bullish' ? "text-green-500" :
                                            analysis.metrics[criteria] === 'Bearish' ? "text-brand-red" :
                                            "text-zinc-400"
                                        )}>
                                            {analysis.metrics[criteria]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                <div className="text-[10px] uppercase font-black tracking-widest text-zinc-600">
                                    Score Institucional:
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                        <div 
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000",
                                                analysis.confidence >= 70 ? "bg-green-500" :
                                                analysis.confidence >= 41 ? "bg-yellow-500" : "bg-brand-red"
                                            )}
                                            style={{ width: `${analysis.confidence}%` }}
                                        />
                                    </div>
                                    <span className={cn(
                                        "text-xs font-mono font-black",
                                        analysis.confidence >= 70 ? "text-green-500" :
                                        analysis.confidence >= 41 ? "text-yellow-500" : "text-brand-red"
                                    )}>{analysis.confidence}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
