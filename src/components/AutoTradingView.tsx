import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Bot, Power, Activity, Settings2, Link, Zap, Shield, 
  BarChart2, TrendingUp, DollarSign, Send, Globe2, AlertTriangle, 
  Fingerprint, ChevronRight, Server, Cpu, Radio, Network, CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';

export const AutoTradingView: React.FC<{ userData?: any, onUpdate?: (data: any) => void, onNavigate?: (tab: string) => void, isAdmin?: boolean }> = ({ userData, onUpdate, onNavigate, isAdmin }) => {
  const [robotActive, setRobotActive] = useState(userData?.tradingSettings?.engineRunning ?? false);
  const [mtPlatform, setMtPlatform] = useState(userData?.mtPlatform || 'mt5');
  const [mtLogin, setMtLogin] = useState(userData?.mtLogin || '');
  const [mtPassword, setMtPassword] = useState(userData?.mtPassword || '');
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

  const saveSettingsToFirebase = async (newSettings: any[], newRisk: string, newMax: string, newAsset?: string, newSuffix?: string, newRobotActive?: boolean) => {
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
      autoSl: newSettings[4].active,
      riskPerTrade: parseFloat(newRisk) || 1.5,
      maxPositions: parseInt(newMax) || 3,
      selectedAsset: assetToSave,
      symbolSuffix: suffixToSave,
      engineRunning: engineToSave
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
    saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions, selectedAsset, symbolSuffix);
  };

  const handleMaxBlur = () => {
    saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions, selectedAsset, symbolSuffix);
  };

  const handleAssetBlur = () => {
    saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions, selectedAsset, symbolSuffix);
  };

  const handleSuffixBlur = () => {
    saveSettingsToFirebase(tradingSettings, riskPerTrade, maxPositions, selectedAsset, symbolSuffix);
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
        metaApiState: null
      });

      if (onUpdate) {
        onUpdate({ ...userData, mtPlatform: '', mtLogin: '', mtPassword: '', mtServer: '', metaApiAccountId: null, metaApiState: null });
      }
      setMtPlatform('mt5');
      setMtLogin('');
      setMtPassword('');
      setMtServer('');
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
      // First try to provision through our backend proxy
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

      // Save to Firebase
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, {
        mtPlatform,
        mtLogin,
        mtPassword,
        mtServer,
        metaApiAccountId: data.accountId,
        metaApiState: data.state
      });

      if (onUpdate) {
        onUpdate({ ...userData, mtPlatform, mtLogin, mtPassword, mtServer, metaApiAccountId: data.accountId, metaApiState: data.state });
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
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col justify-end md:flex-row md:items-end md:justify-between gap-6 relative p-8 min-h-[400px] rounded-2xl bg-black/40 border border-brand-red shadow-[0_0_30px_rgba(255,0,0,0.6)] overflow-hidden group">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-red/20 via-transparent to-transparent opacity-50 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-0" />
        <img src="https://i.ibb.co/VcJRM0zZ/90a0c129-b771-41d6-ad30-634d1d2546c4.png" alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-100 mix-blend-overlay pointer-events-none" />
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="space-y-1">
             <h1 className="text-3xl font-black italic uppercase tracking-tighter text-brand-red drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] flex items-center gap-3">
               QUANTSCAN IA
             </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
           <div className="text-right hidden md:block">
             <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Status Global</div>
             <div className={cn(
               "text-xl font-black tracking-widest",
               robotActive ? "text-brand-red drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]" : "text-zinc-600"
             )}>
               {robotActive ? "ONLINE" : "OFFLINE"}
             </div>
           </div>
        </div>
      </div>

      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: STATUS & BUTTONS */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* STATUS CARDS REMOVED */}


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

          <div className="space-y-3 bg-black/40 border border-white/10 p-4 rounded-2xl">
             <div className="space-y-4 bg-black/40 border border-brand-red/20 p-5 rounded-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Cpu size={100} className="text-brand-red" />
               </div>
               <h3 className="font-black italic uppercase text-white tracking-widest text-sm flex items-center gap-2 relative z-10">
                 <Bot size={16} className="text-brand-red" /> Robôs Conectados
               </h3>
               
               <div className="space-y-3 relative z-10">
                  <div className="bg-black/50 border border-white/10 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white uppercase flex items-center gap-2">QuantScan IA <span className="bg-brand-red/20 text-brand-red text-[8px] px-2 py-0.5 rounded-full">PRO</span></div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Trading Institucional HFR</div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(0,255,0,0.8)]" />
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
           <div className="bg-black/40 border border-white/10 p-5 rounded-2xl h-full">
              <h3 className="font-black italic uppercase text-white tracking-widest text-sm mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
                <Settings2 size={16} className="text-brand-red" /> Auto Trading Settings
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
                    <input 
                      type="text" 
                      placeholder="Ex: EUR/USD, XAU/USD..."
                      value={selectedAsset}
                      onChange={(e) => setSelectedAsset(e.target.value)}
                      onBlur={handleAssetBlur}
                      className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors" 
                    />
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
              </div>
           </div>
        </div>

        {/* RIGHT COLUMN: BROKERS & LIVE MARKET */}
        <div className="lg:col-span-2 space-y-6">
           
           {/* BROKER INTEGRATION (MT4/MT5) */}
           <div id="broker-connection" className="bg-black/40 border border-white/10 p-5 rounded-2xl">
             <h3 className="font-black italic uppercase text-white tracking-widest text-sm mb-6 flex items-center gap-2">
               <Globe2 size={16} className="text-brand-red" /> MT4 / MT5 Server Connection
             </h3>
             <div className="space-y-4">
               {userData?.metaApiAccountId ? (
                 <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center space-y-4">
                   <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                     <CheckCircle2 size={32} className="text-green-500" />
                   </div>
                   <h4 className="text-green-500 font-bold uppercase tracking-widest text-lg">Terminal Conectado</h4>
                   <p className="text-sm text-zinc-400">Conta: <span className="text-white font-mono">{mtLogin}</span> ({mtPlatform.toUpperCase()})</p>
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
                        onChange={(e) => setMtPlatform(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-lg p-3 pr-8 text-sm text-white font-mono focus:border-brand-red outline-none transition-colors appearance-none"
                      >
                        <option value="mt5">MetaTrader 5</option>
                        <option value="mt4">MetaTrader 4</option>
                      </select>
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none rotate-90" size={14} />
                    </div>
                  </div>
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
                </div>
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
                  disabled={isSaving || !mtLogin || !mtPassword || !mtServer}
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
