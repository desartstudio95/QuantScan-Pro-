import React, { useEffect, useState } from 'react';
import { Network, Activity, Clock, ShieldCheck, AlertTriangle, Disc } from 'lucide-react';
import { cn } from '../lib/utils';
import axios from 'axios';

export const DerivDiagnosticPanel = ({ userData }: { userData: any }) => {
    const [status, setStatus] = useState<'ONLINE' | 'OFFLINE' | 'CONNECTING'>('CONNECTING');
    const [account, setAccount] = useState<string>('-------');
    const [balance, setBalance] = useState<string>('---');
    const [currency, setCurrency] = useState<string>('---');
    const [openPositions, setOpenPositions] = useState<number>(0);
    const [lastTick, setLastTick] = useState<'OK' | 'WAITING' | 'ERROR'>('WAITING');
    const [latency, setLatency] = useState<number>(0);

    const checkConnection = async () => {
        try {
            if (userData?.mtPlatform !== 'deriv_api' || (!userData?.savedDerivToken && !userData?.mtPassword)) {
                setStatus('OFFLINE');
                return;
            }

            const token = userData?.savedDerivToken || userData?.mtPassword;
            const start = performance.now();
            const res = await axios.get('/api/deriv/account', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const end = performance.now();

            if (res.data?.success) {
                setStatus('ONLINE');
                setAccount(res.data.loginid);
                setBalance(res.data.balance.toString());
                setCurrency(res.data.currency);
                setOpenPositions(res.data.openPositions || 0);
                setLatency(Math.round(end - start));
                setLastTick('OK');
            } else {
                setStatus('OFFLINE');
            }
        } catch (e) {
            setStatus('OFFLINE');
            setLastTick('ERROR');
        }
    };

    useEffect(() => {
        checkConnection();
        const interval = setInterval(checkConnection, 15000);
        return () => clearInterval(interval);
    }, [userData]);

    if (userData?.mtPlatform !== 'deriv_api') return null;

    return (
        <div className="bg-[#0a0000] border border-brand-red/20 rounded-2xl p-5 space-y-4">
            <h3 className="font-black italic uppercase text-white tracking-widest text-sm flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                    <Disc size={16} className={cn("transition-colors", status === 'ONLINE' ? 'text-green-500 blur-[1px]' : 'text-red-500 blur-[1px]')} />
                    DERIV STATUS
                </div>
                {status === 'ONLINE' ? (
                   <span className="text-green-500 text-xs px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/30 font-mono flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,0,0.2)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> ONLINE
                   </span>
                ) : (
                   <span className="text-red-500 text-xs px-2 py-0.5 bg-red-500/10 rounded-full border border-red-500/30 font-mono flex items-center gap-1.5 shadow-[0_0_10px_rgba(255,0,0,0.2)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> OFFLINE
                   </span>
                )}
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm font-mono">
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Account</div>
                    <div className="text-white flex items-center gap-2">
                        <ShieldCheck size={14} className="text-brand-red" /> {account}
                    </div>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Balance</div>
                    <div className="text-white flex items-center gap-2">
                        <Activity size={14} className="text-brand-red" /> {balance} {currency}
                    </div>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Open Positions</div>
                    <div className="text-white flex items-center gap-2">
                        <Activity size={14} className="text-brand-red" /> {openPositions}
                    </div>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Last Tick</div>
                    <div className={cn("flex items-center gap-2", lastTick === 'OK' ? 'text-green-400' : lastTick === 'ERROR' ? 'text-red-400' : 'text-yellow-400')}>
                        <Clock size={14} /> {lastTick}
                    </div>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Latency</div>
                    <div className="text-white flex items-center gap-2">
                        <Network size={14} className="text-brand-red" /> {latency}ms
                    </div>
                </div>
            </div>
        </div>
    );
};
