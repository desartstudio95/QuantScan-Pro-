import React, { useEffect, useRef } from 'react';
import { motion, animate } from 'motion/react';
import { 
  Check, 
  Zap, 
  ShieldCheck, 
  BarChart3, 
  BrainCircuit, 
  History, 
  UserPlus, 
  Sparkles,
  ArrowRight,
  Target,
  Trophy,
  Users
} from 'lucide-react';
import { cn } from '../lib/utils';

// Animated Counter Component
const AnimatedCounter = ({ from, to, suffix = "", prefix = "", decimal = false, duration = 2 }: { from: number, to: number, suffix?: string, prefix?: string, decimal?: boolean, duration?: number }) => {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      const controls = animate(from, to, {
        duration,
        ease: "easeOut",
        onUpdate(value) {
          const formattedValue = decimal ? value.toFixed(1) : Math.round(value).toString();
          node.textContent = `${prefix}${formattedValue}${suffix}`;
        }
      });
      return () => controls.stop();
    }
  }, [from, to, suffix, prefix, duration, decimal]);

  return <span ref={nodeRef}>{prefix}{from}{suffix}</span>;
};

interface PlansViewProps {
  isUnauthenticated?: boolean;
  onGetStarted?: () => void;
  onBack?: () => void;
}

const PlanCard = ({ 
  title, 
  price, 
  description, 
  features, 
  buttonText, 
  highlight = false,
  badge = "",
  onClick
}: { 
  title: string; 
  price: string; 
  description: string; 
  features: string[]; 
  buttonText: string;
  highlight?: boolean;
  badge?: string;
  onClick?: () => void;
}) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className={cn(
      "relative glass-card flex flex-col h-full overflow-hidden transition-all duration-500",
      highlight ? "border-brand-red/40 bg-brand-red/5 ring-1 ring-brand-red/20 shadow-[0_0_40px_-15px_rgba(255,0,0,0.2)]" : "border-white/5"
    )}
  >
    {badge && (
      <div className="absolute top-0 right-0">
        <div className="bg-brand-red text-white text-[9px] font-black uppercase py-1 px-4 tracking-[0.2em] transform rotate-45 translate-x-[35%] translate-y-[50%] shadow-lg">
          {badge}
        </div>
      </div>
    )}

    <div className="p-6 space-y-4">
      <div className="space-y-1">
        <h3 className={cn("text-xs font-black uppercase tracking-widest", highlight ? "text-brand-red" : "text-zinc-500")}>
          {title}
        </h3>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black italic tracking-tighter text-white">{price}</span>
          <span className="text-zinc-500 text-xs font-medium">{title !== "Plano Free" ? "/ mês" : ""}</span>
        </div>
        <p className="text-xs text-zinc-400 font-medium leading-relaxed">{description}</p>
      </div>

      <div className="space-y-3 pt-4 border-t border-white/5">
        {features.map((feature, idx) => (
          <div key={idx} className="flex items-start gap-3 group">
            <div className={cn(
              "mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors",
              highlight ? "bg-brand-red/20 text-brand-red" : "bg-white/5 text-zinc-600"
            )}>
              <Check size={10} strokeWidth={3} />
            </div>
            <span className="text-xs text-zinc-300 font-medium group-hover:text-white transition-colors">{feature}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="p-6 mt-auto">
      <button 
        onClick={onClick}
        className={cn(
          "w-full py-3 rounded-xl font-black uppercase tracking-tighter text-sm flex items-center justify-center gap-2 transition-all active:scale-95",
          highlight 
            ? "bg-brand-red text-white hover:bg-brand-red/90 red-glow" 
            : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
        )}
      >
        {buttonText}
        <ArrowRight size={16} />
      </button>
    </div>
  </motion.div>
);

export const PlansView: React.FC<PlansViewProps> = ({ isUnauthenticated, onGetStarted, onBack }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const handleAction = () => {
    if (isUnauthenticated && onGetStarted) {
      onGetStarted();
    } else {
      // Handle payment or subscription logic for logged in users
      window.open('https://wa.me/258840000000?text=Ol%C3%A1%2C%20gostaria%20de%20assinar%20o%20plano%20do%20QuantScan', '_blank');
    }
  };

  return (
    <div className={cn("relative min-h-screen space-y-16 pb-20", isUnauthenticated && "max-w-7xl mx-auto px-6 py-12")}>
      {/* Background Image requested by user */}
      <div className="fixed inset-0 -z-30 pointer-events-none">
        <img 
          src="https://i.ibb.co/M5DzNvR1/Chat-GPT-Image-28-de-abr-de-2026-12-48-30.png" 
          alt="Background" 
          className="w-full h-full object-cover opacity-80"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-brand-dark/20" /> {/* Slight overlay for readability */}
      </div>

      {isUnauthenticated && (
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest relative z-10"
        >
          <ArrowRight size={16} className="rotate-180" /> Voltar
        </button>
      )}

      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden rounded-[2.5rem] py-20 px-8 text-center space-y-6">
        {/* Background Image for this specific section */}
        <div className="absolute inset-0 -z-10">
          <img 
          src="https://i.ibb.co/M5DzNvR1/Chat-GPT-Image-28-de-abr-de-2026-12-48-30.png" 
          alt="Hero Background" 
          className="w-full h-full object-cover opacity-80"
          referrerPolicy="no-referrer"
        />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-dark via-transparent to-brand-dark" />
          <div className="absolute inset-0 bg-brand-red/5" />
        </div>
        
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.6 }}
           className="space-y-4 relative z-10"
        >
          <div className="flex justify-center mb-6">
            <img 
              src="https://i.ibb.co/9BwbV3M/FXBROS-WORLD-3.png" 
              alt="Logo" 
              className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,0,0,0.3)] shadow-red-500/20"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="relative inline-block px-4 py-1.5 rounded-full overflow-hidden border border-brand-red/30 text-[10px] font-black text-white uppercase tracking-widest mb-4 shadow-lg">
            <div className="absolute inset-0 -z-10">
              <img 
                src="https://i.ibb.co/M5DzNvR1/Chat-GPT-Image-28-de-abr-de-2026-12-48-30.png" 
                alt="" 
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-brand-red/20" />
            </div>
            Acesso Premium Pro Logic
          </span>
          <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white leading-[0.9]">
            Transforme análise em decisão.<br />
            <span className="text-brand-red">Pro Logic em lucro.</span>
          </h1>
          <p className="text-zinc-400 text-sm md:text-lg max-w-xl mx-auto font-medium leading-relaxed">
            IA que analisa gráficos e entrega sinais com probabilidade real. Pare de adivinhar cada trade.
          </p>
        </motion.div>
      </section>

      {/* 2. BENEFÍCIOS PRINCIPAIS - Re-added for the plan page context */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { icon: Target, title: "Score real", desc: "0-100% precisão" },
          { icon: BrainCircuit, title: "PRO Logic", desc: "Fluxo Pro" },
          { icon: Sparkles, title: "Scan Visual", desc: "Por Imagem" },
          { icon: Zap, title: "Adaptativa", desc: "IA que aprende" },
          { icon: History, title: "Backtest", desc: "Histórico Full" },
          { icon: ShieldCheck, title: "High Prob", desc: "Sinais Elite" },
        ].map((benefit, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card flex flex-col items-center text-center p-4 group hover:border-brand-red/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-brand-red group-hover:bg-brand-red/10 transition-all mb-3">
              <benefit.icon size={20} />
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-1">{benefit.title}</h4>
            <p className="text-[9px] font-medium text-zinc-500 uppercase">{benefit.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* 3. PLANOS */}
      <section id="planos" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PlanCard 
          title="Plano Begin"
          price="500 MZN"
          description="Para quem está começando e quer testar a potência da nossa IA."
          buttonText="Assinar Agora"
          onClick={handleAction}
          features={[
            "8 análises por dia",
            "Score básico de probabilidade",
            "Suporte a Timeframes maiores",
            "Sem histórico completo",
            "Sem aprendizado personalizado"
          ]}
        />
        <PlanCard 
          title="Plano Pro"
          price="1.500 MZN"
          description="O plano mais popular para traders que buscam consistência real."
          buttonText="Assinar Agora"
          highlight={true}
          badge="Recomendado"
          onClick={handleAction}
          features={[
            "15 análises por dia",
            "Score avançado de alta precisão",
            "Detecção automática de timeframe",
            "Histórico completo de sinais",
            "IA adaptativa (aprende com resultados)",
            "Sinais com alta probabilidade",
            "Suporte priorizado"
          ]}
        />
        <PlanCard 
          title="Plano Elite"
          price="3.000 MZN"
          description="Acesso total às ferramentas de nível institucional."
          buttonText="Ser Elite"
          onClick={handleAction}
          features={[
            "Análises ilimitadas",
            "Tudo do plano PRO",
            "Prioridade total de processamento",
            "Insights institucionais avançados",
            "Estratégias exclusivas (PRO Logic)",
            "Gerenciamento de risco acoplado",
            "Suporte VIP via WhatsApp"
          ]}
        />
      </section>

      {/* 4. COMPARAÇÃO DE PLANOS */}
      <section className="space-y-8">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white text-center">Tabela Comparativa</h2>
        <div className="glass-card overflow-hidden !p-0 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left border-collapse">
            <thead>
              <tr className="bg-white/5 font-black uppercase italic text-[10px] tracking-widest text-zinc-400">
                <th className="p-4 border-b border-white/5">Funcionalidade</th>
                <th className="p-4 border-b border-white/5 text-center">Begin</th>
                <th className="p-4 border-b border-white/5 text-center text-brand-red">Pro</th>
                <th className="p-4 border-b border-white/5 text-center">Elite</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium text-zinc-300">
              {[
                { label: "Nº de Análises", free: "8 / dia", pro: "15 / dia", elite: "Ilimitado" },
                { label: "Score de Probabilidade", free: "Básico", pro: "Avançado", elite: "Avançado+" },
                { label: "IA Adaptativa", free: "Não", pro: "Sim", elite: "Sim" },
                { label: "Histórico de Sinais", free: "Limitado", pro: "Completo", elite: "Completo" },
                { label: "Suporte", free: "Comunidade", pro: "Prioritário", elite: "VIP Individual" },
                { label: "Processamento", free: "Normal", pro: "Rápido", elite: "Ultra Prioridade" },
              ].map((row, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold text-white">{row.label}</td>
                  <td className="p-4 text-center text-zinc-500">{row.free}</td>
                  <td className="p-4 text-center font-bold text-white">{row.pro}</td>
                  <td className="p-4 text-center text-zinc-300">{row.elite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. PROVA SOCIAL */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 py-10 border-y border-white/5 relative z-10">
        <div className="text-center space-y-2">
          <div className="text-4xl font-black text-white italic tracking-tighter">
            <AnimatedCounter from={0} to={1000} prefix="+" duration={2.5} />
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-red">Análises realizadas</div>
        </div>
        <div className="text-center space-y-2">
          <div className="text-4xl font-black text-white italic tracking-tighter">
            <AnimatedCounter from={0} to={90} suffix="%" duration={2.5} />
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-red">Taxa média de acerto</div>
        </div>
        <div className="text-center space-y-2">
          <div className="text-4xl font-black text-white italic tracking-tighter">
            <AnimatedCounter from={10} to={1.2} suffix="s" decimal={true} duration={2.5} />
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-red">Tempo de resposta IA</div>
        </div>
      </section>

      {/* 6. FINAL CTA */}
      <section className="relative overflow-hidden rounded-[2rem] bg-brand-red p-8 md:p-16 text-center text-white space-y-6">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/10 blur-[80px] rounded-full" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 bg-black/10 blur-[60px] rounded-full" />
        
        <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight relative z-10">
          Pare de adivinhar.<br />
          Comece a decidir com dados.
        </h2>
        
        <div className="pt-4 relative z-10">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAction}
            className="bg-white text-brand-red px-12 py-4 rounded-2xl font-black text-lg uppercase tracking-tighter shadow-2xl hover:shadow-white/20 transition-all flex items-center gap-3 mx-auto"
          >
            Começar Agora
            <ArrowRight size={24} />
          </motion.button>
        </div>
      </section>
    </div>
  );
};
