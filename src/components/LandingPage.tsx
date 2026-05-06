import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, ShieldCheck, Zap, BarChart3, Globe, ChevronRight, CheckCircle2 } from 'lucide-react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MarketTicker } from './MarketTicker';
import { AddTestimonialForm } from './AddTestimonialForm';

interface LandingPageProps {
  onGetStarted: () => void;
  onViewPlans: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onViewPlans }) => {
  const [testimonials, setTestimonials] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'testimonials'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTestimonials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Testimonials fetch error:", error);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-brand-dark text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 glass-card bg-brand-dark/80 rounded-none border-t-0 border-x-0 border-b border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="https://i.ibb.co/9BwbV3M/FXBROS-WORLD-3.png" 
              alt="Logo" 
              className="w-12 h-12 object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="font-black italic text-2xl tracking-tighter uppercase">
              QUANT<span className="text-brand-red">SCAN</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button 
              onClick={onViewPlans}
              className="text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
            >
              Planos
            </button>
            <button 
              onClick={onGetStarted}
              className="bg-brand-red hover:bg-brand-red/90 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 flex items-center gap-2"
            >
              Acessar Agora <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex md:hidden items-center gap-3">
            <button 
              onClick={onViewPlans}
              className="text-[10px] font-black uppercase tracking-widest text-zinc-400"
            >
              Planos
            </button>
            <button 
              onClick={onGetStarted}
              className="bg-brand-red hover:bg-brand-red/90 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2"
            >
              Acessar <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* Market Ticker */}
      <div className="fixed top-[65px] w-full z-40">
        <MarketTicker />
      </div>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 min-h-screen flex items-center">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://i.ibb.co/VcJRM0zZ/90a0c129-b771-41d6-ad30-634d1d2546c4.png" 
            alt="Forex Background" 
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/60 via-brand-dark/40 to-brand-dark" />
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-red/10 border border-brand-red/20 text-brand-red text-xs font-black uppercase tracking-widest">
              <Zap size={14} /> Inteligência Institucional
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter leading-[0.9] uppercase">
              REVELE A <span className="text-brand-red">LIQUIDEZ</span> <br />
              DAS INSTITUIÇÕES.
            </h1>
            <p className="text-base md:text-lg max-w-xl font-medium leading-relaxed">
              Scanner de Forex baseado em IA avançada que identifica padrões de alta probabilidade em segundos. Pare de ser a liquidez do mercado.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                onClick={onGetStarted}
                className="bg-white text-brand-dark px-10 py-4 rounded-xl font-black text-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-3"
              >
                TESTAR SCANNER <ChevronRight size={20} />
              </button>
              <button 
                onClick={onViewPlans}
                className="bg-zinc-900 border border-white/10 text-white px-10 py-4 rounded-xl font-black text-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-3"
              >
                VER PLANOS
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-brand-red/20 blur-[100px] rounded-full" />
            <div className="glass-card p-4 border-zinc-800 relative z-10 overflow-hidden">
               <img 
                 src="https://i.ibb.co/TB4yz3GP/Chat-GPT-Image-25-de-abr-de-2026-03-58-37.png" 
                 alt="Trading Chart Analysis" 
                 className="rounded-xl opacity-80 h-[400px] w-full object-cover transition-all duration-700"
                 referrerPolicy="no-referrer"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent flex flex-col justify-end p-8">
                  <div className="glass-card p-4 translate-y-4 max-w-xs border-brand-red/30">
                     <p className="text-xs font-bold text-brand-red uppercase mb-1">IA DETECTADA:</p>
                     <p className="text-sm font-black">Bullish Order Block H1</p>
                     <div className="flex gap-2 mt-3">
                        <div className="h-1 flex-1 bg-brand-red rounded-full" />
                        <div className="h-1 flex-1 bg-brand-red/20 rounded-full" />
                        <div className="h-1 flex-1 bg-brand-red/20 rounded-full" />
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-zinc-950/50">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">
              TECNOLOGIA DE <span className="text-brand-red">PRÓXIMA GERAÇÃO</span>
            </h2>
            <div className="w-16 h-1 bg-brand-red mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: "Análise Automática",
                desc: "Nossa IA identifica quebras de estrutura e mudanças de comportamento do mercado instantaneamente."
              },
              {
                icon: ShieldCheck,
                title: "Probability Score",
                desc: "Cada setup recebe uma pontuação de 0-100% baseada em confluências institucionais reais."
              },
              {
                icon: Globe,
                title: "Qualquer Ativo",
                desc: "Pares de Forex, Índices, Cripto ou Commodities. Se tem gráfico, nossa IA analisa."
              }
            ].map((feature, i) => (
              <div key={i} className="glass-card p-6 border-zinc-800 hover:border-brand-red/30 transition-colors group">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-brand-red/10 transition-colors">
                  <feature.icon className="text-zinc-500 group-hover:text-brand-red transition-colors" />
                </div>
                <h3 className="text-lg font-black uppercase mb-3 ">{feature.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof Section */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="glass-card p-12 overflow-hidden relative">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase leading-none">
                PARE DE ADIVINHAR.<br />
                COMECE A <span className="text-brand-red">QUANTIFICAR</span>.
              </h3>
              <ul className="space-y-3">
                {[
                  "Análise em tempo real de fluxos e vácuos",
                  "Detecção de zonas de Oferta & Procura",
                  "Histórico adaptativo para aprendizado de sinais",
                  "Interface otimizada profissional"
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-400 font-medium text-xs md:text-sm">
                    <CheckCircle2 className="text-brand-red shrink-0" size={16} />
                    {text}
                  </li>
                ))}
              </ul>
              <button 
                onClick={onViewPlans}
                className="bg-brand-red text-white px-8 py-4 rounded-xl font-black hover:bg-brand-red/90 transition-all flex items-center gap-3"
              >
                LIBERAR MEU ACESSO <ChevronRight size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-4">
                  <div className="glass-card p-6 text-center border-white/5">
                    <p className="text-3xl font-black text-brand-red">90%</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Precisão média</p>
                  </div>
                  <div className="glass-card p-6 text-center border-white/5">
                    <p className="text-3xl font-black">24/7</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Monitoramento</p>
                  </div>
               </div>
               <div className="space-y-4 pt-8">
                  <div className="glass-card p-6 text-center border-white/5">
                    <p className="text-3xl font-black text-white">PRO</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Estratégia Foco</p>
                  </div>
                  <div className="glass-card p-6 text-center border-white/5">
                    <p className="text-3xl font-black text-white">IA</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Adaptativa</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Info Section - IA QuantScanner */}
      <section className="py-20 px-6 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto space-y-12 text-center md:text-left">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-white">
              IA <span className="text-brand-red">QuantScanner</span>: <br className="hidden md:block" /> O Futuro do Mercado.
            </h2>
            <p className="text-zinc-400 text-lg">
              O **IA QuantScanner** é uma ferramenta avançada baseada em Inteligência Artificial desenvolvida 
              para analisar o mercado financeiro em tempo real, com foco especial em **Forex, índices e criptomoedas**.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <h4 className="font-black uppercase tracking-widest text-brand-red">📊 ANÁLISE</h4>
              <p className="text-sm text-zinc-500">Técnica automatizada que identifica padrões, suportes e resistências.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-black uppercase tracking-widest text-brand-red">🤖 IA</h4>
              <p className="text-sm text-zinc-500">Aprende continuamente com dados históricos e comportamento do mercado.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-black uppercase tracking-widest text-brand-red">⏱️ MONITORAMENTO</h4>
              <p className="text-sm text-zinc-500">Escaneia múltiplos ativos 24/7 para detectar oportunidades instantâneas.</p>
            </div>
          </div>

          <div className="glass-card p-8 border-brand-red/10 space-y-4">
            <h3 className="font-black uppercase text-xl">Resultados</h3>
            {testimonials.length > 0 ? (
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-4 scrollbar-none">
                {testimonials.map((t, i) => (
                  <div key={i} className="space-y-4 shrink-0 snap-center w-[85vw] md:w-[40vw] max-w-sm glass-card p-4">
                    {t.imageUrls && t.imageUrls.length > 0 && (
                      <div className="flex overflow-x-auto snap-x snap-mandatory gap-2 pb-2 scrollbar-none">
                        {t.imageUrls.map((url: string, index: number) => (
                          <img key={index} src={url} alt={`Resultado ${index}`} className="w-full shrink-0 snap-center rounded-lg object-contain bg-black/20" referrerPolicy="no-referrer" />
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-zinc-300"><em>"{t.text}"</em> <br/><span className="text-brand-red/80 font-bold uppercase mt-2 block">– {t.userName.split('@')[0]}</span></p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">Nenhum resultado postado ainda.</p>
            )}
          </div>
          <AddTestimonialForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center">
        <div className="max-w-7xl mx-auto px-6 space-y-6">
           <div className="flex items-center justify-center gap-2">
            <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <span className="font-black italic text-xl tracking-tighter uppercase">
              QUANT<span className="text-brand-red">SCAN</span>
            </span>
          </div>
          <p className="text-zinc-600 text-xs max-w-lg mx-auto">
            Aviso Legal: Negociar no mercado Forex envolve riscos elevados. Os sinais gerados pela IA são apenas para fins informativos e não constituem aconselhamento financeiro.
          </p>
          <div className="text-zinc-800 text-[10px] font-bold uppercase tracking-[0.2em]">
            © 2026 QUANT SCAN AI - TODOS OS DIREITOS RESERVADOS
          </div>
        </div>
      </footer>
    </div>
  );
};
