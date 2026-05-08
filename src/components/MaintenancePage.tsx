import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, RefreshCw, Activity } from 'lucide-react';

interface MaintenancePageProps {
  message?: string;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({ message }) => {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/-4 left-1/4 w-96 h-96 bg-brand-red/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-red/5 rounded-full blur-[120px]" />
      </div>
      
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-xl w-full flex flex-col items-center text-center"
      >
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-brand-red/20 blur-xl rounded-full" />
          <div className="w-24 h-24 bg-black border border-brand-red/30 rounded-2xl flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-red/20 to-transparent" />
            <Activity className="text-brand-red w-10 h-10 animate-pulse" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-4 text-white uppercase drop-shadow-sm">
          SISTEMA EM <span className="text-brand-red">MANUTENÇÃO</span>
        </h1>
        
        <p className="text-zinc-400 text-lg md:text-xl font-medium mb-8 max-w-md mx-auto">
          {message || 'Estamos realizando atualizações e melhorias no QuantScan IA. Voltaremos em breve com o sistema operando em capacidade máxima.'}
        </p>

        <div className="glass-card w-full p-6 bg-black/40 border border-brand-red/10 flex flex-col items-center">
          <div className="flex items-center gap-3 text-brand-red mb-3">
            <ShieldAlert size={20} />
            <span className="font-black text-xs tracking-widest uppercase">Status do Servidor Offline</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 mb-2 overflow-hidden">
            <div className="bg-brand-red h-full w-full rounded-full animate-pulse" style={{ animationDuration: '2s' }} />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Aguardando reconexão institucional</p>
        </div>
        
        <button 
          onClick={() => window.location.reload()}
          className="mt-10 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
        >
          <RefreshCw size={14} />
          Tentar Novamente
        </button>
      </motion.div>
    </div>
  );
};
