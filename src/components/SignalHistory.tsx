import React, { useEffect, useState } from 'react';
import { Signal, SignalResult, SignalType } from '../types';
import { cn } from '../lib/utils';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';

export const SignalHistory: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'signals'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let newSignals: Signal[] = [];
      snapshot.forEach((doc) => {
        newSignals.push({ id: doc.id, ...doc.data() } as Signal);
      });
      newSignals.sort((a, b) => b.timestamp - a.timestamp);
      setSignals(newSignals);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'signals');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-3 uppercase">
          <Clock size={20} className="text-brand-red" />
          Histórico de Sinais
        </h1>
        <span className="bg-brand-gray px-4 py-2 rounded-full text-zinc-400 text-sm font-bold border border-white/5">
          {signals.length} Sinais
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {signals.length === 0 ? (
          <div className="glass-card p-12 text-center text-zinc-500">
            Nenhum sinal encontrado. Comece realizando um novo scan.
          </div>
        ) : (
          signals.map((signal) => (
            <div key={signal.id} className="glass-card p-4 flex flex-col md:flex-row md:items-center gap-6 group hover:border-white/20 transition-all">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                signal.type === SignalType.BUY ? "bg-green-500/10 text-green-500" : "bg-brand-red/10 text-brand-red"
              )}>
                {signal.type === SignalType.BUY ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-7 flex-1 gap-4 items-center">
                <div>
                  <span className="text-[10px] text-zinc-500 font-black uppercase">Ativo / TF</span>
                  <p className="font-bold text-white text-sm">{signal.pair} <span className="text-zinc-500">· {signal.timeframe}</span></p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-black uppercase">Tipo</span>
                  <p className={cn(
                    "font-bold italic uppercase text-sm",
                    signal.type === SignalType.BUY ? "text-green-500" : "text-brand-red"
                  )}>{signal.type}</p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-black uppercase">Score</span>
                  <p className="font-bold text-white text-sm">{signal.score}%</p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-black uppercase">SL / TP</span>
                  <p className="font-bold text-white text-xs">{signal.stopLoss} <span className="text-zinc-600">/</span> <span className="text-zinc-400">{signal.takeProfit}</span></p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-black uppercase">Data e Hora</span>
                  <p className="font-bold text-zinc-300 text-xs whitespace-nowrap">{new Date(signal.timestamp).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-black uppercase">Status</span>
                  <div className={cn(
                    "inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                    signal.result === SignalResult.PENDING ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                  )}>
                    {signal.result === SignalResult.PENDING ? "Válido" : "Expirado"}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 font-black uppercase">Resultado</span>
                  <div className={cn(
                    "flex items-center justify-end gap-1 font-black italic uppercase text-sm",
                    signal.result === SignalResult.GAIN ? "text-green-500" : 
                    signal.result === SignalResult.LOSS ? "text-brand-red" : 
                    "text-zinc-500"
                  )}>
                    {signal.result}
                  </div>
                </div>
              </div>

              <div className="h-px w-full md:h-12 md:w-px bg-white/5" />

              <div className="flex md:flex-col justify-between text-right gap-1 min-w-[80px]">
                <span className="text-[10px] text-zinc-500 font-black uppercase">Data</span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  {new Date(signal.timestamp).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-zinc-600 font-medium hidden md:block">
                  {new Date(signal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
