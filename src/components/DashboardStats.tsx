import React, { useEffect, useState } from 'react';
import { Signal, SignalResult, SignalType } from '../types';
import { motion } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  LineChart, Line, Legend
} from 'recharts';
import { TrendingUp, Award, Target, Activity, Flame, Calendar, Trophy, Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import axios from 'axios';

interface InstitutionalStats {
  balance: number;
  equity: number;
  profitFactor: number;
  expectancy: number;
  drawdown: number;
}

export const DashboardStats: React.FC<{ userData?: any }> = ({ userData }) => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPair, setSelectedPair] = useState<string>('');
  const [instStats, setInstStats] = useState<InstitutionalStats>({ balance: 0, equity: 0, profitFactor: 0, expectancy: 0, drawdown: 0 });

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'signals'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newSignals: Signal[] = [];
      snapshot.forEach((doc) => {
        newSignals.push({ id: doc.id, ...doc.data() } as Signal);
      });
      setSignals(newSignals);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'signals');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      if (userData?.derivApiToken && userData?.derivAppId) {
        try {
            const token = userData.derivApiToken;
            const appId = userData.derivAppId;
            const res = await axios.get(`/api/deriv/balance?appId=${appId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data?.balance) {
                setInstStats(prev => ({ 
                   ...prev, 
                   balance: res.data.balance.balance,
                   equity: res.data.balance.balance // simplifying equity as balance for now
                }));
            }
        } catch (e) {
            // ignore
        }
      }
    };
    fetchBalance();
  }, [userData]);

  useEffect(() => {
    if (!selectedPair && signals.length > 0) {
       const pairs = Array.from(new Set(signals.filter(s => s.pair).map(s => s.pair)));
       if (pairs.length > 0) {
         setSelectedPair(pairs[0]);
       }
    }
  }, [signals, selectedPair]);

  const totalSignals = signals.length;
  const gains = signals.filter(s => s.result === SignalResult.GAIN).length;
  const losses = signals.filter(s => s.result === SignalResult.LOSS).length;
  const completedSignals = gains + losses;
  
  const winRate = completedSignals > 0 ? (gains / completedSignals) * 100 : 0;
  const profitLossRatio = losses > 0 ? (gains / losses).toFixed(2) : (gains > 0 ? '∞' : '0');

  // Calculates Monthly Win Rate
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlySignals = signals.filter(s => {
    const d = new Date(s.timestamp);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && (s.result === SignalResult.GAIN || s.result === SignalResult.LOSS);
  });
  const monthlyGains = monthlySignals.filter(s => s.result === SignalResult.GAIN).length;
  const monthlyWinRate = monthlySignals.length > 0 ? (monthlyGains / monthlySignals.length) * 100 : 0;

  // Calculates Consecutive Win Streak
  let currentStreak = 0;
  let maxStreak = 0;
  const sortedByTime = [...signals].sort((a, b) => a.timestamp - b.timestamp);
  sortedByTime.forEach(s => {
     if (s.result === SignalResult.GAIN || s.result?.includes('Take Profit')) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
     } else if (s.result === SignalResult.LOSS) {
        currentStreak = 0;
     }
  });

  const pairStats = signals.reduce((acc: any[], signal) => {
    const existing = acc.find(i => i.name === signal.pair);
    if (existing) {
      existing.total += 1;
      if (signal.result === SignalResult.GAIN) existing.gains += 1;
    } else {
      acc.push({ name: signal.pair, total: 1, gains: signal.result === SignalResult.GAIN ? 1 : 0 });
    }
    return acc;
  }, []).map(p => ({ ...p, winRate: Math.round((p.gains / p.total) * 100) }));

  const bestAssetEntry = [...pairStats].sort((a,b) => b.winRate - a.winRate)[0];
  const bestAsset = bestAssetEntry ? `${bestAssetEntry.name} (${bestAssetEntry.winRate}%)` : 'N/A';

  const chartData = signals
    .sort((a, b) => a.timestamp - b.timestamp)
    .reduce((acc: any[], signal, index) => {
      const prevProfit = index > 0 ? acc[index - 1].profit : 0;
      // if signal has actual profit, use it, else approximate
      const change = signal.profit 
          ? signal.profit 
          : (signal.result === SignalResult.GAIN ? 50 : signal.result === SignalResult.LOSS ? -30 : 0);
      acc.push({
        name: new Date(signal.timestamp).toLocaleDateString(),
        profit: prevProfit + change
      });
      return acc;
    }, []);
    
  // Drawdown
  let peak = 0;
  let maxDrawdown = 0;
  chartData.forEach(d => {
      if (d.profit > peak) peak = d.profit;
      const dd = peak - d.profit;
      if (dd > maxDrawdown) maxDrawdown = dd;
  });
  
  // Profit Factor & Expectancy
  let grossProfit = 0;
  let grossLoss = 0;
  signals.forEach(s => {
      const p = s.profit ? s.profit : (s.result === SignalResult.GAIN ? 50 : s.result === SignalResult.LOSS ? -30 : 0);
      if (p > 0) grossProfit += p;
      else if (p < 0) grossLoss += Math.abs(p);
  });
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99 : 0);
  const expectancy = completedSignals > 0 ? ((grossProfit - grossLoss) / completedSignals) : 0;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const profitToday = signals.filter(s => s.timestamp >= today.getTime()).reduce((sum, s) => sum + (s.profit || (s.result === SignalResult.GAIN ? 50 : s.result === SignalResult.LOSS ? -30 : 0)), 0);
  const profitWeek = signals.filter(s => s.timestamp >= startOfWeek.getTime()).reduce((sum, s) => sum + (s.profit || (s.result === SignalResult.GAIN ? 50 : s.result === SignalResult.LOSS ? -30 : 0)), 0);
  const profitMonthObj = signals.filter(s => new Date(s.timestamp).getMonth() === today.getMonth() && new Date(s.timestamp).getFullYear() === today.getFullYear()).reduce((sum, s) => sum + (s.profit || (s.result === SignalResult.GAIN ? 50 : s.result === SignalResult.LOSS ? -30 : 0)), 0);

  const timeframeStats = signals.reduce((acc: any[], signal) => {
    const existing = acc.find(i => i.name === signal.timeframe);
    if (existing) {
      existing.count += 1;
      if (signal.result === SignalResult.GAIN) existing.gains += 1;
    } else {
      acc.push({ name: signal.timeframe, count: 1, gains: signal.result === SignalResult.GAIN ? 1 : 0 });
    }
    return acc;
  }, []).map((t: any) => ({ ...t, winRate: Math.round((t.gains / t.count) * 100) }));

  const bestTimeframeEntry = [...timeframeStats].sort((a,b) => b.winRate - a.winRate)[0];
  const bestTimeframe = bestTimeframeEntry ? `${bestTimeframeEntry.name} (${bestTimeframeEntry.winRate}%)` : 'N/A';

  const priceHistoryData = signals
    .filter(s => s.type !== SignalType.WAIT && parseFloat(s.entry) && parseFloat(s.takeProfit) && parseFloat(s.stopLoss) && s.pair === selectedPair)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(s => ({
      name: new Date(s.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      entry: parseFloat(s.entry.replace(/[^0-9.-]/g, '')),
      stopLoss: parseFloat(s.stopLoss.replace(/[^0-9.-]/g, '')),
      takeProfit: parseFloat(s.takeProfit.replace(/[^0-9.-]/g, '')),
    }));
    
  const availablePairs = Array.from(new Set(signals.filter(s => s.pair).map(s => s.pair)));

  if (loading) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-3 uppercase">
          <Wallet size={20} className="text-brand-red" />
          Dashboard Institucional
        </h1>
        <p className="text-zinc-500 mt-1 text-[10px] font-medium leading-none">Acompanhamento e transparência audível dos resultados do sistema.</p>
      </header>
      
      {/* Institutional Core Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-[#0a0000] border border-white/5 rounded-2xl p-5 shadow-[0_0_15px_rgba(255,0,0,0.05)] relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-brand-red/10 blur-3xl rounded-full" />
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-1">Saldo Total</p>
            <p className="text-2xl font-black text-white font-mono">${instStats.balance.toFixed(2)}</p>
        </div>
        <div className="bg-[#0a0000] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-1">Equity</p>
            <p className="text-2xl font-black text-white font-mono">${instStats.equity.toFixed(2)}</p>
        </div>
        <div className="bg-[#0a0000] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-1">Lucro Hoje</p>
            <p className={cn("text-2xl font-black font-mono", profitToday >= 0 ? "text-green-500" : "text-brand-red")}>
                {profitToday >= 0 ? '+' : ''}{profitToday.toFixed(2)}
            </p>
        </div>
        <div className="bg-[#0a0000] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-1">Lucro Semana</p>
            <p className={cn("text-2xl font-black font-mono", profitWeek >= 0 ? "text-green-500" : "text-brand-red")}>
                {profitWeek >= 0 ? '+' : ''}{profitWeek.toFixed(2)}
            </p>
        </div>
        <div className="bg-[#0a0000] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-1">Lucro Mês</p>
            <p className={cn("text-2xl font-black font-mono", profitMonthObj >= 0 ? "text-green-500" : "text-brand-red")}>
                {profitMonthObj >= 0 ? '+' : ''}{profitMonthObj.toFixed(2)}
            </p>
        </div>
      </div>

      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } }
        }}
        className="grid grid-cols-2 lg:grid-cols-6 gap-4"
      >
        {[
          { label: 'Total Sinais', value: totalSignals, icon: Activity },
          { label: 'Taxa de Acerto', value: `${winRate.toFixed(1)}%`, icon: Award },
          { label: 'Expectancy', value: `$${expectancy.toFixed(2)}`, icon: Calendar },
          { label: 'Drawdown Máx', value: `$${maxDrawdown.toFixed(2)}`, icon: ChevronDown },
          { label: 'Profit Factor', value: profitFactor.toFixed(2), icon: Target },
          { label: 'Melhor Ativo', value: bestAsset, icon: TrendingUp },
        ].map((stat, i) => (
          <motion.div 
            key={i} 
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
            className="glass-card p-5 hover:border-white/10 transition-colors"
          >
            <stat.icon className="text-brand-red mb-3" size={20} />
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">{stat.label}</p>
            <p className="text-2xl font-black mt-0.5 text-white truncate">{stat.value}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="glass-card p-5 min-h-[350px] flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-white/5 pb-4">
          <h3 className="font-black italic uppercase tracking-wider text-xs text-zinc-400">Histórico de Preços dos Sinais</h3>
          {availablePairs.length > 0 && (
            <select 
              value={selectedPair} 
              onChange={(e) => setSelectedPair(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-red"
            >
              {availablePairs.map(p => (
                 <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={priceHistoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#52525b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                minTickGap={20}
              />
              <YAxis 
                stroke="#52525b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="entry" stroke="#3b82f6" name="Entry" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="takeProfit" stroke="#22c55e" name="Take Profit" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="stopLoss" stroke="#ef4444" name="Stop Loss" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-card p-5 min-h-[350px] flex flex-col">
          <h3 className="font-black italic uppercase tracking-wider text-xs mb-6 text-zinc-400">Gráfico de Lucro/Perda Acumulada</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff0000" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ff0000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  minTickGap={20}
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => `${val}p`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#ff0000" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorProfit)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5 flex flex-col">
          <h3 className="font-black italic uppercase tracking-wider text-xs mb-6 text-zinc-400">Volume por Timeframe</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeframeStats}>
                <XAxis 
                  dataKey="name" 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {timeframeStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#ff0000' : index === 1 ? '#a1a1aa' : '#3f3f46'} />
                  ))}
                </Bar>
                <Tooltip 
                   cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                   contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-5">
           <h3 className="font-black italic uppercase tracking-wider text-xs mb-6 text-zinc-400 border-b border-white/5 pb-4">Performance por Ativo</h3>
           <div className="space-y-4">
             {pairStats.sort((a,b) => b.winRate - a.winRate).map((pair, idx) => (
               <div key={idx} className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-xs font-bold text-white">
                     {pair.name.substring(0,3)}
                   </div>
                   <div>
                     <p className="text-sm font-bold text-white">{pair.name}</p>
                     <p className="text-[10px] uppercase text-zinc-500 font-black tracking-widest">{pair.total} Sinais</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <p className="text-sm font-black text-white">{pair.winRate}%</p>
                   <div className="w-24 h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                     <div className="h-full bg-brand-red rounded-full" style={{ width: `${pair.winRate}%` }} />
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
        <div className="glass-card p-5">
           <h3 className="font-black italic uppercase tracking-wider text-xs mb-6 text-zinc-400 border-b border-white/5 pb-4">Padrões PRO Logic Mais Eficientes</h3>
           <div className="space-y-4">
             {[
               { name: "Order Block Mitigado", rate: 94 },
               { name: "Liquidity Sweep", rate: 88 },
               { name: "Fair Value Gap (FVG)", rate: 82 },
               { name: "ChoCh Completo", rate: 76 }
             ].map((logic, idx) => (
               <div key={idx} className="flex items-center justify-between">
                 <p className="text-sm font-bold text-zinc-300">{logic.name}</p>
                 <div className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-black tracking-widest uppercase">
                   {logic.rate}% Win
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

