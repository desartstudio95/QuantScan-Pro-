import React, { useState, useEffect, useRef } from 'react';
import { AITradingEngine, RiskManager, AISignal } from '../services/aiTradingEngine';
import { Activity, Target, TrendingUp, AlertCircle, Clock, Zap, X } from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ErrorLogDetail {
    timestamp: number;
    endpoint?: string;
    payload?: any;
    httpCode?: number;
    message: string;
    stackTrace?: string;
}

export const AITradingDashboard = ({ userData, engineRunning }: { userData: any, engineRunning: boolean }) => {
    const [lastSignal, setLastSignal] = useState<AISignal | null>(null);
    const [lastLog, setLastLog] = useState<{message: string, isError: boolean, timestamp: number} | null>(null);
    const [errorLogs, setErrorLogs] = useState<ErrorLogDetail[]>([]);
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [isDebug, setIsDebug] = useState(false);

    const logDetailedError = (customMessage: string, error?: any, endpoint?: string, payload?: any) => {
        let parsedPayload = payload;
        if (!parsedPayload && error?.config?.data) {
            try { parsedPayload = JSON.parse(error.config.data); } catch (e) { parsedPayload = error.config.data; }
        }

        const log: ErrorLogDetail = {
            timestamp: Date.now(),
            endpoint: endpoint || error?.config?.url,
            payload: parsedPayload,
            httpCode: error?.response?.status,
            message: error?.response?.data?.details?.message || error?.response?.data?.error || error?.response?.data?.message || error?.message || customMessage,
            stackTrace: error?.stack
        };

        setErrorLogs(prev => [log, ...prev].slice(0, 100));
        setLastLog({ message: `Erro: ${log.message}`, isError: true, timestamp: log.timestamp });
        console.error(customMessage, error);
    };

    const [stats, setStats] = useState({
        winRate: 68.5,
        tradesToday: 0,
        profitToday: 0,
        lastTradeAction: '-',
        lastTradeResult: '-',
        lastTradeTime: 0
    });
    const statsRef = useRef(stats);
    useEffect(() => { statsRef.current = stats; }, [stats]);
    
    const token = userData?.savedDerivToken || userData?.mtPassword;
    const appId = userData?.derivAppId || '1089';
    const symbol = userData?.tradingSettings?.selectedAsset || 'R_100';
    
    const activeCycleRef = useRef<boolean>(false);
    const lastSignalRef = useRef<number>(0);
    const monitoringTradesRef = useRef<number[]>([]);

    useEffect(() => {
        if (!engineRunning || userData?.mtPlatform !== 'deriv_api' || !token) return;
        
        const executeCycle = async () => {
            if (activeCycleRef.current) return;
            activeCycleRef.current = true;
            
            try {
                // 1. Monitor Phase
                const positionsToKeep: number[] = [];
                for (const contractId of monitoringTradesRef.current) {
                    try {
                        const statusRes = await axios.get(`/api/deriv/contract/${contractId}?appId=${appId}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const contract = statusRes.data?.contract;
                        
                        if (!contract) continue;
                        
                        if (contract.is_sold) {
                            setLastLog({ message: `Trade ${contractId} fechado externamente. Lucro: $${contract.profit.toFixed(2)}`, isError: false, timestamp: Date.now() });
                            setStats(prev => ({
                                ...prev,
                                profitToday: prev.profitToday + contract.profit,
                                lastTradeResult: contract.profit >= 0 ? 'WIN' : 'LOSS'
                            }));
                            continue;
                        }
                        
                        const buyPrice = contract.buy_price;
                        const roi = contract.profit / buyPrice;
                        const ageSeconds = (Date.now() / 1000) - contract.date_start;
                        
                        // Close if +/- 10% ROI, or after 60 seconds
                        if (roi >= 0.1 || roi <= -0.1 || ageSeconds > 60) {
                            try {
                                await axios.post(`/api/deriv/close-trade?appId=${appId}`, { contractId }, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                
                                const finalRes = await axios.get(`/api/deriv/contract/${contractId}?appId=${appId}`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                const finalProfit = finalRes.data?.contract?.profit || contract.profit;
                                
                                setLastLog({ message: `Trade ${contractId} finalizado. Lucro: $${finalProfit.toFixed(2)}`, isError: false, timestamp: Date.now() });
                                setStats(prev => ({
                                    ...prev,
                                    profitToday: prev.profitToday + finalProfit,
                                    lastTradeResult: finalProfit >= 0 ? 'WIN' : 'LOSS'
                                }));
                                
                                if (userData?.uid) {
                                    await addDoc(collection(db, "users", userData.uid, "auto_trades"), {
                                        contract_id: contractId,
                                        profit: finalProfit,
                                        timestamp: Date.now(),
                                        symbol: contract.underlying
                                    }).catch(e => logDetailedError("Erro ao salvar trade no firestore", e, "firebase/addDoc"));
                                }
                            } catch (e: any) {
                                logDetailedError("Failed to close trade", e, `/api/deriv/close-trade?appId=${appId}`, { contractId });
                                positionsToKeep.push(contractId);
                            }
                        } else {
                            positionsToKeep.push(contractId);
                        }
                    } catch (e: any) {
                        logDetailedError("Failed to fetch contract status", e, `/api/deriv/contract/${contractId}?appId=${appId}`);
                        positionsToKeep.push(contractId);
                    }
                }
                
                monitoringTradesRef.current = positionsToKeep;
                
                // 2. Generate Signal & Open Phase (Every 30s)
                const now = Date.now();
                if (now - lastSignalRef.current > 30000) {
                    lastSignalRef.current = now;
                    
                    const tickRes = await axios.get(`/api/deriv/tick/${symbol}?appId=${appId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (tickRes.data?.success === false) {
                        logDetailedError("Could not fetch price", { message: tickRes.data?.error }, `/api/deriv/tick/${symbol}?appId=${appId}`);
                        throw new Error(tickRes.data?.error || "Could not fetch price");
                    }
                    const price = tickRes.data?.tick?.quote || 0;
                    if (!price) {
                        logDetailedError("Could not fetch price limit", { message: "Price empty" }, `/api/deriv/tick/${symbol}?appId=${appId}`);
                        throw new Error("Could not fetch price");
                    }
                    
                    const signal = await AITradingEngine.analyze(symbol, price);
                    setLastSignal(signal);
                    
                    const openPositions = monitoringTradesRef.current.length;
                    const balance = 10000; // Mock or fetch balance
                    let amount = parseFloat(userData?.tradingSettings?.fixedLot || "1");
                    const MIN_STAKE = 1;
                    const requestedAmount = amount;
                    if (amount < MIN_STAKE) {
                        amount = MIN_STAKE;
                    }
                    
                    if (requestedAmount !== amount) {
                        console.log(`Requested Amount: ${requestedAmount}`);
                        console.log(`Final Amount Sent: ${amount}`);
                        setLastLog({ message: `Stake validado: Requested Amount: ${requestedAmount} -> Final Amount Sent: ${amount}`, isError: false, timestamp: Date.now() });
                    }
                    
                    const riskLimits = { 
                        maxDailyLoss: parseFloat(userData?.tradingSettings?.dailyLossLimit) || 100, 
                        maxOpenPositions: parseInt(userData?.tradingSettings?.maxPositions) || 3, 
                        maxTradeValue: parseFloat(userData?.tradingSettings?.dailyLossLimit) || 50,
                        minConfidence: parseFloat(userData?.tradingSettings?.minConfidence) || 80
                    };
                    
                    const cooldownMinutes = parseFloat(userData?.tradingSettings?.cooldownMinutes) || 5;
                    const timeSinceLastTrade = Date.now() - statsRef.current.lastTradeTime;
                    
                    if (statsRef.current.lastTradeTime > 0 && timeSinceLastTrade < cooldownMinutes * 60 * 1000) {
                        setLastLog({ message: `Sinal ignorado (Cooldown): Aguarde ${Math.ceil((cooldownMinutes * 60 * 1000 - timeSinceLastTrade) / 1000)}s`, isError: true, timestamp: Date.now() });
                        return; // skip execution
                    }

                    const validation = RiskManager.validate(signal, openPositions, balance, riskLimits, amount, statsRef.current.profitToday, engineRunning);
                    
                    if (!validation.valid) {
                        setLastLog({ message: `Sinal rejeitado: ${validation.reason}`, isError: true, timestamp: Date.now() });
                    } else {
                        const isBuy = signal.action === 'BUY';
                        const tradePayload: any = {
                            symbol: signal.symbol,
                            amount: amount,
                            contract_typeBase: isBuy ? 'MULTUP' : 'MULTDOWN'
                        };
                        const tradeRes = await axios.post(`/api/deriv/test-buy?appId=${appId}`, tradePayload, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        
                        if (tradeRes.data?.success) {
                            const newContractId = tradeRes.data.trade.contract_id;
                            monitoringTradesRef.current.push(newContractId);
                            setLastLog({ message: `Posição ${newContractId} aberta (${signal.action} ${signal.symbol})`, isError: false, timestamp: Date.now() });
                            setStats(prev => ({
                                ...prev,
                                tradesToday: prev.tradesToday + 1,
                                lastTradeAction: signal.action,
                                lastTradeResult: 'PENDING',
                                lastTradeTime: Date.now()
                            }));
                        } else {
                            logDetailedError('Erro ao abrir posição', { message: tradeRes.data?.error || 'Unknown error', response: { status: 400, data: tradeRes.data } }, `/api/deriv/test-buy?appId=${appId}`, tradePayload);
                        }
                    }
                }
                
            } catch (err: any) {
                logDetailedError(err?.message || 'Error no ciclo', err);
            } finally {
                activeCycleRef.current = false;
            }
        };

        executeCycle();
        const intervalId = setInterval(executeCycle, 5000); // 5s loop for monitoring
        return () => {
            clearInterval(intervalId);
            activeCycleRef.current = false;
        };
    }, [engineRunning, token, appId, symbol, userData]);

    return (
        <div className="bg-[#0a0000] border border-brand-red/20 rounded-2xl p-5 space-y-4 shadow-[0_0_20px_rgba(255,0,0,0.05)]">
            <h3 className="font-black italic text-white tracking-[0.2em] text-sm flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                    <Zap size={16} className="text-brand-red" />
                    AI ENGINE DASHBOARD
                </div>
                <div className="flex items-center gap-2">
                   {engineRunning ? (
                       <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red"></span>
                       </span>
                   ) : (
                       <span className="h-2 w-2 rounded-full bg-zinc-600"></span>
                   )}
                   <span className="text-[10px] uppercase font-mono text-zinc-500">
                       Cycle: 5s / 30s
                   </span>
                </div>
            </h3>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Target size={10} className="text-brand-red" /> Win Rate</div>
                    <div className="text-lg font-mono font-black text-white">{stats.winRate}%</div>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Activity size={10} className="text-brand-red" /> Hoje</div>
                    <div className="text-lg font-mono font-black text-white">{stats.tradesToday}</div>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp size={10} className={stats.profitToday >= 0 ? "text-green-500" : "text-red-500"} /> Lucro / Prejuízo</div>
                    <div className={cn("text-lg font-mono font-black", stats.profitToday >= 0 ? "text-green-400" : "text-red-400")}>
                        {stats.profitToday >= 0 ? '+' : ''}{stats.profitToday.toFixed(2)}
                    </div>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={10} className="text-brand-red" /> Último Trade</div>
                    <div className="text-sm font-mono font-bold text-white mt-1">
                        {stats.lastTradeAction !== '-' ? (
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px]", stats.lastTradeAction === 'BUY' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                                {stats.lastTradeAction}
                            </span>
                        ) : '-'} <span className="ml-1 text-zinc-500 text-[10px]">{stats.lastTradeResult}</span>
                    </div>
                </div>
            </div>

            {/* Last Signal */}
            {lastSignal && (
                <div className="bg-black border border-white/10 p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-red/5 blur-2xl rounded-full" />
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500">
                        <span>Último Sinal Gerado</span>
                        <span className="font-mono">{new Date(lastSignal.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={cn("text-xl font-black font-mono tracking-wider", lastSignal.action === 'BUY' ? "text-green-500" : "text-red-500")}>
                            {lastSignal.action}
                        </span>
                        <span className="text-sm font-bold text-white">{lastSignal.symbol}</span>
                        <div className="flex-1" />
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Confiança</span>
                            <span className={cn("font-mono font-bold text-sm", lastSignal.confidence >= 80 ? "text-green-400" : "text-yellow-400")}>{lastSignal.confidence}%</span>
                        </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 border-t border-white/5 pt-2 italic">
                        {lastSignal.reason}
                    </p>
                </div>
            )}

            {/* Exec Log */}
            <div className="flex items-center justify-between mt-2">
                <div className="flex-1">
                {lastLog && (
                    <div className={cn("text-[10px] font-mono px-3 py-2 rounded-lg flex items-center gap-2", 
                        lastLog.isError ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20")}>
                        {lastLog.isError ? <AlertCircle size={12} /> : <Zap size={12} />}
                        <span className="flex-1 truncate" title={lastLog.message}>{lastLog.message}</span>
                        <span className="opacity-50">{new Date(lastLog.timestamp).toLocaleTimeString()}</span>
                    </div>
                )}
                </div>
                {errorLogs.length > 0 && (
                    <button 
                        onClick={() => setShowLogsModal(true)}
                        className="ml-2 px-3 py-2 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center gap-1 transition-colors"
                    >
                        <AlertCircle size={12} className="text-red-400" />
                        Ver Log Completo ({errorLogs.length})
                    </button>
                )}
            </div>

            {/* Error Logs Modal */}
            {showLogsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                            <h2 className="text-white font-bold tracking-wider uppercase text-sm flex items-center gap-2">
                                <AlertCircle size={16} className="text-brand-red" />
                                Logs de Sistema
                            </h2>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                                    <input type="checkbox" checked={isDebug} onChange={x => setIsDebug(x.target.checked)} className="rounded border-none bg-black/50 accent-brand-red" />
                                    Modo Debug
                                </label>
                                <button onClick={() => setShowLogsModal(false)} className="text-zinc-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono">
                            {errorLogs.map((log, i) => (
                                <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs">
                                    <div className="flex items-center justify-between text-zinc-500 mb-2 border-b border-white/5 pb-2">
                                        <span className="text-brand-red font-bold">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                        {log.httpCode && <span className={cn("px-2 py-0.5 rounded text-black font-bold", log.httpCode >= 500 ? "bg-red-400" : "bg-orange-400")}>HTTP {log.httpCode}</span>}
                                    </div>
                                    
                                    <div className="text-red-400 font-bold mb-3">{log.message}</div>
                                    
                                    {log.endpoint && (
                                        <div className="mb-2">
                                            <div className="text-zinc-600 uppercase tracking-widest text-[9px]">Endpoint:</div>
                                            <div className="text-zinc-300 break-all bg-black/50 p-1.5 rounded mt-1">{log.endpoint}</div>
                                        </div>
                                    )}
                                    
                                    {log.payload && (
                                        <div className="mb-2">
                                            <div className="text-zinc-600 uppercase tracking-widest text-[9px]">Payload:</div>
                                            <pre className="text-zinc-400 bg-black/50 p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                                                {JSON.stringify(log.payload, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                    
                                    {isDebug && log.stackTrace && (
                                        <div className="mt-4 pt-3 border-t border-white/5">
                                            <div className="text-zinc-600 uppercase tracking-widest text-[9px]">Stack Trace:</div>
                                            <pre className="text-zinc-500 bg-black/50 p-2 rounded mt-1 overflow-x-auto text-[10px] whitespace-pre-wrap">
                                                {log.stackTrace}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {errorLogs.length === 0 && <div className="text-center text-zinc-500 py-10 font-sans">Nenhum erro registrado nesta sessão.</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
