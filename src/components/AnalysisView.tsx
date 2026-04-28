import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, ShieldCheck, Target, TrendingUp, AlertTriangle, Loader2, Zap, BrainCircuit, Camera, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeForexChart } from '../services/geminiService';
import { AnalysisResponse, SignalResult, SignalType } from '../types';
import { cn } from '../lib/utils';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp } from 'firebase/firestore';

export const AnalysisView: React.FC<{ userData?: any }> = ({ userData }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usageInfo, setUsageInfo] = useState<{ used: number, limit: number }>({ used: 0, limit: userData?.analysisLimit ?? 8 });

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
        const fileRef = ref(storage, `files/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        downloadUrl = await getDownloadURL(fileRef);
      }

      const base64 = preview.split(',')[1];
      const analysis = await analyzeForexChart(base64);
      setResult(analysis);
      
      if (auth.currentUser) {
        await addDoc(collection(db, 'signals'), {
          ...analysis,
          screenshotUrl: downloadUrl,
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          timestamp: Date.now(),
          result: SignalResult.PENDING,
          type: analysis.decision
        }).catch(err => {
          handleFirestoreError(err, OperationType.CREATE, 'signals');
          throw err;
        });
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Falha ao analisar imagem. Verifique se o gráfico está claro.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
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
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
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

      {!result ? (
        <div className="glass-card p-6 border-zinc-900 min-h-[300px] flex flex-col justify-center items-center group">
          {!preview ? (
            <div className="w-full flex flex-col gap-4 items-center justify-center">
              <div 
                {...getRootProps()} 
                className={cn(
                  "w-full flex flex-col items-center justify-center py-10 rounded-xl cursor-pointer transition-all duration-300 border border-transparent",
                  isDragActive ? "bg-brand-red/5 scale-[0.98] border-brand-red/30" : "hover:bg-zinc-800/20"
                )}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 bg-brand-gray rounded-xl flex items-center justify-center mb-4 border border-white/5 group-hover:border-brand-red/30 transition-colors">
                  <Upload size={24} className="text-zinc-600 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-base font-black uppercase italic tracking-tighter text-white mb-1 text-center px-4">Fazer Upload ou Arrastar</p>
                <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-center px-4">TradingView, MT4/MT5, cTrader</p>
              </div>

              <div className="flex gap-3 w-full">
                <label className="flex-1 bg-brand-dark border-2 border-white/5 text-white py-3.5 rounded-xl font-black text-xs hover:border-brand-red/50 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden group">
                  <Camera size={16} className="text-zinc-400 group-hover:text-brand-red transition-colors" />
                  <span className="whitespace-nowrap pt-0.5">TIRAR FOTO</span>
                  <input type="file" accept="image/*" capture="environment" className="opacity-0 absolute inset-0 cursor-pointer w-full h-full" onChange={(e) => {
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
            <div className="glass-card flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke="rgba(255,255,255,0.03)" 
                    strokeWidth="6"
                  />
                  <circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="6"
                    strokeDasharray={283}
                    strokeDashoffset={283 - (283 * result.score) / 100}
                    className={cn(
                      "transition-all duration-1000 ease-out",
                      result.decision === SignalType.BUY ? "text-green-500" : "text-brand-red"
                    )}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn(
                    "text-4xl font-black leading-none",
                    result.decision === SignalType.BUY ? "text-green-500" : "text-brand-red red-text-glow"
                  )}>
                    {result.score}%
                  </span>
                </div>
              </div>

              <div>
                <h3 className={cn(
                  "text-sm font-black uppercase tracking-wider italic",
                  result.score >= 80 
                    ? (result.decision === SignalType.BUY ? "text-green-500" : "text-brand-red red-text-glow") 
                    : result.score >= 60 ? "text-orange-500" : "text-zinc-500"
                )}>
                  {result.score >= 80 ? '🔥 ALTA PROBABILIDADE' : result.score >= 60 ? '⚖️ MÉDIA PROBABILIDADE' : '❌ EVITAR'}
                </h3>
                <p className="text-zinc-500 mt-1 text-[10px] font-medium max-w-[200px]">{result.justification}</p>
              </div>

              <div className="w-full pt-4 border-t border-white/5 flex gap-3">
                <div className="flex-1 glass-card p-2">
                  <span className="block text-[8px] text-zinc-600 uppercase font-black mb-0.5">PAR</span>
                  <span className="text-base font-black">{result.pair}</span>
                </div>
                <div className="flex-1 glass-card p-2">
                  <span className="block text-[8px] text-zinc-600 uppercase font-black mb-0.5">TF</span>
                  <span className="text-base font-black">{result.timeframe}</span>
                </div>
              </div>
            </div>

            {/* Trading Decision */}
            <div className="glass-card space-y-4">
              <div className={cn(
                "w-full py-5 rounded-lg flex flex-col items-center justify-center gap-1",
                result.decision === SignalType.BUY ? "bg-green-500/10 text-green-500" : 
                result.decision === SignalType.SELL ? "bg-brand-red/10 text-brand-red" : 
                "bg-zinc-500/10 text-zinc-500"
              )}>
                <span className="text-4xl font-black uppercase italic tracking-tighter">
                  {result.decision === SignalType.BUY ? 'COMPRAR' : 
                   result.decision === SignalType.SELL ? 'VENDER' : 
                   'AGUARDAR'}
                </span>
                <span className="text-[8px] uppercase font-black tracking-widest opacity-60">Status do Signal</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 glass-card bg-transparent border-white/5">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-zinc-600" />
                    <span className="text-[9px] font-black text-zinc-500 uppercase">ENTRADA</span>
                  </div>
                  <span className="font-mono font-black text-sm">{result.entry}</span>
                </div>
                <div className="flex items-center justify-between p-3 glass-card bg-transparent border-white/5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-brand-red/50" />
                    <span className="text-[9px] font-black text-zinc-500 uppercase">STOP LOSS</span>
                  </div>
                  <span className="font-mono font-black text-sm text-brand-red">{result.stopLoss}</span>
                </div>
                <div className="flex items-center justify-between p-3 glass-card bg-transparent border-white/5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-green-500/50" />
                    <span className="text-[9px] font-black text-zinc-500 uppercase">TAKE PROFIT</span>
                  </div>
                  <span className="font-mono font-black text-sm text-green-500">{result.takeProfit}</span>
                </div>
              </div>
            </div>
          </div>

          {/* New Institutional Analysis Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-red flex items-center gap-2">
                <Zap size={14} /> LIQUIDITY SWEEP + TRAP DETECTION
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                {result.liquiditySweep || 'Nenhum sweep relevante detectado.'}
              </p>
            </div>
            <div className="glass-card space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-green-500 flex items-center gap-2">
                <TrendingUp size={14} /> MOMENTUM + ENTRY TIMING
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                {result.momentum || 'Momentum neutro para este timeframe.'}
              </p>
            </div>
            <div className="glass-card space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Target size={14} /> ZONAS IMPORTANTES
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.keyZones?.map((zone, i) => (
                  <span key={i} className="px-2 py-1 bg-white/5 rounded text-[10px] font-bold text-zinc-300 border border-white/5 uppercase">
                    {zone}
                  </span>
                )) || <span className="text-xs text-zinc-500 italic">Identificando zonas...</span>}
              </div>
            </div>
            <div className="glass-card space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-red flex items-center gap-2">
                <BrainCircuit size={14} /> CONTEXTO INSTITUCIONAL
              </h4>
              <div className="flex items-center gap-3">
                {['Accumulation', 'Manipulation', 'Distribution'].map((stage) => (
                  <div 
                    key={stage}
                    className={cn(
                      "flex-1 py-2 text-center rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all",
                      result.institutionalContext === stage 
                        ? "bg-brand-red text-white shadow-[0_0_15px_rgba(255,0,0,0.3)]" 
                        : "bg-white/5 text-zinc-600 grayscale"
                    )}
                  >
                    {stage === 'Accumulation' ? 'Acumulação' : stage === 'Manipulation' ? 'Manipulação' : 'Distribuição'}
                  </div>
                ))}
              </div>
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

          {/* Detailed IA Analysis */}
          <div className="glass-card space-y-3">
            <h3 className="text-xs font-black flex items-center gap-2 uppercase italic tracking-wider">
              <TrendingUp size={14} className="text-brand-red" />
              IA Logic Check
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <span className="text-[8px] uppercase text-zinc-600 font-black block mb-1">Estrutura Dominante</span>
                 <p className="text-zinc-400 text-xs leading-relaxed font-medium">{result.structure}</p>
               </div>
               <div>
                 <span className="text-[8px] uppercase text-zinc-600 font-black block mb-1">Confluências</span>
                 <div className="flex flex-wrap gap-1.5">
                   {result.conceptsDetected.map((c, i) => (
                     <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-[9px] font-black text-zinc-400 border border-white/5 uppercase tracking-tighter">
                       {c}
                     </span>
                   ))}
                 </div>
               </div>
            </div>
          </div>

          <button 
            onClick={reset}
            className="w-full py-3 text-zinc-600 hover:text-white font-black text-xs uppercase tracking-widest transition-colors"
          >
            NOVO SCAN INSTITUCIONAL
          </button>
        </motion.div>
      )}
    </div>
  );
};
