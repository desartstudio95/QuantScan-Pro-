import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Bot, Power, Activity, Settings2, Link, Zap, Shield, 
  BarChart2, TrendingUp, DollarSign, Send, Globe2, AlertTriangle, 
  Fingerprint, ChevronRight, Server, Cpu, Radio, Network, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { DerivDiagnosticPanel } from './DerivDiagnosticPanel';
import { DerivTestPanel } from './DerivTestPanel';
import { AITradingDashboard } from './AITradingDashboard';
import { cn } from '../lib/utils';

export const AutoTradingView: React.FC<{ userData?: any, onUpdate?: (data: any) => void, onNavigate?: (tab: string) => void, isAdmin?: boolean }> = ({ userData, onUpdate, onNavigate, isAdmin }) => {
  const [robotActive, setRobotActive] = useState(userData?.tradingSettings?.engineRunning ?? false);
  const [mtPlatform, setMtPlatform] = useState(userData?.mtPlatform || 'mt5');
  const [mtLogin, setMtLogin] = useState(userData?.mtLogin || '');
  const [mtPassword, setMtPassword] = useState(
    userData?.mtPlatform === 'deriv_api' ? (userData?.mtPassword || userData?.savedDerivToken || '') : (userData?.mtPassword || '')
  );
  const [mtServer, setMtServer] = useState(userData?.mtServer || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{message: string, isError: boolean} | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [autoTrades, setAutoTrades] = useState<any[]>([]);

  React.useEffect(() => {
    let unsubscribe = () => {};
    if (userData?.uid) {
        (async () => {
            const { collection, query, orderBy, limit, onSnapshot } = await import('firebase/firestore');
            const { db } = await import('../lib/firebase');
            const q = query(
                collection(db, "users", userData.uid, "auto_trades"),
                orderBy("timestamp", "desc"),
                limit(10)
            );
            unsubscribe = onSnapshot(q, (snap) => {
                const trades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setAutoTrades(trades);
            }, (error) => {
                console.warn("Notice: Firestore rules not updated for auto_trades yet.", error.message);
            });
        })();
    }
    return () => unsubscribe();
  }, [userData?.uid]);

  // Bot Settings State
  const [tradingSettings, setTradingSettings] = useState([
    { key: 'smartEntry', label: "Smart Entry AI", desc: "Usa rede neural para entradas precisas", active: userData?.tradingSettings?.smartEntry ?? true },
    { key: 'copyTrades', label: "Copy Institutional Trades", desc: "Copia movimentos de Baleias e Bancos", active: userData?.tradingSettings?.copyTrades ?? true },
    { key: 'newsFilter', label: "News Filter (Alta Volatilidade)", desc: "Pausa o robô durante notícias vermelhas", active: userData?.tradingSettings?.newsFilter ?? false },
    { key: 'autoTp', label: "Auto Take Profit (Dinâmico)", desc: "Ajusta alvo baseado em liquidez", active: userData?.tradingSettings?.autoTp ?? true },
    { key: 'autoSl', label: "Auto Stop Loss (Trailing)", desc: "Acompanha o preço para garantir lucro", active: userData?.tradingSettings?.autoSl ?? true },
  ]);
  const [riskPerTrade, setRiskPerTrade] = useState(userData?.tradingSettings?.riskPerTrade?.toString() || "1.5");
  const [maxPositions, setMaxPositions] = useState(userData?.tradingSettings?.maxPositions?.toString() || "3");
  const [selectedAsset, setSelectedAsset] = useState(userData?.tradingSettings?.selectedAsset || 'XAU/USD');
  const [symbolSuffix, setSymbolSuffix] = useState(userData?.tradingSettings?.symbolSuffix || '');
  
  const [lotType, setLotType] = useState(userData?.tradingSettings?.lotType || 'risk');
  const [fixedLot, setFixedLot] = useState(userData?.tradingSettings?.fixedLot?.toString() || "0.01");
  const [breakEvenEnabled, setBreakEvenEnabled] = useState(userData?.tradingSettings?.breakEvenEnabled ?? true);
  const [tradingHoursStart, setTradingHoursStart] = useState(userData?.tradingSettings?.tradingHoursStart || "00:00");
  const [tradingHoursEnd, setTradingHoursEnd] = useState(userData?.tradingSettings?.tradingHoursEnd || "23:59");
  const [minConfidence, setMinConfidence] = useState(userData?.tradingSettings?.minConfidence?.toString() || "80");
  const [dailyLossLimit, setDailyLossLimit] = useState(userData?.tradingSettings?.dailyLossLimit?.toString() || "100");
  const [dailyProfitTarget, setDailyProfitTarget] = useState(userData?.tradingSettings?.dailyProfitTarget?.toString() || "200");
  const [cooldownMinutes, setCooldownMinutes] = useState(userData?.tradingSettings?.cooldownMinutes?.toString() || "5");

  const saveSettingsToFirebase = async (
    newSettings: any[], 
    newRisk: string, 
    newMax: string, 
    newAsset?: string, 
    newSuffix?: string, 
    newRobotActive?: boolean,
    newLotType?: string,
    newFixedLot?: string,
    newBeEnabled?: boolean,
    newHoursStart?: string,
    newHoursEnd?: string
  ) => {
    if (!userData?.uid) return;
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    const userRef = doc(db, 'users', userData.uid);
    
    const assetToSave = newAsset ?? selectedAsset;
    const suffixToSave = newSuffix ?? symbolSuffix;
    const engineToSave = newRobotActive ?? robotActive;
    
    const updatedSettingsObj = {
      smartEntry: newSettings[0].active,
      copyTrades: newSettings[1].active,
      newsFilter: newSettings[2].active,
      autoTp: newSettings[3].active,
      autoSl: newSettings[4].active, // used as Trailing Stop toggle
      riskPerTrade: parseFloat(newRisk) || 1.5,
      maxPositions: parseInt(newMax) || 3,
      selectedAsset: assetToSave,
      symbolSuffix: suffixToSave,
      engineRunning: engineToSave,
      lotType: newLotType ?? lotType,
      fixedLot: parseFloat(newFixedLot ?? fixedLot) || 0.01,
      breakEvenEnabled: newBeEnabled ?? breakEvenEnabled,
      tradingHoursStart: newHoursStart ?? tradingHoursStart,
      tradingHoursEnd: newHoursEnd ?? tradingHoursEnd,
      minConfidence: parseFloat(minConfidence) || 80,
      dailyLossLimit: parseFloat(dailyLossLimit) || 100,
      dailyProfitTarget: parseFloat(dailyProfitTarget) || 200,
      cooldownMinutes: parseInt(cooldownMinutes) || 5
    };

    try {
      await updateDoc(userRef, { tradingSettings: updatedSettingsObj });
      if (onUpdate) {
        onUpdate({ ...userData, tradingSettings: updatedSettingsObj });
      }
    } catch (e) {
      console.error("Error saving settings:", e);
    }
  };

  const handleToggleSetting = (index: number) => {
    const newSettings = [...tradingSettings];
    newSettings[index].active = !newSettings[index].active;
    setTradingSettings(newSettings);
    saveSettingsToFirebase(newSettings, riskPerTrade, maxPositions);
  };

  const handleRiskBlur = () => {
    saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions);
  };

  const handleFixedLotBlur = () => {
    saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions);
  };

  const handleMaxBlur = () => {
    saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions);
  };

  const handleAssetBlur = () => {
    saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions);
  };

  const handleSuffixBlur = () => {
    saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions);
  };

  const handleHoursBlur = () => {
    saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions);
  };

  const handleDisconnectBroker = async () => {
    if (!userData?.uid) return;
    setIsSaving(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, {
        mtPlatform: '',
        mtLogin: '',
        mtPassword: '',
        mtServer: '',
        metaApiAccountId: null,
        metaApiState: null,
        derivName: null,
        derivEmail: null,
        derivCurrency: null,
        derivAccountList: null,
        derivMt5AccountList: null
      });

      if (onUpdate) {
        onUpdate({ ...userData, mtPlatform: '', mtLogin: '', mtPassword: '', mtServer: '', metaApiAccountId: null, metaApiState: null, derivName: null, derivEmail: null, derivCurrency: null, derivAccountList: null, derivMt5AccountList: null });
      }
      if (userData?.mtPlatform === 'deriv_api') {
        setMtPlatform('deriv_api');
        setMtLogin('');
        setMtPassword(userData.savedDerivToken || userData.mtPassword || '');
        setMtServer('');
      } else {
        setMtPlatform('mt5');
        setMtLogin('');
        setMtPassword('');
        setMtServer('');
      }
    } catch (e: any) {
      console.error("Error disconnecting broker:", e);
      alert(e.message || "Failed to disconnect");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectBroker = async () => {
    if (!userData?.uid) return;
    setIsSaving(true);
    try {
      let extAccountId = null;
      let extState = null;
      let finalLogin = mtLogin;
      let finalServer = mtServer;
      let derivData: any = null;

      if (mtPlatform === 'deriv_api') {
        const cleanToken = mtPassword.trim();
        if (!/^[\w\-]{1,128}$/.test(cleanToken)) {
           throw new Error("Token Deriv inválido. Verifique se copiou corretamente (sem espaços ou caracteres especiais).");
        }
        const res = await fetch('/api/deriv/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: cleanToken })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to connect to Deriv API');
        
        const derivAccount = data.account;
        finalLogin = derivAccount.loginid;
        finalServer = 'Deriv ' + derivAccount.landing_company_name?.toUpperCase();
        extState = 'DEPLOYED';
        derivData = {
           derivName: derivAccount.fullname,
           derivEmail: derivAccount.email,
           derivCurrency: derivAccount.currency,
           derivAccountList: derivAccount.account_list,
           derivMt5AccountList: data.mt5_login_list || []
        };
      } else {
        // First try to provision through our backend proxy for MT4/MT5
        const res = await fetch('/api/metaapi/provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: mtPlatform,
            login: mtLogin,
            password: mtPassword,
            serverName: mtServer
          })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to connect to MetaAPI');
        }
        extAccountId = data.accountId;
        extState = data.state;
      }

      // Save to Firebase
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const userRef = doc(db, 'users', userData.uid);
      
      const payload: any = {
        mtPlatform,
        mtLogin: finalLogin,
        mtPassword,
        mtServer: finalServer,
        metaApiAccountId: extAccountId,
        metaApiState: extState
      };
      if (mtPlatform === 'deriv_api') {
        payload.savedDerivToken = mtPassword;
      }
      if (derivData) {
        Object.assign(payload, derivData);
      }
      await updateDoc(userRef, payload);

      if (onUpdate) {
        onUpdate({ ...userData, ...payload });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      console.error("Error saving Broker config:", e);
      alert(e.message || "Failed to connect to Terminal");
    } finally {
      setIsSaving(false);
    }
  };

  const marketData = [
    { pair: 'EUR/USD', signal: 'BUY', score: 98, momentum: 'High', liquidity: 'Optimal', trend: 'Bullish' },
    { pair: 'GBP/USD', signal: 'SELL', score: 92, momentum: 'Medium', liquidity: 'High', trend: 'Bearish' },
    { pair: 'XAU/USD', signal: 'BUY', score: 99, momentum: 'Extreme', liquidity: 'Optimal', trend: 'Bullish' },
    { pair: 'BTC/USD', signal: 'SELL', score: 85, momentum: 'Low', liquidity: 'Medium', trend: 'Ranging' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER PRINCIPAL - CYBERPUNK / HIGH-TECH */}
      <div className="flex flex-col justify-between relative p-8 min-h-[450px] rounded-3xl bg-black/80 border border-brand-red/50 shadow-[0_0_50px_rgba(255,0,0,0.2)] overflow-hidden group">
        {/* TECH BACKGROUND */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-red/10 via-[#0a0000] to-black opacity-80 pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none z-0" />
        
        {/* GLOWING GRID */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,0,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_20%,transparent_100%)] pointer-events-none" />
        
        <img src="https://i.ibb.co/VcJRM0zZ/90a0c129-b771-41d6-ad30-634d1d2546c4.png" alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen pointer-events-none group-hover:scale-105 transition-transform duration-[10s] ease-out" />
        
        <div className="relative z-10 flex justify-between items-start">
           <div className="space-y-2">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-red/10 border border-brand-red/20 mb-2 backdrop-blur-md">
               <div className="w-2 h-2 rounded-full bg-brand-red animate-pulse shadow-[0_0_10px_rgba(255,0,0,1)]" />
               <span className="text-[9px] font-mono font-bold text-brand-red uppercase tracking-widest">Neural Link v4.2 Active</span>
             </div>
             <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,0,0,0.8)] flex flex-col gap-1">
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-red to-white">QUANTSCAN IA</span>
               <span className="text-lg md:text-xl font-mono text-zinc-400 tracking-[0.3em] font-light not-italic">AUTOTRADING SYNAPSE</span>
             </h1>
           </div>
           
           {/* METRICS HEADER */}
           <div className="hidden md:flex gap-6 bg-black/60 p-4 border border-brand-red/20 rounded-2xl backdrop-blur-xl">
             <div className="text-right">
               <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center justify-end gap-1"><Cpu size={10} className="text-brand-red"/> Core Load</div>
               <div className="text-lg font-mono font-black text-white">{(Math.random() * 20 + 10).toFixed(1)}%</div>
             </div>
             <div className="w-px bg-white/10" />
             <div className="text-right">
               <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center justify-end gap-1"><Network size={10} className="text-brand-red"/> Latency</div>
               <div className="text-lg font-mono font-black text-white">{Math.floor(Math.random() * 20 + 5)}ms</div>
             </div>
           </div>
        </div>
        
        <div className="flex items-center gap-4 relative z-10 mt-auto pt-10">
           <div className="flex items-center gap-4">
             <div className="relative">
               <div className={cn("absolute inset-0 blur-xl opacity-50 transition-colors duration-1000", robotActive ? "bg-brand-red" : "bg-zinc-600")} />
               <div className={cn(
                 "relative px-6 py-3 rounded-xl border flex items-center gap-3 backdrop-blur-md transition-all duration-700",
                 robotActive ? "bg-brand-red/20 border-brand-red text-brand-red shadow-[0_0_30px_rgba(255,0,0,0.3)]" : "bg-black/60 border-zinc-800 text-zinc-600"
               )}>
                 <Radio size={20} className={cn("transition-transform duration-1000", robotActive && "animate-pulse")} />
                 <div className="flex flex-col">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 transition-colors">Engine Status</span>
                   <span className="text-xl font-black uppercase tracking-widest">{robotActive ? "ONLINE" : "OFFLINE"}</span>
                 </div>
               </div>
             </div>
           </div>
        </div>
      </div>

      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: STATUS & BUTTONS */}
        <div className="lg:col-span-1 space-y-6">
          
          {userData?.mtPlatform === 'deriv_api' && (
             <>
               <AITradingDashboard userData={userData} engineRunning={robotActive} />
               <DerivDiagnosticPanel userData={userData} />
               <DerivTestPanel userData={userData} />
             </>
          )}

          {/* MAIN BUTTONS */}
          <div className="space-y-3 bg-black/40 border border-white/10 p-4 rounded-2xl">
             <button 
               onClick={() => {
                 const newValue = !robotActive;
                 setRobotActive(newValue);
                 saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions, selectedAsset, symbolSuffix, newValue);
               }}
               className={cn(
               "relative w-full py-4 rounded-xl font-black italic uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 overflow-hidden group",
               robotActive 
                 ? "bg-black text-brand-red border border-brand-red/50 shadow-[0_0_20px_rgba(255,0,0,0.3)] hover:scale-[0.98]" 
                 : "bg-[#111] text-white border border-brand-red/40 shadow-[0_0_30px_rgba(255,0,0,0.15)] hover:border-brand-red hover:shadow-[0_0_40px_rgba(255,0,0,0.3)] hover:bg-[#1a0505] hover:scale-[1.02]"
             )}>
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-red/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
               <div className="absolute top-0 right-0 w-8 h-[2px] bg-brand-red shadow-[0_0_10px_rgba(255,0,0,1)]" />
               <div className="absolute bottom-0 left-0 w-8 h-[2px] bg-brand-red shadow-[0_0_10px_rgba(255,0,0,1)]" />
               <Power size={20} className={cn("relative z-10 transition-transform duration-300", !robotActive && "text-brand-red animate-pulse group-hover:scale-110")} />
               <span className="relative z-10 tracking-[0.2em]">{robotActive ? "Halt System" : "Initialize Engine"}</span>
             </button>
          </div>

          <button 
            type="button"
            disabled={isTesting}
            onClick={async (e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsTesting(true);
              setTestResult(null);
              try {
                const res = await fetch('/api/admin/test-auto-trading', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ 
                    uid: userData?.uid, 
                    pair: selectedAsset, 
                    decision: 'BUY', 
                    price: 100,
                    metaApiAccountId: userData?.metaApiAccountId,
                    mtPlatform: userData?.mtPlatform,
                    mtLogin: userData?.mtLogin,
                    mtPassword: userData?.mtPassword,
                    settings: {
                       engineRunning: robotActive,
                       symbolSuffix: symbolSuffix,
                       riskPerTrade: parseFloat(riskPerTrade || "1.0")
                    }
                  })
                });
                const result = await res.json();
                if (result.success) {
                   setTestResult({ message: "Teste Executado com Sucesso! " + JSON.stringify(result.tradeResult), isError: false });
                } else {
                   setTestResult({ message: "Erro no teste: " + result.error, isError: true });
                }
              } catch (err: any) {
                setTestResult({ message: "System error: " + err.message, isError: true });
              } finally {
                setIsTesting(false);
              }
            }}
            className={cn("w-full bg-brand-red text-white font-mono text-xl font-bold py-6 rounded-xl hover:bg-brand-red/80 transition-colors relative z-50 pointer-events-auto cursor-pointer border border-brand-red shadow-[0_0_20px_rgba(255,0,0,0.5)]", isTesting && "opacity-50 cursor-not-allowed")}
            title="Apenas testa se o bot consegue ligar com a corretora e se a paridade existe."
          >
            {isTesting ? "TESTING CONNECTION..." : "RUN CONNECTION TEST NOW"}
          </button>
          
          {testResult && (
             <div className={cn("p-4 rounded-xl text-sm font-mono break-words border", testResult.isError ? "bg-red-500/10 text-red-500 border-red-500/30" : "bg-green-500/10 text-green-500 border-green-500/30")}>
                {testResult.message}
             </div>
          )}

          <div className="space-y-3 bg-black/60 border border-brand-red/10 p-4 rounded-3xl backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
             <div className="space-y-4 bg-[#0a0000] border border-brand-red/20 p-5 rounded-2xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-brand-red/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
               <div className="absolute top-0 right-0 p-4 opacity-5 transform group-hover:scale-110 transition-transform duration-700">
                 <Cpu size={120} className="text-brand-red" />
               </div>
               <h3 className="font-black italic uppercase text-white tracking-widest text-sm flex items-center gap-2 relative z-10 pb-3 border-b border-white/5">
                 <Bot size={16} className="text-brand-red shadow-brand-red/50 drop-shadow-md" /> ACTIVE SUBSYSTEMS
               </h3>
               
               <div className="space-y-3 relative z-10 pt-2">
                  <div className="bg-black/80 border border-brand-red/10 rounded-xl p-3 flex items-center justify-between overflow-hidden relative transition-all duration-300 hover:border-brand-red/30 hover:bg-black">
                    <div className="absolute top-0 left-0 w-1 h-full bg-brand-red shadow-[0_0_10px_rgba(255,0,0,0.8)]" />
                    <div className="pl-3">
                      <div className="text-xs font-black text-white uppercase flex items-center gap-2 tracking-wider">QuantScan IA <span className="bg-brand-red/20 text-brand-red border border-brand-red/30 text-[8px] px-2 py-0.5 rounded-sm font-mono animate-pulse">PRO</span></div>
                      <div className="text-[9px] text-zinc-500 mt-1 font-mono tracking-widest uppercase">Institutional HFR</div>
                    </div>
                    <div className="relative">
                       <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(0,255,0,1)] animate-ping absolute" />
                       <div className="w-2 h-2 rounded-full bg-green-400 relative" />
                    </div>
                  </div>
               </div>
             </div>

             <button 
               onClick={() => document.getElementById("broker-connection")?.scrollIntoView({ behavior: "smooth" })}
               className="w-full py-3 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors">
               <Link size={16} /> Connect Broker
             </button>

             <button 
               onClick={() => onNavigate && onNavigate('history')}
               className="w-full py-3 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors">
               <BarChart2 size={16} /> View Signals
             </button>

             <button 
               onClick={() => onNavigate && onNavigate('scan')}
               className="w-full py-3 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors">
               <Zap size={16} /> Auto Scanner
             </button>

             {isAdmin && (
               <button 
                 onClick={() => onNavigate && onNavigate('admin')}
                 className="w-full py-3 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 bg-[#0088cc]/20 hover:bg-[#0088cc]/30 text-[#0088cc] border border-[#0088cc]/30 transition-colors">
                 <Send size={16} /> Telegram Alerts
               </button>
             )}
          </div>
        </div>

        {/* MIDDLE COLUMN: SETTINGS */}
        <div className="lg:col-span-1 space-y-6">
           <div className="relative bg-[#050000] border border-brand-red/20 p-6 rounded-3xl h-full shadow-[0_4px_30px_rgba(255,0,0,0.05)] overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-red/50 to-transparent opacity-50" />
              <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-brand-red/5 filter blur-[100px]" />
              <h3 className="font-black italic uppercase text-white tracking-widest text-sm mb-6 flex items-center gap-2 border-b border-brand-red/10 pb-4 relative z-10 w-full shadow-[0_10px_20px_-10px_rgba(255,0,0,0.1)]">
                <Settings2 size={16} className="text-brand-red animate-[spin_5s_linear_infinite]" /> PARAMETERS & PROTOCOLS
              </h3>
              
              <div className="space-y-6">
                {tradingSettings.map((setting, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">{setting.label}</span>
                      <span className="text-[9px] text-zinc-500 mt-0.5">{setting.desc}</span>
                    </div>
                    <button 
                      onClick={() => handleToggleSetting(i)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none",
                        setting.active ? "bg-brand-red" : "bg-zinc-800"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                          setting.active ? "translate-x-5" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                ))}

                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ativo a Negociar</label>
                    <div className="relative">
                      <select 
                        value={selectedAsset}
                        onChange={(e) => {
                          setSelectedAsset(e.target.value);
                          saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions, e.target.value, symbolSuffix);
                        }}
                        className="w-full bg-black border border-white/10 rounded-lg p-3 pr-8 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors appearance-none"
                      >
                        {userData?.mtPlatform === 'deriv_api' || (userData?.mtServer && userData?.mtServer.toLowerCase().includes('deriv')) ? (
                           <>
                              <option value="Boom 1000 Index">Boom 1000 Index (Deriv)</option>
                              <option value="Crash 1000 Index">Crash 1000 Index (Deriv)</option>
                              <option value="Boom 500 Index">Boom 500 Index (Deriv)</option>
                              <option value="Crash 500 Index">Crash 500 Index (Deriv)</option>
                              <option value="Volatility 75 Index">Volatility 75 Index (Deriv)</option>
                              <option value="EUR/USD">EUR/USD</option>
                              <option value="GBP/USD">GBP/USD</option>
                              <option value="XAU/USD">XAU/USD</option>
                              <option value="USD/JPY">USD/JPY</option>
                           </>
                        ) : (
                           <>
                              <option value="EUR/USD">EUR/USD</option>
                              <option value="GBP/USD">GBP/USD</option>
                              <option value="XAU/USD">XAU/USD (Gold)</option>
                              <option value="USD/JPY">USD/JPY</option>
                           </>
                        )}
                      </select>
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none rotate-90" size={14} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sufixo da Corretora (MT4/5)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: .m, .std"
                      value={symbolSuffix}
                      onChange={(e) => setSymbolSuffix(e.target.value)}
                      onBlur={handleSuffixBlur}
                      className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Risk per Trade (%)</label>
                    <input 
                      type="number" 
                      value={riskPerTrade}
                      onChange={(e) => setRiskPerTrade(e.target.value)}
                      onBlur={handleRiskBlur}
                      step="0.1"
                      className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Max Open Positions</label>
                    <input 
                      type="number" 
                      value={maxPositions}
                      onChange={(e) => setMaxPositions(e.target.value)}
                      onBlur={handleMaxBlur}
                      className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                    />
                  </div>
                </div>

                {/* ADVANCED SETTINGS ROW */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tipo de Lote</label>
                    <div className="flex bg-black border border-white/10 rounded-lg p-1">
                      <button 
                        onClick={() => {
                          setLotType('risk');
                          saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions, undefined, undefined, undefined, 'risk', fixedLot);
                        }}
                        className={cn("flex-1 text-xs py-2 rounded-md transition-colors", lotType === 'risk' ? "bg-white/10 text-white font-bold" : "text-zinc-500")}
                      >
                        Risk %
                      </button>
                      <button 
                         onClick={() => {
                          setLotType('fixed');
                          saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions, undefined, undefined, undefined, 'fixed', fixedLot);
                        }}
                        className={cn("flex-1 text-xs py-2 rounded-md transition-colors", lotType === 'fixed' ? "bg-white/10 text-white font-bold" : "text-zinc-500")}
                      >
                        Fixo
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      {lotType === 'risk' ? 'Risco por Trade (%)' : 'Lote Fixo'}
                    </label>
                    {lotType === 'risk' ? (
                       <input 
                         type="number" 
                         value={riskPerTrade}
                         onChange={(e) => setRiskPerTrade(e.target.value)}
                         onBlur={handleRiskBlur}
                         step="0.1"
                         className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                       />
                    ) : (
                       <input 
                         type="number" 
                         value={fixedLot}
                         onChange={(e) => setFixedLot(e.target.value)}
                         onBlur={handleFixedLotBlur}
                         step="0.01"
                         className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                       />
                    )}
                  </div>
                </div>

                {/* BREAK EVEN & TIMES */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="space-y-1 flex flex-col justify-center">
                     <div>
                       <label className="text-sm font-bold text-white block">Break Even</label>
                       <span className="text-[10px] text-zinc-500 mb-1 block">Mover Stop pro ponto de entrada</span>
                     </div>
                     <button
                        onClick={() => {
                          const newState = !breakEvenEnabled;
                          setBreakEvenEnabled(newState);
                          saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions, undefined, undefined, undefined, lotType, fixedLot, newState);
                        }}
                        className={cn("w-10 h-6 rounded-full transition-colors relative", breakEvenEnabled ? "bg-brand-red" : "bg-white/10")}
                      >
                        <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 transition-all", breakEvenEnabled ? "right-1" : "left-1")} />
                      </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Início (UTC)</label>
                        <input 
                          type="time" 
                          value={tradingHoursStart}
                          onChange={(e) => setTradingHoursStart(e.target.value)}
                          onBlur={handleHoursBlur}
                          className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Fim (UTC)</label>
                        <input 
                          type="time" 
                          value={tradingHoursEnd}
                          onChange={(e) => setTradingHoursEnd(e.target.value)}
                          onBlur={handleHoursBlur}
                          className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* RISK MANAGEMENT PANEL */}
                <h3 className="font-black italic uppercase text-white tracking-widest text-sm mb-6 flex items-center gap-2 border-b border-brand-red/10 pb-4 mt-8 pt-4 border-t relative z-10 w-full shadow-[0_10px_20px_-10px_rgba(255,0,0,0.1)]">
                  <Shield size={16} className="text-brand-red" /> RISK MANAGEMENT
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Min Confidence (%)</label>
                    <input 
                      type="number" 
                      value={minConfidence}
                      onChange={(e) => setMinConfidence(e.target.value)}
                      onBlur={() => saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions)}
                      className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cooldown (mins)</label>
                    <input 
                      type="number" 
                      value={cooldownMinutes}
                      onChange={(e) => setCooldownMinutes(e.target.value)}
                      onBlur={() => saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions)}
                      className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-red-500 uppercase tracking-widest">Daily Loss Limit ($)</label>
                    <input 
                      type="number" 
                      value={dailyLossLimit}
                      onChange={(e) => setDailyLossLimit(e.target.value)}
                      onBlur={() => saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions)}
                      className="w-full bg-black border border-red-500/30 rounded-lg p-3 text-sm text-red-400 font-mono focus:border-red-500 outline-none transition-colors" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-green-500 uppercase tracking-widest">Daily Profit Target ($)</label>
                    <input 
                      type="number" 
                      value={dailyProfitTarget}
                      onChange={(e) => setDailyProfitTarget(e.target.value)}
                      onBlur={() => saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions)}
                      className="w-full bg-black border border-green-500/30 rounded-lg p-3 text-sm text-green-400 font-mono focus:border-green-500 outline-none transition-colors" 
                    />
                  </div>
                </div>
              </div>
           </div>
        </div>

        {/* RIGHT COLUMN: BROKERS & LIVE MARKET */}
        <div className="lg:col-span-2 space-y-6">
           
           {/* BROKER INTEGRATION (MT4/MT5) */}
           <div id="broker-connection" className="relative bg-[#050000] border border-brand-red/20 p-6 rounded-3xl h-full shadow-[0_4px_30px_rgba(255,0,0,0.05)] overflow-hidden">
             {/* HOLOGRAPHIC SCAN LINES */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,0,0)_50%,rgba(255,0,0,0.02)_50%)] bg-[size:100%_4px] pointer-events-none z-0" />
             <div className="absolute top-0 right-0 w-32 h-1 bg-gradient-to-l from-brand-red to-transparent opacity-80" />
             <h3 className="font-black italic uppercase text-white tracking-widest text-sm mb-6 flex items-center gap-2 relative z-10 border-b border-brand-red/10 pb-4">
               <div className="w-8 h-8 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center">
                 <Globe2 size={14} className="text-brand-red" />
               </div>
               EXTERNAL UPLINK (BROKER)
             </h3>
            <div className="space-y-4">
               {userData?.mtPlatform === 'deriv_api' && userData?.mtLogin ? (
                 <div className="bg-[#ff444f]/10 border border-[#ff444f]/30 rounded-xl p-6 text-center space-y-4">
                   <div className="w-16 h-16 bg-[#ff444f]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                     <ShieldCheck size={32} className="text-[#ff444f]" />
                   </div>
                   <h4 className="text-[#ff444f] font-bold uppercase tracking-widest text-lg">Deriv API Connected</h4>
                   <p className="text-sm text-zinc-400">Titular: <span className="text-white font-mono">{userData.derivName || "Desconhecido"}</span></p>
                   <p className="text-sm text-zinc-400">Padrão: <span className="text-white font-mono">{userData.mtLogin}</span></p>
                   <p className="text-sm text-zinc-400">Servidor: <span className="text-white font-mono">{userData.mtServer}</span></p>

                   {userData.derivAccountList && userData.derivAccountList.length > 0 && (
                     <div className="mt-4 w-full text-left bg-black/40 p-4 rounded-xl border border-white/5">
                       <label className="text-[10px] font-black text-white uppercase tracking-widest block mb-2 flex items-center gap-2"><Globe2 size={12} className="text-[#ff444f]" /> Contas Nativas (API Token)</label>
                       <div className="relative">
                         <select 
                           value={userData.mtLogin}
                           onChange={async (e) => {
                               const newLogin = e.target.value;
                               const newAcc = userData.derivAccountList.find((a: any) => a.loginid === newLogin);
                               
                               const { doc, updateDoc } = await import('firebase/firestore');
                               const { db } = await import('../lib/firebase');
                               const userRef = doc(db, 'users', userData.uid);
                               
                               const payload = { 
                                  mtLogin: newLogin, 
                                  mtServer: newAcc ? ('Deriv ' + newAcc.landing_company_name?.toUpperCase()) : userData.mtServer,
                                  derivCurrency: newAcc ? newAcc.currency : userData.derivCurrency
                               };
                               await updateDoc(userRef, payload);
                               if (onUpdate) onUpdate({ ...userData, ...payload });
                           }}
                           className="w-full bg-black border border-white/10 rounded-lg p-3 pr-8 text-xs text-white font-mono focus:border-[#ff444f] outline-none transition-colors appearance-none"
                         >
                           {userData.derivAccountList.map((acc: any) => (
                              <option key={acc.loginid} value={acc.loginid}>
                                {acc.loginid} ({acc.currency} / {acc.account_type === 'demo' ? 'DEMO' : acc.landing_company_name?.toUpperCase() || 'REAL'})
                              </option>
                           ))}
                         </select>
                         <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none rotate-90" size={14} />
                       </div>
                       <p className="text-[10px] text-zinc-500 mt-2">Usado para negociar opções/multiplicadores nativos da corretora.</p>
                     </div>
                   )}
                   
                   {userData.derivMt5AccountList && userData.derivMt5AccountList.length > 0 && (
                     <div className="mt-4 w-full text-left bg-black/40 p-4 rounded-xl border border-white/5 max-h-64 overflow-y-auto custom-scrollbar">
                       <label className="text-[10px] font-black text-white uppercase tracking-widest block mb-3 flex items-center gap-2"><Server size={12} className="text-zinc-500" /> Contas MetaTrader 5 Disponíveis</label>
                       <div className="space-y-2">
                           {userData.derivMt5AccountList.map((mtAcc: any) => (
                               <div key={mtAcc.login} className="flex justify-between items-center p-3 rounded-lg border border-white/5 bg-[#111]">
                                  <div>
                                      <p className="text-xs font-bold text-white uppercase flex items-center gap-2">
                                         {mtAcc.login} 
                                         {mtAcc.account_type === 'demo' ? (
                                            <span className="text-[8px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">DEMO</span>
                                         ) : (
                                            <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">REAL</span>
                                         )}
                                      </p>
                                      <p className="text-[10px] text-zinc-500 uppercase mt-0.5">{mtAcc.server_info?.environment || mtAcc.server}</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-sm font-mono font-bold text-brand-red">{mtAcc.display_balance} <span className="text-[10px]">{mtAcc.currency}</span></p>
                                      <p className="text-[8px] text-zinc-500 uppercase">{mtAcc.market_type}</p>
                                  </div>
                               </div>
                           ))}
                       </div>
                       <p className="text-[10px] text-zinc-500 mt-3 relative pl-3">
                         <span className="absolute left-0 top-0 text-brand-red">*</span>
                         Para operar nas contas MT5, utilize a opção "MetaTrader 5" e a senha individual do MT5 correspondente na configuração.
                       </p>
                     </div>
                   )}
                   <button 
                     onClick={handleDisconnectBroker}
                     disabled={isSaving}
                     className="w-full mt-4 bg-zinc-900 border border-[#ff444f]/30 hover:bg-[#ff444f]/10 text-[#ff444f] font-bold uppercase tracking-widest text-xs py-3 rounded-xl transition-colors disabled:opacity-50"
                   >
                     {isSaving ? "Desconectando..." : "Desconectar Terminal"}
                   </button>
                 </div>
               ) : userData?.metaApiAccountId ? (
                 <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center space-y-4">
                   <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                     <CheckCircle2 size={32} className="text-green-500" />
                   </div>
                   <h4 className="text-green-500 font-bold uppercase tracking-widest text-lg">Terminal Conectado</h4>
                   <p className="text-sm text-zinc-400">Conta: <span className="text-white font-mono">{mtLogin}</span> ({mtPlatform.toUpperCase()})</p>
                   <p className="text-sm text-zinc-400">Servidor: <span className="text-white font-mono">{mtServer}</span></p>
                   <button 
                     onClick={handleDisconnectBroker}
                     disabled={isSaving}
                     className="w-full mt-4 bg-zinc-900 border border-brand-red/30 hover:bg-brand-red/10 text-brand-red font-bold uppercase tracking-widest text-xs py-3 rounded-xl transition-colors disabled:opacity-50"
                   >
                     {isSaving ? "Desconectando..." : "Desconectar Terminal"}
                   </button>
                 </div>
               ) : (
                <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Platform</label>
                    <div className="relative">
                      <select 
                        value={mtPlatform}
                        onChange={(e) => {
                            const val = e.target.value;
                            setMtPlatform(val);
                            if (val === 'deriv_api' && userData?.savedDerivToken) {
                                setMtPassword(userData.savedDerivToken);
                            } else {
                                setMtPassword('');
                            }
                            setMtLogin('');
                            setMtServer('');
                        }}
                        className="w-full bg-black border border-white/10 rounded-lg p-3 pr-8 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors appearance-none"
                      >
                        <option value="mt5">MetaTrader 5</option>
                        <option value="mt4">MetaTrader 4</option>
                        <option value="deriv_api">Deriv API (Token)</option>
                      </select>
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none rotate-90" size={14} />
                    </div>
                  </div>
                  
                  {mtPlatform === 'deriv_api' ? (
                     <div className="space-y-1 col-span-2">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Deriv API Token</label>
                       <input 
                         type="password" 
                         placeholder="Ex: H5TU8g6UGpe5lDX" 
                         value={mtPassword}
                         onChange={(e) => setMtPassword(e.target.value)}
                         className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                       />
                       <p className="text-[10px] text-zinc-500 ml-1 mt-1">Gere um token na Deriv com permissões de 'Read' e 'Trade'. Recomendado para Volatility/Boom/Crash.</p>
                     </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Login (Account ID)</label>
                        <input 
                          type="number" 
                          placeholder="Ex: 10029384" 
                          value={mtLogin}
                          onChange={(e) => setMtLogin(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                        />
                      </div>
                    </>
                  )}
                </div>
                {mtPlatform !== 'deriv_api' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Password</label>
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        value={mtPassword}
                        onChange={(e) => setMtPassword(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Server</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Deriv-Server-01" 
                        value={mtServer}
                        onChange={(e) => setMtServer(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1 mt-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Trade Comment (Metatrader/Corretora)</label>
                  <input 
                    type="text" 
                    value="QuantScan IA"
                    disabled
                    className="w-full bg-black border border-white/10 rounded-lg py-3 px-4 text-green-500 font-bold text-sm focus:outline-none opacity-80"
                  />
                  <p className="text-[10px] text-zinc-500 ml-1">Este comentário será enviado obrigatoriamente a cada trade executado, provando a autenticidade das operações na sua corretora.</p>
                </div>
                <button 
                  onClick={handleConnectBroker}
                  disabled={isSaving || !mtPassword || (mtPlatform !== 'deriv_api' && (!mtLogin || !mtServer))}
                  className="w-full bg-brand-red/10 text-brand-red border border-brand-red/30 hover:bg-brand-red/20 font-bold uppercase tracking-widest text-xs py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Connecting..." : saveSuccess ? "Connected Successfully" : "Connect Terminal"}
                </button>
                </>
               )}
             </div>
           </div>



           {/* TELEGRAM SETTINGS WIDGET */}
           <div className="bg-[#0088cc]/10 border border-[#0088cc]/30 p-5 rounded-2xl flex flex-col md:flex-row gap-6 items-center">
             <div className="w-12 h-12 rounded-full bg-[#0088cc]/20 flex items-center justify-center shrink-0">
               <Send size={24} className="text-[#0088cc]" />
             </div>
             <div className="flex-1 space-y-1 text-center md:text-left">
               <h4 className="font-bold text-white uppercase text-sm">Alertas no Telegram</h4>
               <p className="text-xs text-zinc-400">Receba notificações de entradas e saídas do robô instantaneamente no seu celular.</p>
             </div>
             <button className="bg-[#0088cc] hover:bg-[#0088cc]/80 text-white font-bold uppercase tracking-widest text-[10px] px-6 py-3 rounded-xl transition-colors shrink-0">
               Configurar
             </button>
           </div>
           
           {/* ACTIVITY LOGS WIDGET */}
           <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
             <h3 className="font-black italic uppercase text-white tracking-widest text-sm mb-6 flex items-center gap-2">
               <Activity size={16} className="text-brand-red" /> Activity Logs (Auto Trading)
             </h3>
             <div className="space-y-3">
               {autoTrades.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">Nenhum trade executado ainda.</p>
               ) : (
                  autoTrades.map((t) => (
                     <div key={t.id} className="bg-black border border-white/5 p-4 rounded-xl flex items-center justify-between">
                        <div>
                           <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-black uppercase tracking-wider", t.decision === 'BUY' ? 'text-green-500' : 'text-red-500')}>{t.decision}</span>
                              <span className="text-white font-bold text-sm">{t.pair}</span>
                           </div>
                           <div className="text-[10px] text-zinc-500 mt-1">
                              Vol: {t.volume} • Price: {t.price?.toFixed(5)} • SL: {t.stopLoss} • TP: {t.takeProfit}
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="text-[10px] text-zinc-400">{new Date(t.timestamp).toLocaleTimeString()}</div>
                           <div className="text-[10px] text-green-500 font-bold mt-1">EXECUTADO</div>
                        </div>
                     </div>
                  ))
               )}
             </div>
           </div>

        </div>
      </div>
    </div>
  );
};
