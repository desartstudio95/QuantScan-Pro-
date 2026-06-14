import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, ShieldCheck, Target, TrendingUp, AlertTriangle, Loader2, Zap, BrainCircuit, Camera, ScanLine, Bell, BellRing, Activity, LineChart, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeForexChart } from '../services/geminiService';
import { AnalysisResponse, SignalResult, SignalType } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import axios from 'axios';
import { compressImage, cleanupStorage } from '../lib/imageUtils';
import { storage, auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { fetchCurrentPrice } from '../services/marketData';
import { sendTelegramAlert } from '../services/notifications';
import { WatchlistPanel } from './WatchlistPanel';

export const AnalysisView: React.FC<{ userData?: any, onGoToHistory?: () => void }> = ({ userData, onGoToHistory }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'Técnico' | 'Fundamental' | 'Híbrido'>('Híbrido');
  const [tradingStyle, setTradingStyle] = useState<'Automático' | 'Scalping' | 'Day Trading' | 'Swing'>('Automático');
  const [usageInfo, setUsageInfo] = useState<{ used: number, limit: number }>({ used: 0, limit: userData?.analysisLimit ?? 8 });
  const [alerts, setAlerts] = useState<{type: string, price: string, targetValue: number}[]>([]);
  const [customAlertPrices, setCustomAlertPrices] = useState<Record<string, string>>({});
  const [alertOptions, setAlertOptions] = useState({ execution: true, expiration: true });
  const [marketPrice, setMarketPrice] = useState<number | null>(null);

  const now = Date.now();
  const isLifetime = userData?.plan === 'lifetime';
  const endsAt = userData?.subscriptionEndsAt;
  const isExpired = !!(!isLifetime && endsAt && now > endsAt);
  const daysRemaining = !isLifetime && endsAt ? (endsAt - now) / (1000 * 60 * 60 * 24) : null;
  const isEndingSoon = daysRemaining !== null && Math.ceil(daysRemaining) <= 3 && Math.ceil(daysRemaining) > 0;

  useEffect(() => {
    if (result && result.entry) {
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    } else {
      setMarketPrice(null);
      setAlerts([]);
    }
  }, [result]);

  useEffect(() => {
    if (!result || !result.pair) return;
    
    let isMounted = true;
    let currentPrice = marketPrice;

    const fetchPrice = async () => {
      try {
        const price = await fetchCurrentPrice(result.pair);
        if (price !== null && isMounted) {
          setMarketPrice(price);
          currentPrice = price;
          checkAlerts(price);
        }
      } catch (e: any) {
        console.error("Error fetching market price", e?.message || e);
      }
    };

    const checkAlerts = (price: number) => {
        let triggeredIndex = -1;
        const triggeredAlert = alerts.find((alert, index) => {
          // Check if price crossed the target since last check
          // Fallback condition if currentPrice is null is just exact match but that's rare, 
          // usually we just check within a small margin
          const isTriggered = Math.abs(price - alert.targetValue) < (alert.targetValue * 0.0002) || 
            (currentPrice && currentPrice < alert.targetValue && price >= alert.targetValue) ||
            (currentPrice && currentPrice > alert.targetValue && price <= alert.targetValue);
            
          if (isTriggered) triggeredIndex = index;
          return isTriggered;
        });

        if (triggeredAlert && triggeredIndex !== -1) {
          const msg = `🚨 Alerta QuantScan: O ativo ${result.pair} atingiu seu alvo de ${triggeredAlert.type} (${triggeredAlert.price}).`;
          
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.error("Audio play failed:", e));
          } catch(e) {
            console.error(e)
          }

          if ('Notification' in window && Notification.permission === 'granted') {
             new Notification('🚨 Alerta QuantScan', {
               body: msg,
               icon: 'https://i.ibb.co/9BwbV3M/FXBROS-WORLD-3.png'
             });
          } else {
             window.alert(msg);
          }
          setAlerts(prev => prev.filter((_, i) => i !== triggeredIndex));
        }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000); // Poll every minute

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [result, alerts]);

  useEffect(() => {
    const fetchUsage = async () => {
      if (!auth.currentUser) return;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      try {
        const q = query(
          collection(db, 'signals'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const snapshot = await getDocs(q).catch(err => {
          handleFirestoreError(err, OperationType.LIST, 'signals');
          throw err;
        });
        
        const todaySignals = snapshot.docs.filter((doc) => {
          const data = doc.data();
          return data.timestamp >= today.getTime();
        });

        setUsageInfo({
          used: todaySignals.length,
          limit: userData?.analysisLimit ?? 8
        });
      } catch (err) {
        console.error("Error fetching usage stats", err);
      }
    };
    
    fetchUsage();
  }, [result, userData]);

  const handleStartAnalysis = async () => {
    if (isExpired) {
      setError("Sua assinatura expirou. Por favor, contate o administrador para renovar o plano.");
      return;
    }
    if (!preview || !file) return;
    if (usageInfo.used >= usageInfo.limit) {
      setError(`Limite diário atingido (${usageInfo.used}/${usageInfo.limit}). Faça upgrade para análises ilimitadas.`);
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      let downloadUrl = null;
      if (auth.currentUser) {
        const fileRef = ref(storage, `scans/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        downloadUrl = await getDownloadURL(fileRef);
        
        // Clean up old scans for this user to avoid storage limits (keep max 100)
        cleanupStorage(`scans/${auth.currentUser.uid}`, 100);
      }

      const base64 = preview.split(',')[1];
      const analysis = await analyzeForexChart(base64, undefined, mode, userData?.plan, tradingStyle);
      analysis.score = Math.round(analysis.score);
      setResult(analysis);
      
      if (auth.currentUser) {
        const sanitizedAnalysis = { ...analysis };
        if (sanitizedAnalysis.pair) sanitizedAnalysis.pair = String(sanitizedAnalysis.pair).substring(0, 100);
        if (sanitizedAnalysis.timeframe) sanitizedAnalysis.timeframe = String(sanitizedAnalysis.timeframe).substring(0, 50);
        sanitizedAnalysis.score = Math.round(Number(sanitizedAnalysis.score) || 0);

        await addDoc(collection(db, 'signals'), {
          ...sanitizedAnalysis,
          screenshotUrl: downloadUrl,
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          timestamp: Date.now(),
          result: SignalResult.PENDING,
          type: sanitizedAnalysis.decision || 'WAIT'
        }).catch(err => {
          handleFirestoreError(err, OperationType.CREATE, 'signals');
          throw err;
        });

        toast.success(`Scanner Concluído com ${sanitizedAnalysis.score}% de Confiança no ${sanitizedAnalysis.pair || 'Ativo'}!`, {
            description: `Decisão de ${sanitizedAnalysis.decision}`
        });

        if (sanitizedAnalysis.decision !== 'WAIT') {
          axios.post('/api/onesignal/notify', {
            title: 'Novo Sinal QuantScan IA 🚨',
            message: `${sanitizedAnalysis.pair} - ${sanitizedAnalysis.decision} (${sanitizedAnalysis.signalType || 'Scalping'}). Confiança: ${sanitizedAnalysis.score}%`
          }).catch((err: any) => console.error("OneSignal error", err?.message || err));
          
          sendTelegramAlert(sanitizedAnalysis).catch((err: any) => console.error("Telegram Error", err?.message || err));
        }
      }

    } catch (err: any) {
      console.error("Gemini Error:", err?.message || err);
      let errorMessage = err.message || 'Falha ao analisar imagem. Verifique se o gráfico está claro.';
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('prepayment credits')) {
        errorMessage = 'Sua cota de uso da API do Google Gemini (IA) foi excedida ou os créditos acabaram. Por favor, acesse o painel do Google AI Studio (https://ai.studio) para verificar seu faturamento e recarregar os créditos.';
      } else {
        errorMessage = `Erro na API: ${errorMessage}`;
      }
      setError(errorMessage);
      toast.error('Erro na análise do Scanner', { description: errorMessage });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    
    // Comprimir a imagem antes de setar state para reduzir MS
    const compressedFile = await compressImage(selectedFile, 1200, 0.7);
    
    setFile(compressedFile);
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(compressedFile);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  } as any);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setAlerts([]);
  };

  const handleCustomAlertPriceChange = (type: string, value: string) => {
    setCustomAlertPrices(prev => ({ ...prev, [type]: value }));
  };

  const toggleAlert = (type: string, priceStr: string) => {
    const numPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    if (isNaN(numPrice)) return;

    setAlerts(prev => {
      const exists = prev.some(a => a.type === type);
      if (exists) {
        return prev.filter(a => a.type !== type);
      } else {
        return [...prev, { type, price: priceStr, targetValue: numPrice }];
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {isExpired && (
        <div className="bg-brand-red/10 border border-brand-red p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="text-brand-red shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-brand-red font-black text-sm uppercase tracking-widest">Assinatura Expirada</h3>
            <p className="text-red-200/70 text-xs mt-1">
              Sua assinatura expirou. Renove seu plano para continuar usando o scanner analisador.
            </p>
          </div>
        </div>
      )}
      
      {isEndingSoon && (
        <div className="bg-orange-500/10 border border-orange-500 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-orange-500 font-black text-sm uppercase tracking-widest">Assinatura Expirando</h3>
            <p className="text-orange-200/70 text-xs mt-1">
              Sua assinatura expira em {Math.ceil(daysRemaining)} dia(s). Renove agora para não perder o acesso ao scanner.
            </p>
          </div>
        </div>
      )}

      <header className="space-y-1">
        <h1 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-2.5 uppercase">
          <div className="w-7 h-7 rounded-lg border-2 border-brand-red flex items-center justify-center red-glow">
            <TrendingUp size={14} className="text-brand-red" />
          </div>
          Novo Scan
        </h1>
        <div className="flex items-center justify-between">
          <p className="text-zinc-500 text-[10px] font-medium leading-none">Envie um gráfico para análise de IA Pro.</p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div 
                className={cn(
                  "h-full transition-all duration-500",
                  usageInfo.used >= usageInfo.limit ? "bg-brand-red" : "bg-green-500"
                )}
                style={{ width: usageInfo.limit === 999999 ? '100%' : `${Math.min(100, (usageInfo.used / usageInfo.limit) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-black uppercase text-zinc-500">
              {usageInfo.limit === 999999 ? `${usageInfo.used}/∞ Scans` : `${usageInfo.used}/${usageInfo.limit} Scans`}
            </span>
          </div>
        </div>
      </header>
      
      <WatchlistPanel />

      {!result ? (
        <div className="glass-card p-6 border-zinc-900 min-h-[300px] flex flex-col justify-center items-center group relative">
          {isAnalyzing && (
            <div className="absolute inset-0 z-50 bg-brand-dark/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 rounded-xl">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <div className="absolute inset-0 border-2 border-brand-red/30 animate-ping rounded-full" />
                <div className="absolute inset-4 border-2 border-brand-red/20 animate-pulse rounded-full" />
                <img src="https://i.ibb.co/9BwbV3M/FXBROS-WORLD-3.png" className="w-16 h-16 animate-pulse" alt="Logo" />
                <motion.div
                  initial={{ top: '0%' }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="absolute left-0 right-0 h-[2px] bg-brand-red shadow-[0_0_15px_rgba(255,0,0,0.8)]"
                />
              </div>
              <p className="text-brand-red font-black text-lg italic tracking-tighter animate-pulse uppercase">Processando Scan Institucional...</p>
            </div>
          )}
          {!preview ? (
            <div className="w-full flex flex-col gap-4 items-center justify-center">
              <div className="flex flex-col gap-3 w-full max-w-sm mb-4">
                <div className="flex flex-col justify-center gap-1.5 w-full tour-step-2">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold text-center">Tipo de Análise</span>
                  <div className="flex gap-2 w-full justify-center">
                     {(['Técnico', 'Fundamental', 'Híbrido'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                            mode === m ? "bg-brand-red text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                          )}
                        >
                          {m}
                        </button>
                     ))}
                  </div>
                </div>
                
                <div className="flex flex-col justify-center gap-1.5 w-full tour-step-3">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold text-center">Estilo de Trading</span>
                  <div className="flex gap-2 w-full justify-center flex-wrap">
                     {(['Automático', 'Scalping', 'Day Trading', 'Swing'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setTradingStyle(s)}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                            tradingStyle === s ? "bg-brand-red text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                          )}
                        >
                          {s}
                        </button>
                     ))}
                  </div>
                </div>
              </div>
              <div 
                {...getRootProps()} 
                className={cn(
                  "w-full flex flex-col items-center justify-center py-10 rounded-xl cursor-pointer transition-all duration-300 border border-transparent tour-step-1",
                  isDragActive ? "bg-brand-red/5 scale-[0.98] border-brand-red/30" : "hover:bg-zinc-800/20",
                  isExpired ? "opacity-50 pointer-events-none" : ""
                )}
              >
                <input {...getInputProps()} disabled={isExpired} />
                <div className="w-16 h-16 bg-brand-gray rounded-xl flex items-center justify-center mb-4 border border-white/5 group-hover:border-brand-red/30 transition-colors">
                  <Upload size={24} className="text-zinc-600 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-base font-black uppercase italic tracking-tighter text-white mb-1 text-center px-4">Fazer Upload ou Arrastar</p>
                <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-center px-4">TradingView, MT4/MT5, cTrader</p>
              </div>

              <div className="flex gap-3 w-full">
                <label className={cn(
                  "flex-1 bg-brand-dark border-2 border-white/5 text-white py-3.5 rounded-xl font-black text-xs hover:border-brand-red/50 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden group",
                  isExpired ? "opacity-50 pointer-events-none" : ""
                )}>
                  <Camera size={16} className="text-zinc-400 group-hover:text-brand-red transition-colors" />
                  <span className="whitespace-nowrap pt-0.5">TIRAR FOTO</span>
                  <input type="file" accept="image/*" capture="environment" disabled={isExpired} className="opacity-0 absolute inset-0 cursor-pointer w-full h-full" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onDrop([f]);
                  }} />
                </label>
                <label className="flex-1 bg-brand-red/10 border-2 border-brand-red/30 text-brand-red py-3.5 rounded-xl font-black text-xs hover:bg-brand-red/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden group">
                  <ScanLine size={16} className="group-hover:scale-110 transition-transform" />
                  <span className="whitespace-nowrap pt-0.5">SCAN AO VIVO</span>
                  <input type="file" accept="image/*" capture="environment" className="opacity-0 absolute inset-0 cursor-pointer w-full h-full" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onDrop([f]);
                  }} />
                </label>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <div className="relative rounded-lg overflow-hidden border border-white/5 max-h-[400px]">
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                <button 
                  onClick={reset}
                  className="absolute top-3 right-3 p-1.5 bg-black/60 rounded-full text-white hover:bg-brand-red transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={reset}
                  disabled={isAnalyzing}
                  className="w-1/3 bg-white/5 text-white py-3.5 rounded-xl font-black text-sm hover:bg-white/10 border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 uppercase"
                >
                  NOVO SCAN
                </button>
                <button 
                  onClick={handleStartAnalysis}
                  disabled={isAnalyzing}
                  className="flex-1 bg-brand-red text-white py-3.5 rounded-xl font-black text-base hover:bg-brand-red/90 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      ANALISANDO...
                    </>
                  ) : (
                    'ANALISAR GRÁFICO'
                  )}
                </button>
              </div>
              {error && <p className="text-brand-red text-center text-xs font-bold">{error}</p>}
            </div>
          )}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Score & Signal Info */}
            <div className="glass-card flex flex-col space-y-4 relative overflow-hidden bg-gradient-to-b from-brand-gray/40 to-transparent">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-red/5 blur-3xl" />
              
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full drop-shadow-[0_0_15px_rgba(255,0,0,0.1)]" viewBox="0 0 100 100">
                    <circle 
                      cx="50" cy="50" r="45" 
                      fill="none" 
                      stroke="rgba(255,255,255,0.03)" 
                      strokeWidth="2"
                    />
                    <circle 
                      cx="50" cy="50" r="45" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="4"
                      strokeDasharray={283}
                      strokeDashoffset={283 - (283 * result.score) / 100}
                      className={cn(
                        "transition-all duration-1000 ease-out",
                        result.decision === SignalType.BUY ? "text-green-500" : (result.decision === SignalType.SELL ? "text-brand-red" : "text-zinc-500")
                      )}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-0.5">IA SCORE</span>
                    <span className={cn(
                      "text-4xl font-black leading-none font-mono tracking-tighter",
                      result.decision === SignalType.BUY ? "text-green-500 text-shadow-sm shadow-green-500/50" : (result.decision === SignalType.SELL ? "text-brand-red red-text-glow" : "text-zinc-500")
                    )}>
                      {result.score}%
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-3 z-10 w-full text-center md:text-left">
                  <div>
                    <h3 className={cn(
                      "text-xs font-black uppercase tracking-widest",
                      result.score >= 80 
                        ? (result.decision === SignalType.BUY ? "text-green-500" : "text-brand-red") 
                        : result.score >= 60 ? "text-orange-500" : "text-zinc-500"
                    )}>
                      {result.score >= 80 ? '🔥 ALTA PROBABILIDADE' : result.score >= 60 ? '⚖️ MÉDIA PROBABILIDADE' : '❌ EVITAR'}
                    </h3>
                    <p className="text-zinc-400 mt-1.5 text-xs font-medium leading-relaxed border-l-2 border-white/10 pl-3 md:pl-0 md:border-l-0 text-left md:text-justify">{result.justification}</p>
                    <p className="text-brand-red mt-2 text-[10px] font-bold uppercase tracking-widest bg-brand-red/10 inline-block px-2 py-1 rounded border border-brand-red/20">⚠️ {result.alerta}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 w-full pt-4 border-t border-white/5">
                <div className="bg-black/40 border border-white/5 rounded p-2 text-center">
                  <span className="block text-[8px] text-zinc-600 uppercase font-black mb-1 tracking-widest">ATIVO IDENTIFICADO</span>
                  <span className="text-sm font-black text-white">{result.pair}</span>
                </div>
                <div className="bg-black/40 border border-white/5 rounded p-2 text-center">
                  <span className="block text-[8px] text-zinc-600 uppercase font-black mb-1 tracking-widest">TIMEFRAME</span>
                  <span className="text-sm font-black text-white">{result.timeframe}</span>
                </div>
                <div className="bg-black/40 border border-white/5 rounded p-2 text-center">
                  <span className="block text-[8px] text-zinc-600 uppercase font-black mb-1 tracking-widest">RISCO</span>
                  <span className={cn(
                        "text-sm font-black tracking-widest",
                        result.riskLevel?.toUpperCase() === 'LOW' ? "text-green-500" :
                        result.riskLevel?.toUpperCase() === 'HIGH' ? "text-brand-red" : "text-orange-500"
                      )}>{result.riskLevel || 'MED'}</span>
                </div>
              </div>
              
              <div className="bg-brand-red/5 border border-brand-red/10 rounded-lg p-3">
                 <h4 className="text-[9px] uppercase font-black tracking-widest text-brand-red mb-2 flex items-center gap-2">
                    <ScanLine size={12} /> Padrões & Estrutura Detectada
                 </h4>
                 <p className="text-xs text-brand-light font-medium leading-relaxed font-mono mt-1">
                    {result.estrutura || result.tecnica || 'Padrões de liquidez identificados pelo modelo Quântico.'}
                 </p>
              </div>
            </div>

            {/* Trading Decision Block */}
            <div className="glass-card space-y-4 bg-gradient-to-b from-black to-brand-gray/20">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{result.signalType || 'EXECUÇÃO'}</span>
                    <span className="text-sm font-black text-white">{result.pair}</span>
                 </div>
                 <div className={cn(
                  "px-4 py-1.5 rounded flex items-center justify-center border",
                  result.decision === SignalType.BUY ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                  result.decision === SignalType.SELL ? "bg-brand-red/10 text-brand-red border-brand-red/20" : 
                  "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                )}>
                  <span className="text-xl font-black uppercase italic tracking-tighter">
                    {result.decision}
                  </span>
                </div>
              </div>

              {marketPrice !== null && (
                <div className="flex items-center justify-between bg-black/60 p-3 rounded border border-white/5">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2"><Activity size={12}/> MARKET PRICE</span>
                  <span className="font-mono text-lg font-black text-white">{marketPrice.toFixed(5)}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between p-2 bg-black/40 rounded border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-blue-500" />
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">ENTRY LEVEL</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      className="font-mono font-bold text-sm bg-transparent border-b border-dashed border-white/20 text-right w-24 outline-none focus:border-white transition-colors text-white"
                      value={customAlertPrices['Entrada'] ?? result.entry}
                      onChange={(e) => handleCustomAlertPriceChange('Entrada', e.target.value)}
                    />
                    <button 
                      onClick={() => toggleAlert('Entrada', customAlertPrices['Entrada'] ?? result.entry)}
                      className={cn(
                        "p-1.5 rounded transition-colors", 
                        alerts.some(a => a.type === 'Entrada') ? "text-yellow-500 bg-yellow-500/20" : "text-zinc-500 hover:text-yellow-500 hover:bg-white/5"
                      )}
                    >
                      {alerts.some(a => a.type === 'Entrada') ? <BellRing size={14} /> : <Bell size={14} />}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-brand-red/5 rounded border border-brand-red/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-brand-red" />
                    <span className="text-[9px] font-black text-brand-red uppercase tracking-widest">STOP LOSS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      className="font-mono font-bold text-sm bg-transparent border-b border-dashed border-brand-red/30 text-right w-24 outline-none focus:border-brand-red transition-colors text-brand-red"
                      value={customAlertPrices['Stop Loss'] ?? result.stopLoss}
                      onChange={(e) => handleCustomAlertPriceChange('Stop Loss', e.target.value)}
                    />
                    <button 
                      onClick={() => toggleAlert('Stop Loss', customAlertPrices['Stop Loss'] ?? result.stopLoss)}
                      className={cn(
                        "p-1.5 rounded transition-colors", 
                        alerts.some(a => a.type === 'Stop Loss') ? "text-yellow-500 bg-yellow-500/20" : "text-zinc-500 hover:text-yellow-500 hover:bg-white/5"
                      )}
                    >
                      {alerts.some(a => a.type === 'Stop Loss') ? <BellRing size={14} /> : <Bell size={14} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-green-500/5 rounded border border-green-500/10">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-green-500" />
                    <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">TAKE PROFIT 1</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      className="font-mono font-bold text-sm bg-transparent border-b border-dashed border-green-500/30 text-right w-24 outline-none focus:border-green-500 transition-colors text-green-500"
                      value={customAlertPrices['Take Profit 1'] ?? result.takeProfit}
                      onChange={(e) => handleCustomAlertPriceChange('Take Profit 1', e.target.value)}
                    />
                    <button 
                      onClick={() => toggleAlert('Take Profit 1', customAlertPrices['Take Profit 1'] ?? result.takeProfit)}
                      className={cn(
                        "p-1.5 rounded transition-colors", 
                        alerts.some(a => a.type === 'Take Profit 1') ? "text-yellow-500 bg-yellow-500/20" : "text-zinc-500 hover:text-yellow-500 hover:bg-white/5"
                      )}
                    >
                      {alerts.some(a => a.type === 'Take Profit 1') ? <BellRing size={14} /> : <Bell size={14} />}
                    </button>
                  </div>
                </div>
                
                {result.takeProfit2 && (
                  <div className="flex items-center justify-between p-2 bg-green-500/5 rounded border border-green-500/10">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-green-500" />
                      <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">TAKE PROFIT 2</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        className="font-mono font-bold text-sm bg-transparent border-b border-dashed border-green-500/30 text-right w-24 outline-none focus:border-green-500 transition-colors text-green-500"
                        value={customAlertPrices['Take Profit 2'] ?? result.takeProfit2}
                        onChange={(e) => handleCustomAlertPriceChange('Take Profit 2', e.target.value)}
                      />
                      <button 
                        onClick={() => toggleAlert('Take Profit 2', customAlertPrices['Take Profit 2'] ?? result.takeProfit2!)}
                        className={cn(
                          "p-1.5 rounded transition-colors", 
                          alerts.some(a => a.type === 'Take Profit 2') ? "text-yellow-500 bg-yellow-500/20" : "text-zinc-500 hover:text-yellow-500 hover:bg-white/5"
                        )}
                      >
                        {alerts.some(a => a.type === 'Take Profit 2') ? <BellRing size={14} /> : <Bell size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                {result.takeProfit3 && (
                  <div className="flex items-center justify-between p-2 bg-green-500/5 rounded border border-green-500/10">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-green-500" />
                      <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">TAKE PROFIT 3</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        className="font-mono font-bold text-sm bg-transparent border-b border-dashed border-green-500/30 text-right w-24 outline-none focus:border-green-500 transition-colors text-green-500"
                        value={customAlertPrices['Take Profit 3'] ?? result.takeProfit3}
                        onChange={(e) => handleCustomAlertPriceChange('Take Profit 3', e.target.value)}
                      />
                      <button 
                        onClick={() => toggleAlert('Take Profit 3', customAlertPrices['Take Profit 3'] ?? result.takeProfit3!)}
                        className={cn(
                          "p-1.5 rounded transition-colors", 
                          alerts.some(a => a.type === 'Take Profit 3') ? "text-yellow-500 bg-yellow-500/20" : "text-zinc-500 hover:text-yellow-500 hover:bg-white/5"
                        )}
                      >
                        {alerts.some(a => a.type === 'Take Profit 3') ? <BellRing size={14} /> : <Bell size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                 <h4 className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-2">Opções de Notificação</h4>
                 <div className="flex items-center justify-between p-3 glass-card bg-transparent border-white/5">
                   <div className="flex items-center gap-2">
                     <BellRing size={14} className="text-zinc-500" />
                     <span className="text-[9px] font-black text-white uppercase">Notificar Horário de Negociação</span>
                   </div>
                   <button
                      onClick={() => setAlertOptions(prev => ({ ...prev, execution: !prev.execution }))}
                      className={cn("w-8 h-4 rounded-full transition-colors relative", alertOptions.execution ? "bg-brand-red" : "bg-white/10")}
                    >
                      <div className={cn("w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all", alertOptions.execution ? "right-0.5" : "left-0.5")} />
                    </button>
                 </div>
                 <div className="flex items-center justify-between p-3 glass-card bg-transparent border-white/5">
                   <div className="flex items-center gap-2">
                     <AlertTriangle size={14} className="text-zinc-500" />
                     <span className="text-[9px] font-black text-white uppercase">Sinal Inválido ou Expirado</span>
                   </div>
                   <button
                      onClick={() => setAlertOptions(prev => ({ ...prev, expiration: !prev.expiration }))}
                      className={cn("w-8 h-4 rounded-full transition-colors relative", alertOptions.expiration ? "bg-brand-red" : "bg-white/10")}
                    >
                      <div className={cn("w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all", alertOptions.expiration ? "right-0.5" : "left-0.5")} />
                    </button>
                 </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {result.multiTimeFrameAnalysis && (
              <div className="glass-card space-y-4 col-span-full">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                  <Activity size={14} /> MULTI TIME FRAME ANALYSIS
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                  {result.multiTimeFrameAnalysis}
                </p>
              </div>
            )}
            
            <div className="glass-card space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-red flex items-center gap-2">
                <BrainCircuit size={14} /> RECONHECIMENTO DE PADRÕES & ESTRUTURA
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                {result.estrutura || result.tecnica}
              </p>
            </div>
            
            <div className="glass-card space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-green-500 flex items-center gap-2">
                <TrendingUp size={14} /> ANÁLISE FUNDAMENTAL & LIQUIDEZ
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                {result.fundamental}
              </p>
            </div>

            {result.winrateLearning && (
              <div className="glass-card space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-500 flex items-center gap-2">
                  <LineChart size={14} /> WINRATE LEARNING AI
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                  {result.winrateLearning}
                </p>
              </div>
            )}

            {result.trailingStop && (
              <div className="glass-card space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-2">
                  <Crosshair size={14} /> TRAILING STOP AI
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                  {result.trailingStop}
                </p>
              </div>
            )}

             <div className="glass-card space-y-4 col-span-full">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Target size={14} /> ANALISE GERAL
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                  {result.analiseGeral}
              </p>
            </div>
          </div>

          {/* Analysis Illustration */}
          <div className="glass-card overflow-hidden !p-0 border-zinc-900/50 relative">
            <div className="absolute top-4 left-4 z-20">
               <h3 className="text-xs font-black flex items-center gap-2 uppercase italic tracking-wider text-white">
                 <ShieldCheck size={14} className={cn(result.decision === SignalType.BUY ? "text-green-500" : "text-brand-red")} />
                 Mapeamento Técnico da IA
               </h3>
            </div>
            
            <div className="aspect-[21/9] relative bg-zinc-950 flex items-center justify-center">
               <div className="absolute inset-0 z-10 bg-gradient-to-t from-brand-dark via-brand-dark/20 to-transparent" />
               <img 
                 src={preview || ''} 
                 alt="Technical Analysis Map" 
                 className="w-full h-full object-cover opacity-60 mix-blend-screen grayscale"
               />
               
               {/* UI Overlays to simulate AI analysis */}
               {/* Predictive Trend Overlay */}
               <div className="absolute inset-0 z-15 pointer-events-none p-4 w-full h-full">
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                    <defs>
                      <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={result.decision === SignalType.BUY ? "#22c55e" : result.decision === SignalType.SELL ? "#ef4444" : "#71717a"} stopOpacity="0" />
                        <stop offset="100%" stopColor={result.decision === SignalType.BUY ? "#22c55e" : result.decision === SignalType.SELL ? "#ef4444" : "#71717a"} stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                    {result.decision === SignalType.BUY && (
                      <motion.path 
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
                        d="M 10 90 Q 40 80, 50 50 T 90 20" 
                        fill="none" 
                        stroke="url(#trendGradient)" 
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                    )}
                    {result.decision === SignalType.SELL && (
                      <motion.path 
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
                        d="M 10 20 Q 40 30, 50 60 T 90 90" 
                        fill="none" 
                        stroke="url(#trendGradient)" 
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                    )}
                    {result.decision !== SignalType.WAIT && (
                      <>
                        <motion.circle
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.5, delay: 2 }}
                           cx="90" 
                           cy={result.decision === SignalType.BUY ? "20" : result.decision === SignalType.SELL ? "90" : "50"}
                           r="1.5"
                           fill={result.decision === SignalType.BUY ? "#22c55e" : result.decision === SignalType.SELL ? "#ef4444" : "#71717a"}
                        />
                        <motion.text
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           transition={{ duration: 0.5, delay: 2 }}
                           x="93"
                           y={result.decision === SignalType.BUY ? "21.5" : result.decision === SignalType.SELL ? "91.5" : "51.5"}
                           fontSize="3"
                           fill="white"
                           fontWeight="bold"
                        >
                          {result.score}% OVERLAY DE PREVISÃO
                        </motion.text>
                      </>
                    )}
                  </svg>
               </div>
               
               <div className="absolute inset-0 z-20 p-6 flex flex-col justify-end">
                  <div className="flex flex-wrap gap-2 mb-2">
                     <span className="px-2 py-0.5 bg-brand-red/20 border border-brand-red/30 rounded text-[8px] font-bold text-brand-red uppercase tracking-tighter backdrop-blur-sm">
                       Fluxo Institucional Detectado
                     </span>
                     <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-bold text-zinc-400 uppercase tracking-tighter backdrop-blur-sm">
                       HFT Signature
                     </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-black italic uppercase tracking-tighter text-white">
                        {result.pair} / {result.timeframe}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        Ref: AIS-BETA-{Math.floor(Math.random() * 10000)}
                      </p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-brand-red uppercase">Confirmação IA</p>
                       <p className="text-2xl font-black italic text-white leading-none">{result.score}%</p>
                    </div>
                  </div>
               </div>

               {/* Decorative Scanning Line */}
               <motion.div 
                 initial={{ top: '0%' }}
                 animate={{ top: '100%' }}
                 transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                 className="absolute left-0 right-0 h-px bg-brand-red/50 z-30 shadow-[0_0_10px_rgba(255,0,0,0.5)]"
               />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={reset}
              className="w-full py-3 text-zinc-600 hover:text-white font-black text-xs uppercase tracking-widest transition-colors"
            >
              NOVO SCAN INSTITUCIONAL
            </button>
            
            {onGoToHistory && (
              <button 
                onClick={onGoToHistory}
                className="w-full py-2 text-zinc-500 hover:text-white font-medium text-[10px] uppercase tracking-widest transition-colors"
              >
                Ver Histórico de Sinais
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
