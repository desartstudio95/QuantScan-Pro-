import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, TrendingDown, TrendingUp, RefreshCcw, XCircle, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Position {
    contract_id: number;
    symbol: string;
    contract_type: string;
    buy_price: number;
    currency: string;
    // Note: portfolio API doesn't return current profit directly, we might just show buy price for now or mock if needed.
    // Actually, Deriv API portfolio returns: contract_id, symbol, contract_type, buy_price, payout, transaction_id...
}

interface LogEntry {
    time: Date;
    action: string;
    result: string;
    error?: string;
}

export const DerivTestPanel = ({ userData }: { userData: any }) => {
    const [symbol, setSymbol] = useState('R_100'); // Volatility 100 Index as default
    const [amount, setAmount] = useState(1);
    const [positions, setPositions] = useState<Position[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const token = userData?.savedDerivToken || userData?.mtPassword;
    const appId = userData?.derivAppId || '1089';

    const addLog = (action: string, result: string, error?: string) => {
        setLogs(prev => [{ time: new Date(), action, result, error }, ...prev].slice(0, 50));
    };

    const fetchPositions = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/deriv/positions?appId=${appId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setPositions(res.data.positions || []);
                addLog('REFRESH POSITIONS', `Fetched ${res.data.positions?.length || 0} positions`);
            }
        } catch (e: any) {
            addLog('REFRESH POSITIONS', 'Failed', e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTrade = async (direction: 'BUY' | 'SELL') => {
        if (!token) return;
        setLoading(true);
        const contract_typeBase = direction === 'BUY' ? 'CALL' : 'PUT';
        try {
            const res = await axios.post(`/api/deriv/test-buy?appId=${appId}`, {
                symbol,
                amount,
                contract_typeBase,
                duration: 5,
                duration_unit: 't'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                addLog(`TEST ${direction}`, `Order Executed: ${res.data.trade?.contract_id}`);
                fetchPositions();
            }
        } catch (e: any) {
            addLog(`TEST ${direction}`, 'Failed', e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };

    const closePosition = async (contractId: number) => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await axios.post(`/api/deriv/close-trade?appId=${appId}`, {
                contractId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                addLog('CLOSE POSITION', `Closed contract ${contractId}`);
                fetchPositions();
            }
        } catch (e: any) {
            addLog('CLOSE POSITION', `Failed contract ${contractId}`, e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };

    const closeAllPositions = async () => {
        if (!token || positions.length === 0) return;
        setLoading(true);
        let successCount = 0;
        for (const pos of positions) {
            try {
                await axios.post(`/api/deriv/close-trade?appId=${appId}`, {
                    contractId: pos.contract_id
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                successCount++;
            } catch (e: any) {
                addLog('CLOSE POSITION', `Failed contract ${pos.contract_id}`, e.response?.data?.error || e.message);
            }
        }
        addLog('CLOSE ALL', `Closed ${successCount}/${positions.length} positions`);
        fetchPositions();
        setLoading(false);
    };

    useEffect(() => {
        if (token) {
            fetchPositions();
        }
    }, [token]);

    if (userData?.mtPlatform !== 'deriv_api') return null;

    return (
        <div className="bg-[#0a0000] border border-brand-red/20 rounded-2xl p-5 space-y-6 mt-4">
            <h3 className="font-black italic uppercase text-white tracking-widest text-lg border-b border-white/5 pb-3">Trading Test</h3>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                    <label className="text-xs text-zinc-500 uppercase tracking-widest">Symbol</label>
                    <input 
                        type="text" 
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-brand-red focus:outline-none"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-zinc-500 uppercase tracking-widest">Amount (USD)</label>
                    <input 
                        type="number" 
                        value={amount}
                        min={1}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-brand-red focus:outline-none"
                    />
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                    <button 
                        onClick={() => handleTrade('BUY')}
                        disabled={loading}
                        className="w-full bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/30 rounded-lg px-3 py-2 font-black italic uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <TrendingUp size={16} /> Buy Test
                    </button>
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                    <button 
                        onClick={() => handleTrade('SELL')}
                        disabled={loading}
                        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg px-3 py-2 font-black italic uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <TrendingDown size={16} /> Sell Test
                    </button>
                </div>
            </div>

            {/* Actions & Tables */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Open Positions</h4>
                    <div className="flex gap-2">
                        <button onClick={fetchPositions} disabled={loading} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors">
                            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={closeAllPositions} disabled={loading || positions.length === 0} className="px-3 py-1.5 bg-brand-red/20 text-brand-red border border-brand-red/30 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-brand-red/30 transition-colors disabled:opacity-50">
                            Close All
                        </button>
                    </div>
                </div>

                <div className="bg-black/50 border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white/5 text-zinc-500 text-[10px] uppercase tracking-widest">
                            <tr>
                                <th className="px-4 py-3 font-medium">Contract ID</th>
                                <th className="px-4 py-3 font-medium">Symbol</th>
                                <th className="px-4 py-3 font-medium">Direction</th>
                                <th className="px-4 py-3 font-medium">Entry Price</th>
                                <th className="px-4 py-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                            {positions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 text-xs uppercase tracking-widest">No open positions</td>
                                </tr>
                            ) : (
                                positions.map((pos) => (
                                    <tr key={pos.contract_id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs">{pos.contract_id}</td>
                                        <td className="px-4 py-3 font-bold">{pos.symbol}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${pos.contract_type.includes('UP') || pos.contract_type === 'CALL' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {pos.contract_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono">{pos.buy_price} {pos.currency}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                                onClick={() => closePosition(pos.contract_id)}
                                                className="text-brand-red hover:text-red-400 transition-colors p-1"
                                                title="Close Position"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Logs */}
            <div className="space-y-4">
                <h4 className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Trade Logs</h4>
                <div className="bg-black/50 border border-white/5 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white/5 text-zinc-500 text-[10px] uppercase tracking-widest sticky top-0">
                            <tr>
                                <th className="px-4 py-3 font-medium">Time</th>
                                <th className="px-4 py-3 font-medium">Action</th>
                                <th className="px-4 py-3 font-medium">Result</th>
                                <th className="px-4 py-3 font-medium">Error</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 text-xs uppercase tracking-widest">No logs yet</td>
                                </tr>
                            ) : (
                                logs.map((log, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-2 font-mono text-[10px] text-zinc-500 w-32 flex items-center gap-1.5">
                                            <Clock size={12} />
                                            {log.time.toLocaleTimeString()}
                                        </td>
                                        <td className="px-4 py-2 font-bold text-xs"><span className="px-2 py-0.5 bg-white/5 rounded border border-white/10">{log.action}</span></td>
                                        <td className="px-4 py-2 text-xs flex items-center gap-1.5">
                                            {log.error ? <AlertTriangle size={12} className="text-yellow-500" /> : <CheckCircle2 size={12} className="text-green-500" />}
                                            {log.result}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-red-400 w-full truncate max-w-xs" title={log.error}>{log.error || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
