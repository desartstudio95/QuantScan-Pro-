import React, { useState, useEffect, useRef } from 'react';
import { AITradingEngine, RiskManager, AISignal } from '../services/aiTradingEngine';
import { Activity, Target, TrendingUp, AlertCircle, Clock, Zap, X } from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';
import { collection, addDoc, query, where, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
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
        console.error(customMessage, error && (error.message || String(error)));
    };

    const [stats, setStats] = useState({
        winRate: 68.5,
        totalTrades: 0,
        winTrades: 0,
        tradesToday: 0,
        profitToday: 0,
        lastTradeAction: '-',
        lastTradeResult: '-',
        lastTradeTime: 0
    });
    const statsRef = useRef(stats);
    useEffect(() => { statsRef.current = stats; }, [stats]);

    // Fetch real stats on mount
    useEffect(() => {
        if (!userData?.uid) return;
        const fetchRealStats = async () => {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const q = query(
                    collection(db, "users", userData.uid, "auto_trades"),
                    orderBy("timestamp", "desc")
                );
                const snapshot = await getDocs(q);
                
                let winCount = 0;
                let totalCount = 0;
                let tradesTodayCount = 0;
                let profitTodaySum = 0;
                let lastAction = '-';
                let lastResult = '-';
                let lastTime = 0;
                
                snapshot.docs.forEach((doc, idx) => {
                    const data = doc.data();
                    const isWin = (data.profit || 0) >= 0;
                    
                    if (isWin) winCount++;
                    totalCount++;
                    
                    if (data.timestamp >= today.getTime()) {
                        tradesTodayCount++;
                        profitTodaySum += (data.profit || 0);
                    }
                    
                    if (idx === 0) {
                        lastAction = data.symbol || '-';
                        lastResult = isWin ? 'WIN' : 'LOSS';
                        lastTime = data.timestamp;
                    }
                });

                const computedWinRate = totalCount > 0 ? (winCount / totalCount) * 100 : 0;

                setStats(prev => ({
                   ...prev,
                   winRate: Number(computedWinRate.toFixed(1)),
                   totalTrades: totalCount,
                   winTrades: winCount,
                   tradesToday: tradesTodayCount,
                   profitToday: profitTodaySum,
                   lastTradeAction: lastAction,
                   lastTradeResult: lastResult,
                   lastTradeTime: lastTime
                }));

            } catch (err: any) {
                console.error("Failed to load real stats", err?.message || String(err));
            }
        };
        fetchRealStats();
    }, [userData?.uid]);
    
    const [aiMaxOpenPositions, setAiMaxOpenPositions] = useState(userData?.tradingSettings?.aiMaxOpenPositions?.toString() || "2");
    const [aiTradeAmount, setAiTradeAmount] = useState(userData?.tradingSettings?.aiTradeAmount?.toString() || "1");
    const [aiMinConfidence, setAiMinConfidence] = useState(userData?.tradingSettings?.aiMinConfidence?.toString() || "85");
    const [aiAggressiveness, setAiAggressiveness] = useState(userData?.tradingSettings?.aiAggressiveness || "Balanced");
    const [aiCooldownSeconds, setAiCooldownSeconds] = useState(userData?.tradingSettings?.aiCooldownSeconds?.toString() || "60");
    const [aiAutoTrading, setAiAutoTrading] = useState(userData?.tradingSettings?.aiAutoTrading ?? false);
    
    // Risk settings
    const [riskPerTrade, setRiskPerTrade] = useState(userData?.tradingSettings?.riskPerTrade?.toString() || "1");
    const [dailyLossLimit, setDailyLossLimit] = useState(userData?.tradingSettings?.dailyLossLimit?.toString() || "100");
    const [dailyTargetProfit, setDailyTargetProfit] = useState(userData?.tradingSettings?.dailyTargetProfit?.toString() || "50");
    
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const handleAggressivenessChange = (mode: string) => {
        setAiAggressiveness(mode);
        let conf = "85";
        if (mode === 'Conservador') conf = "90";
        if (mode === 'Moderado') conf = "85";
        if (mode === 'Agressivo') conf = "75";
        setAiMinConfidence(conf);
        
        if (userData?.uid) {
            updateDoc(doc(db, 'users', userData.uid), {
                'tradingSettings.aiAggressiveness': mode,
                'tradingSettings.aiMinConfidence': parseFloat(conf)
            }).catch(e => console.error(e));
        }
    };

    const saveAISettings = async () => {
        if (!userData?.uid) return;
        setIsSavingSettings(true);
        try {
            const userRef = doc(db, 'users', userData.uid);
            await updateDoc(userRef, {
                'tradingSettings.aiMaxOpenPositions': parseInt(aiMaxOpenPositions) || 2,
                'tradingSettings.aiTradeAmount': parseFloat(aiTradeAmount) || 1,
                'tradingSettings.aiMinConfidence': parseFloat(aiMinConfidence) || 85,
                'tradingSettings.aiAggressiveness': aiAggressiveness,
                'tradingSettings.aiCooldownSeconds': parseInt(aiCooldownSeconds) || 60,
                'tradingSettings.aiAutoTrading': aiAutoTrading,
                'tradingSettings.riskPerTrade': parseFloat(riskPerTrade) || 1,
                'tradingSettings.dailyLossLimit': parseFloat(dailyLossLimit) || 100,
                'tradingSettings.dailyTargetProfit': parseFloat(dailyTargetProfit) || 50
            });
            setLastLog({ message: "Configurações de AI salvas com sucesso.", isError: false, timestamp: Date.now() });
        } catch(e: any) {
            logDetailedError("Erro ao salvar AI settings", e);
        } finally {
            setIsSavingSettings(false);
        }
    };

    const token = userData?.savedDerivToken || userData?.mtPassword;
    const appId = userData?.derivAppId || '1089';
    const symbol = userData?.tradingSettings?.selectedAsset || 'R_100';
    
    const activeCycleRef = useRef<boolean>(false);
    const lastSignalRef = useRef<number>(0);
    const monitoringTradesRef = useRef<number[]>([]);
    const highestROILogs = useRef<Record<number, number>>({});

    useEffect(() => {
        if (userData?.mtPlatform !== 'deriv_api' || !token) return;
        
        const executeCycle = async () => {
            if (activeCycleRef.current) return;
            activeCycleRef.current = true;
            
            try {
                const tpPercent = parseFloat(userData?.tradingSettings?.takeProfit) || 10;
                const slPercent = parseFloat(userData?.tradingSettings?.stopLoss) || 10;
                const trailingStopEnabled = userData?.tradingSettings?.trailingStop ?? true;
                const autoCloseSeconds = (parseFloat(userData?.tradingSettings?.autoCloseMinutes) || 10) * 60;
                
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
                            setStats(prev => {
                                const isWin = contract.profit >= 0;
                                const newTotal = prev.totalTrades + 1;
                                const newWin = prev.winTrades + (isWin ? 1 : 0);
                                return {
                                    ...prev,
                                    totalTrades: newTotal,
                                    winTrades: newWin,
                                    winRate: Number((newTotal > 0 ? (newWin / newTotal) * 100 : 0).toFixed(1)),
                                    profitToday: prev.profitToday + contract.profit,
                                    lastTradeResult: isWin ? 'WIN' : 'LOSS'
                                };
                            });
                            delete highestROILogs.current[contractId];
                            continue;
                        }
                        
                        const buyPrice = contract.buy_price;
                        const roi = contract.profit / buyPrice; // Current ROI in decimals (e.g., 0.1 = 10%)
                        const ageSeconds = (Date.now() / 1000) - contract.date_start;
                        
                        // Update Highest ROI
                        const roiPercent = roi * 100;
                        if (!highestROILogs.current[contractId]) highestROILogs.current[contractId] = roiPercent;
                        if (roiPercent > highestROILogs.current[contractId]) highestROILogs.current[contractId] = roiPercent;
                        
                        let shouldClose = false;
                        let closeReason = "";
                        
                        // TP / SL Logic
                        if (roiPercent >= tpPercent) {
                            shouldClose = true;
                            closeReason = `Take Profit atingido (+${roiPercent.toFixed(2)}%)`;
                        } else if (roiPercent <= -slPercent) {
                            shouldClose = true;
                            closeReason = `Stop Loss atingido (${roiPercent.toFixed(2)}%)`;
                        } else if (trailingStopEnabled && highestROILogs.current[contractId] > 5) {
                            // Example Trailing Stop: If ROI drops by 5% from highest, and we are in profit
                            const dropFromHigh = highestROILogs.current[contractId] - roiPercent;
                            if (dropFromHigh >= 5 && roiPercent > 0) {
                                shouldClose = true;
                                closeReason = `Trailing Stop ativado (Drop from high, ROI: ${roiPercent.toFixed(2)}%)`;
                            }
                        } else if (ageSeconds > autoCloseSeconds) {
                            shouldClose = true;
                            closeReason = `Auto Close Time limit reached`;
                        }
                        
                        if (shouldClose) {
                            try {
                                await axios.post(`/api/deriv/close-trade?appId=${appId}`, { contractId }, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                
                                const finalRes = await axios.get(`/api/deriv/contract/${contractId}?appId=${appId}`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                const finalProfit = finalRes.data?.contract?.profit || contract.profit;
                                
                                setLastLog({ message: `Trade ${contractId} finalizado. ${closeReason}. Lucro: $${finalProfit.toFixed(2)}`, isError: false, timestamp: Date.now() });
                                setStats(prev => {
                                    const isWin = finalProfit >= 0;
                                    const newTotal = prev.totalTrades + 1;
                                    const newWin = prev.winTrades + (isWin ? 1 : 0);
                                    return {
                                        ...prev,
                                        totalTrades: newTotal,
                                        winTrades: newWin,
                                        winRate: Number((newTotal > 0 ? (newWin / newTotal) * 100 : 0).toFixed(1)),
                                        profitToday: prev.profitToday + finalProfit,
                                        lastTradeResult: isWin ? 'WIN' : 'LOSS'
                                    };
                                });
                                
                                delete highestROILogs.current[contractId];
                                
                                if (userData?.uid) {
                                    await addDoc(collection(db, "users", userData.uid, "auto_trades"), {
                                        contract_id: contractId,
                                        profit: finalProfit,
                                        timestamp: Date.now(),
                                        symbol: contract.underlying,
                                        close_reason: closeReason
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
                        const errMessage = e.response?.data?.error || e.message;
                        logDetailedError("Failed to fetch contract status", e, `/api/deriv/contract/${contractId}?appId=${appId}`);
                        if (e.response?.status === 500 && errMessage.includes('error occurred while processing')) {
                            // Don't keep it, it's a dead/invalid contract on Deriv side
                        } else {
                            positionsToKeep.push(contractId);
                        }
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
                    
                    // Fetch real balance from Deriv if possible
                    let balance = 10000; 
                    try {
                        const balRes = await axios.get(`/api/deriv/balance?appId=${appId}`, { headers: { Authorization: `Bearer ${token}` } });
                        if (balRes.data?.balance?.balance) {
                            balance = balRes.data.balance.balance;
                        }
                    } catch (e) {
                         // ignore and fallback
                    }
                    
                    let amount = 1;
                    const riskPercent = parseFloat(userData?.tradingSettings?.riskPerTrade) || 0;
                    if (riskPercent > 0) {
                        amount = balance * (riskPercent / 100);
                    } else {
                        const engineTradeVal = Number(aiTradeAmount);
                        amount = !isNaN(engineTradeVal) ? engineTradeVal : 1;
                    }
                    
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
                    
                    const engineTargetProfitStr = userData?.tradingSettings?.takeProfit;
                    const tpValue = parseFloat(engineTargetProfitStr) || 10;
                    
                    const engineMaxOpen = Number(aiMaxOpenPositions);
                    const engineMinConf = Number(aiMinConfidence);
                    
                    const riskLimits = { 
                        maxDailyLoss: parseFloat(userData?.tradingSettings?.dailyLossLimit) || 100, 
                        maxOpenPositions: !isNaN(engineMaxOpen) ? engineMaxOpen : 2, 
                        maxTradeValue: parseFloat(userData?.tradingSettings?.dailyLossLimit) || 50,
                        minConfidence: !isNaN(engineMinConf) ? engineMinConf : 85,
                        dailyProfitTarget: parseFloat(userData?.tradingSettings?.dailyTargetProfit) || 50
                    };
                    
                    const engineCooldown = Number(aiCooldownSeconds);
                    const cooldownMs = (!isNaN(engineCooldown) ? engineCooldown : 60) * 1000;
                    const timeSinceLastTrade = Date.now() - statsRef.current.lastTradeTime;
                    
                    if (statsRef.current.lastTradeTime > 0 && timeSinceLastTrade < cooldownMs) {
                        setLastLog({ message: `Sinal ignorado (Cooldown): Aguarde ${Math.ceil((cooldownMs - timeSinceLastTrade) / 1000)}s`, isError: true, timestamp: Date.now() });
                        return; // skip execution
                    }

                    if (!aiAutoTrading) {
                        setLastLog({ message: "Sinal Gerado. (Auto-Trading Desligado, nenhuma ordem enviada).", isError: false, timestamp: Date.now() });
                        return;
                    }

                    const validation = RiskManager.validate(signal, openPositions, balance, riskLimits, amount, statsRef.current.profitToday, aiAutoTrading);
                    
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
    }, [engineRunning, aiAutoTrading, aiMaxOpenPositions, aiTradeAmount, aiMinConfidence, aiCooldownSeconds, token, appId, symbol, userData]);

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

            {/* AI Trading Settings Panel */}
            <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                    <span className="text-xs font-black uppercase tracking-wider text-white">AI Trading Settings</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{aiAutoTrading ? 'Auto On' : 'Auto Off'}</span>
                        <div className={cn("w-8 h-4 rounded-full transition-colors relative", aiAutoTrading ? "bg-brand-red" : "bg-zinc-700")}>
                            <div className={cn("absolute top-0.5 bottom-0.5 w-3 rounded-full bg-white transition-all shadow", aiAutoTrading ? "left-4.5" : "left-0.5")}/>
                        </div>
                        <input type="checkbox" className="hidden" checked={aiAutoTrading} onChange={e => {
                            const val = e.target.checked;
                            setAiAutoTrading(val);
                            if (userData?.uid) {
                                updateDoc(doc(db, 'users', userData.uid), {
                                    'tradingSettings.aiAutoTrading': val
                                }).then(() => setLastLog({ message: "Auto Trading " + (val ? "Ativado" : "Desativado"), isError: false, timestamp: Date.now() })).catch((err: any) => console.error(err?.message || err));
                            }
                        }} />
                    </label>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest">Max Open Positions</label>
                        <input 
                            type="number" 
                            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-brand-red outline-none transition-colors"
                            value={aiMaxOpenPositions}
                            onChange={(e) => setAiMaxOpenPositions(e.target.value)}
                            onBlur={saveAISettings}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest">Trade Amount (USD)</label>
                        <input 
                            type="number" 
                            step="1"
                            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-brand-red outline-none transition-colors"
                            value={aiTradeAmount}
                            onChange={(e) => setAiTradeAmount(e.target.value)}
                            onBlur={saveAISettings}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest flex items-center gap-1">Modo Copy Trading <span className="w-1.5 h-1.5 bg-brand-red rounded-full animate-pulse ml-1"></span></label>
                        <select 
                            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-brand-red outline-none transition-colors appearance-none"
                            value={aiAggressiveness}
                            onChange={(e) => handleAggressivenessChange(e.target.value)}
                        >
                            <option value="Conservador">Conservador (Risco Baixo)</option>
                            <option value="Moderado">Moderado (Risco Médio)</option>
                            <option value="Agressivo">Agressivo (Risco Alto)</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest">Cooldown (Sec)</label>
                        <input 
                            type="number" 
                            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-brand-red outline-none transition-colors"
                            value={aiCooldownSeconds}
                            onChange={(e) => setAiCooldownSeconds(e.target.value)}
                            onBlur={saveAISettings}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest">Risco por Operação (%)</label>
                        <select 
                            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-brand-red outline-none transition-colors appearance-none"
                            value={riskPerTrade}
                            onChange={(e) => setRiskPerTrade(e.target.value)}
                            onBlur={saveAISettings}
                        >
                            <option value="0.5">0.5%</option>
                            <option value="1">1%</option>
                            <option value="2">2%</option>
                            <option value="3">3%</option>
                            <option value="5">5%</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest">Perda Máxima Diária ($)</label>
                        <input 
                            type="number" 
                            step="1"
                            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-brand-red outline-none transition-colors"
                            value={dailyLossLimit}
                            onChange={(e) => setDailyLossLimit(e.target.value)}
                            onBlur={saveAISettings}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest">Meta Diária ($)</label>
                        <input 
                            type="number" 
                            step="1"
                            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-brand-red outline-none transition-colors"
                            value={dailyTargetProfit}
                            onChange={(e) => setDailyTargetProfit(e.target.value)}
                            onBlur={saveAISettings}
                        />
                    </div>
                </div>
            </div>

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
                                                {(() => {
                                                    try {
                                                        return JSON.stringify(log.payload, null, 2);
                                                    } catch (e) {
                                                        return "[Circular or Unstringifiable Payload]";
                                                    }
                                                })()}
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
