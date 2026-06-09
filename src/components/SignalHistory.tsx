import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Signal, SignalResult, SignalType } from '../types';
import { cn } from '../lib/utils';
import { Clock, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { fetchCurrentPrice, checkHistoricalSignalResult } from '../services/marketData';
import { TradingChart } from './TradingChart';
import { RiskCalculator } from './RiskCalculator';
import axios from 'axios';

export const SignalHistory: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [expandedSignalIds, setExpandedSignalIds] = useState<string[]>([]);
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<'score' | 'timestamp'>('score');

  useEffect(() => {
    const fetchPrices = async () => {
      const pendingSignals = signals.filter(s => s.result === SignalResult.PENDING);
      if (pendingSignals.length === 0) return;
      
      const pairs = Array.from(new Set<string>(pendingSignals.map(s => s.pair || '')));

      try {
        const promises = pairs.map(symbol => fetchCurrentPrice(symbol));
        const results = await Promise.all(promises);
        
        const newPrices: Record<string, number> = {};
        results.forEach((price, index) => {
          if (price !== null) {
            newPrices[pairs[index] as string] = price;
          }
        });
        setMarketPrices(prev => ({ ...prev, ...newPrices }));
      } catch (e) {
        console.error("Error fetching prices for history", e);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [signals]);

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

  useEffect(() => {
    const handleResolvedSignals = async () => {
      const pendingSignals = signals.filter(s => s.result === SignalResult.PENDING && s.id);
      if (pendingSignals.length === 0) return;

      for (const signal of pendingSignals) {
        let finalResult: string | null = null;
        
        // Check historical first
        const historicalResult = await checkHistoricalSignalResult(signal);
        if (historicalResult) {
           finalResult = historicalResult;
        } else {
           // Otherwise check live current market price
           const currentPrice = marketPrices[signal.pair];
           if (currentPrice) {
             const tp1Str = signal.takeProfit.replace(/[^0-9.]/g, '');
             const tp2Str = signal.takeProfit2 ? signal.takeProfit2.replace(/[^0-9.]/g, '') : null;
             const tp3Str = signal.takeProfit3 ? signal.takeProfit3.replace(/[^0-9.]/g, '') : null;
             const slStr = signal.stopLoss.replace(/[^0-9.]/g, '');
             
             const tp1 = parseFloat(tp1Str);
             const tp2 = tp2Str ? parseFloat(tp2Str) : null;
             const tp3 = tp3Str ? parseFloat(tp3Str) : null;
             const sl = parseFloat(slStr);
             
             if (!isNaN(tp1) && !isNaN(sl)) {
               if (signal.type === SignalType.BUY) {
                  if (tp3 && currentPrice >= tp3) finalResult = 'Take Profit 3';
                  else if (tp2 && currentPrice >= tp2) finalResult = 'Take Profit 2';
                  else if (currentPrice >= tp1) finalResult = 'Take Profit 1';
                  else if (currentPrice <= sl) finalResult = SignalResult.LOSS;
               } else if (signal.type === SignalType.SELL) {
                  if (tp3 && currentPrice <= tp3) finalResult = 'Take Profit 3';
                  else if (tp2 && currentPrice <= tp2) finalResult = 'Take Profit 2';
                  else if (currentPrice <= tp1) finalResult = 'Take Profit 1';
                  else if (currentPrice >= sl) finalResult = SignalResult.LOSS;
               }
             }
           }
        }

        if (finalResult && finalResult !== SignalResult.PENDING && finalResult !== 'Neutro') {
          // Update in Firebase
          try {
            await updateDoc(doc(db, 'signals', signal.id!), { result: finalResult });
          } catch (e: any) {
            // Ignore insufficient permissions as regular users might not have access to update global signals in demo/shared mode
            if (e && e.code !== 'permission-denied') {
               console.error("Failed to update closed signal", e);
            }
          }
        }
      }
    };

    if (Object.keys(marketPrices).length > 0) {
       handleResolvedSignals();
    }
  }, [signals, marketPrices]);

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

  const sortedSignals = [...filteredSignals].sort((a, b) => {
    if (sortBy === 'score') {
      return (b.score || 0) - (a.score || 0);
    }
    return b.timestamp - a.timestamp;
  });

  const toggleSignal = (id: string) => {
    setExpandedSignalIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getLiveSignalResult = (signal: Signal): string => {
    if (signal.result === SignalResult.GAIN) return 'Take Profit Atingido';
    if (signal.result === SignalResult.LOSS) return SignalResult.LOSS;
    if (signal.result === SignalResult.BE) return SignalResult.BE;
    // We also support custom string results like 'Take Profit 1', 'Take Profit 2' being saved as signal.result
    if (signal.result && signal.result !== SignalResult.PENDING) return signal.result;

    const currentPrice = marketPrices[signal.pair];
    if (!currentPrice) return 'Neutro';

    const tp1Str = signal.takeProfit.replace(/[^0-9.]/g, '');
    const tp2Str = signal.takeProfit2 ? signal.takeProfit2.replace(/[^0-9.]/g, '') : null;
    const tp3Str = signal.takeProfit3 ? signal.takeProfit3.replace(/[^0-9.]/g, '') : null;
    const slStr = signal.stopLoss.replace(/[^0-9.]/g, '');
    const entryStr = signal.entry.replace(/[^0-9.]/g, '');
    
    const tp1 = parseFloat(tp1Str);
    const tp2 = tp2Str ? parseFloat(tp2Str) : null;
    const tp3 = tp3Str ? parseFloat(tp3Str) : null;
    const sl = parseFloat(slStr);
    const entry = parseFloat(entryStr);

    if (isNaN(tp1) || isNaN(sl) || isNaN(entry)) return 'Neutro';

    if (signal.type === SignalType.BUY) {
      if (tp3 && currentPrice >= tp3) return 'Take Profit 3';
      if (tp2 && currentPrice >= tp2) return 'Take Profit 2';
      if (currentPrice >= tp1) return 'Take Profit 1';
      if (currentPrice <= sl) return SignalResult.LOSS;
      
      if (currentPrice > entry) {
         return 'Neutro';
      } else {
         return 'Ativo';
      }
    } else if (signal.type === SignalType.SELL) {
      if (tp3 && currentPrice <= tp3) return 'Take Profit 3';
      if (tp2 && currentPrice <= tp2) return 'Take Profit 2';
      if (currentPrice <= tp1) return 'Take Profit 1';
      if (currentPrice >= sl) return SignalResult.LOSS;
      
      if (currentPrice < entry) {
         return 'Neutro';
      } else {
         return 'Ativo';
      }
    }
    return 'Neutro';
  };

  const getDisplayPrice = (signal: Signal, status: string): string => {
    if (status === 'Neutro' || status === 'Ativo') {
      return marketPrices[signal.pair] ? marketPrices[signal.pair].toFixed(5) : "---";
    }
    if (status === 'Take Profit 1' || status === 'Take Profit Atingido' || status === SignalResult.GAIN) {
      return signal.takeProfit;
    }
    if (status === 'Take Profit 2' && signal.takeProfit2) {
      return signal.takeProfit2;
    }
    if (status === 'Take Profit 3' && signal.takeProfit3) {
      return signal.takeProfit3;
    }
    if (status === SignalResult.LOSS) {
      return signal.stopLoss;
    }
    return "Fechado";
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
            {sortedSignals.length} Sinais
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'score' | 'timestamp')}
            className="bg-brand-gray/50 text-sm text-zinc-300 outline-none px-3 py-2 rounded-lg border border-white/5 cursor-pointer hover:border-white/20 transition-all ml-2"
          >
            <option value="score">Maior Score</option>
            <option value="timestamp">Mais Recentes</option>
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {sortedSignals.length === 0 ? (
          <div className="glass-card p-12 text-center text-zinc-500">
            Nenhum sinal encontrado. Comece realizando um novo scan.
          </div>
        ) : (
          sortedSignals.map((signal) => {
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

                  <div className="grid grid-cols-2 lg:grid-cols-8 flex-1 gap-4 items-center">
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
                      <span className="text-[10px] text-zinc-500 font-black uppercase">Entrada</span>
                      <p className="font-bold text-white text-sm">{signal.entry}</p>
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
                      <span className="text-[10px] text-zinc-500 font-black uppercase">Status do Sinal</span>
                      <div className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                        getLiveSignalResult(signal) === 'Neutro' ? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20" : 
                        getLiveSignalResult(signal) === 'Ativo' ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                        getLiveSignalResult(signal).includes('Take Profit') || getLiveSignalResult(signal) === SignalResult.GAIN ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                        getLiveSignalResult(signal) === SignalResult.LOSS ? "bg-brand-red/10 text-brand-red border border-brand-red/20" :
                        getLiveSignalResult(signal) === SignalResult.BE ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" :
                        "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      )}>
                        {getLiveSignalResult(signal)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 font-black uppercase">
                         {['Neutro', 'Ativo'].includes(getLiveSignalResult(signal)) ? "Preço Atual" : "Fechamento"}
                      </span>
                      <motion.div 
                        key={marketPrices[signal.pair] || signal.result}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, type: 'spring', bounce: 0.4 }}
                        className="flex flex-col items-end"
                      >
                        <span className={cn(
                          "font-black text-sm",
                          getLiveSignalResult(signal).includes('Take Profit') || getLiveSignalResult(signal) === SignalResult.GAIN ? "text-green-500" :
                          getLiveSignalResult(signal) === SignalResult.LOSS ? "text-brand-red" :
                          getLiveSignalResult(signal) === 'Ativo' ? "text-blue-500" :
                          "text-zinc-400"
                        )}>
                           {getDisplayPrice(signal, getLiveSignalResult(signal))}
                        </span>
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
                  <div className="p-4 border-t border-white/5 bg-black/20 flex flex-col gap-6 text-sm text-zinc-300">
                    <div className="w-full">
                      <TradingChart signal={signal} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <RiskCalculator signal={signal} />
                        
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
                      
                      {(signal as any).multiTimeFrameAnalysis && (
                        <div>
                          <h4 className="text-[10px] text-blue-500 font-black uppercase mb-1">Multi Time Frame Analysis</h4>
                          <p>{(signal as any).multiTimeFrameAnalysis}</p>
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

                      {(signal as any).winrateLearning && (
                        <div>
                          <h4 className="text-[10px] text-purple-500 font-black uppercase mb-1">Winrate Learning AI</h4>
                          <p>{(signal as any).winrateLearning}</p>
                        </div>
                      )}

                      {(signal as any).trailingStop && (
                        <div>
                          <h4 className="text-[10px] text-orange-500 font-black uppercase mb-1">Trailing Stop AI</h4>
                          <p>{(signal as any).trailingStop}</p>
                        </div>
                      )}
                    </div>
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
