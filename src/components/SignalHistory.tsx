import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Signal, SignalResult, SignalType } from '../types';
import { cn } from '../lib/utils';
import { Clock, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';

export const SignalHistory: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [expandedSignalIds, setExpandedSignalIds] = useState<string[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'signals'),
      where('userId', '==', auth.currentUser.uid)
    );

    // The onSnapshot listener below automatically handles updates
    // when data in Firestore changes.
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

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredSignals = signals.filter(signal => {
    if (!startDate && !endDate) return true;
    
    const signalDate = new Date(signal.timestamp);
    if (startDate) {
      const start = new Date(startDate);
      // We parse 'YYYY-MM-DD' dynamically. new Date('YYYY-MM-DD') returns midnight UTC. But let's be careful with local timezones.
      const [year, month, day] = startDate.split('-').map(Number);
      const localStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      if (signalDate < localStart) return false;
    }
    
    if (endDate) {
      const [year, month, day] = endDate.split('-').map(Number);
      const localEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
      if (signalDate > localEnd) return false;
    }
    
    return true;
  });

  const toggleSignal = (id: string) => {
    setExpandedSignalIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-3 uppercase">
          <Clock size={20} className="text-brand-red" />
          Histórico de Sinais
        </h1>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex flex-wrap sm:flex-nowrap bg-brand-gray/50 rounded-lg p-1 border border-white/5 items-center">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-zinc-300 outline-none px-2 py-1 [color-scheme:dark]"
            />
            <span className="text-zinc-600 px-2 py-1">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-zinc-300 outline-none px-2 py-1 [color-scheme:dark]"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xs text-brand-red px-2 hover:bg-brand-red/10 rounded py-1 ml-1"
              >
                Limpar
              </button>
            )}
          </div>
          <span className="bg-brand-gray px-4 py-2 rounded-full text-zinc-400 text-sm font-bold border border-white/5 whitespace-nowrap">
            {filteredSignals.length} Sinais
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {filteredSignals.length === 0 ? (
          <div className="glass-card p-12 text-center text-zinc-500">
            Nenhum sinal encontrado. Comece realizando um novo scan.
          </div>
        ) : (
          filteredSignals.map((signal) => {
            const isExpanded = expandedSignalIds.includes(signal.id);
            return (
              <div 
                key={signal.id} 
                className="glass-card flex flex-col group hover:border-white/20 transition-all cursor-pointer"
                onClick={() => toggleSignal(signal.id)}
              >
                <div className="p-4 flex flex-col md:flex-row md:items-center gap-6">
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
                      <motion.div 
                        key={signal.result}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, type: 'spring', bounce: 0.4 }}
                        className={cn(
                          "flex items-center justify-end gap-1 font-black italic uppercase text-sm",
                          signal.result === SignalResult.GAIN ? "text-green-500" : 
                          signal.result === SignalResult.LOSS ? "text-brand-red" : 
                          "text-zinc-500"
                        )}
                      >
                        {signal.result}
                      </motion.div>
                    </div>
                  </div>

                  <div className="h-px w-full md:h-12 md:w-px bg-white/5" />

                  <div className="flex md:flex-col justify-between items-center md:items-end gap-1 min-w-[80px]">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-zinc-500 font-black uppercase">Detalhes</span>
                    </div>
                    {isExpanded ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-white/5 bg-black/20 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-zinc-300">
                    <div className="space-y-4">
                      {signal.justification && (
                        <div>
                          <h4 className="text-[10px] text-zinc-500 font-black uppercase mb-1">Justificativa</h4>
                          <p className="italic">{signal.justification}</p>
                        </div>
                      )}
                      {signal.analiseGeral && (
                        <div>
                          <h4 className="text-[10px] text-zinc-500 font-black uppercase mb-1">Análise Geral</h4>
                          <p>{signal.analiseGeral}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      {signal.estrutura && (
                        <div>
                          <h4 className="text-[10px] text-zinc-500 font-black uppercase mb-1">Estrutura de Mercado</h4>
                          <p>{signal.estrutura}</p>
                        </div>
                      )}
                      {signal.tecnica && (
                        <div>
                          <h4 className="text-[10px] text-zinc-500 font-black uppercase mb-1">Análise Técnica</h4>
                          <p>{signal.tecnica}</p>
                        </div>
                      )}
                      {signal.fundamental && (
                        <div>
                          <h4 className="text-[10px] text-zinc-500 font-black uppercase mb-1">Análise Fundamental</h4>
                          <p>{signal.fundamental}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
