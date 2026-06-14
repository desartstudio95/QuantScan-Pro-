import React, { useState, useEffect } from 'react';
import { Users, Server, Activity, ShieldCheck, Power, RefreshCw, Layers } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import axios from 'axios';

export const MultiAccountManager = ({ userData }: { userData: any }) => {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach(doc => {
                const user = doc.data();
                if (user.mtPlatform === 'deriv_api' || user.metaApiAccountId) {
                    list.push({ id: doc.id, ...user });
                }
            });
            setClients(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const toggleClientEngine = async (clientId: string, currentState: boolean) => {
        try {
            await updateDoc(doc(db, 'users', clientId), {
                'tradingSettings.engineRunning': !currentState
            });
        } catch (e: any) {
            console.error("Failed to toggle engine", e);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-brand-red">
                <RefreshCw size={32} className="animate-spin mb-4" />
                <p className="text-xs font-black uppercase tracking-widest text-white">Carregando Clientes...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-[#0a0000] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-brand-red/10 rounded-xl">
                        <Users size={24} className="text-brand-red" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider">Multi Account Manager</h2>
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest mt-1">
                            Sistema Centralizado de Execução de Clientes
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {clients.length === 0 && (
                        <div className="col-span-1 lg:col-span-2 text-center py-10 bg-black/40 border border-white/5 rounded-xl">
                            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Nenhum cliente com API configurada encontrado.</p>
                        </div>
                    )}
                    {clients.map(client => {
                        const engineRunning = client.tradingSettings?.engineRunning ?? false;
                        const autoTrading = client.tradingSettings?.aiAutoTrading ?? false;
                        const platform = client.mtPlatform === 'deriv_api' ? 'Deriv API' : 'MetaTrader';
                        const riskSettings = client.tradingSettings?.aiAggressiveness || 'Balanced';
                        const takeProfit = client.tradingSettings?.takeProfit || 'N/A';

                        return (
                            <div key={client.id} className="bg-black/60 border border-white/5 rounded-xl p-5 space-y-4">
                                <div className="flex items-start justify-between border-b border-white/5 pb-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-white truncate max-w-[200px]">{client.name || client.email}</span>
                                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{platform} &bull; ID: {client.id.slice(0, 6)}</span>
                                    </div>
                                    <div className={cn("px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border",
                                        engineRunning ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                                    )}>
                                        {engineRunning ? "Online" : "Offline"}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-black border border-white/5 rounded-lg p-3">
                                        <div className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest mb-1 flex items-center gap-1">
                                            <Activity size={10} /> Confiança Mín.
                                        </div>
                                        <div className="text-xs font-mono text-white">{client.tradingSettings?.aiMinConfidence || 85}% ({riskSettings})</div>
                                    </div>
                                    <div className="bg-black border border-white/5 rounded-lg p-3">
                                        <div className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest mb-1 flex items-center gap-1">
                                            <Layers size={10} /> Max Ordens
                                        </div>
                                        <div className="text-xs font-mono text-white">{client.tradingSettings?.aiMaxOpenPositions || 2} Ordens</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Status IA</span>
                                        {autoTrading ? (
                                            <span className="w-2 h-2 rounded-full bg-brand-red shadow-[0_0_8px_rgba(255,0,0,0.8)] animate-pulse" />
                                        ) : (
                                            <span className="w-2 h-2 rounded-full bg-zinc-600" />
                                        )}
                                    </div>

                                    <button
                                        onClick={() => toggleClientEngine(client.id, engineRunning)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                            engineRunning 
                                                ? "bg-zinc-800 text-white hover:bg-zinc-700"
                                                : "bg-brand-red text-white hover:bg-red-500"
                                        )}
                                    >
                                        <Power size={14} />
                                        {engineRunning ? 'Parar Motor' : 'Ativar Master'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
