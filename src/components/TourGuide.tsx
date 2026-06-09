import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export const TourGuide = ({ hasCompletedTour }: { hasCompletedTour?: boolean }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [show, setShow] = useState(false);
  const [positions, setPositions] = useState<Record<number, { top: number, left: number, width: number, height: number }>>({});

  const steps = [
    { target: '.tour-step-1', content: 'Bem-vindo ao QuantScan! Aqui é onde tudo acontece. Envie a foto de um gráfico para análise.', title: 'Análise por IA' },
    { target: '.tour-step-2', content: 'Escolha entre Análise Técnica, Fundamentalista ou Híbrida baseado em sua estratégia.', title: 'Tipo de Análise' },
    { target: '.tour-step-3', content: 'Defina seu Estilo de Trading (Scalping, Day Trading). A IA adapta o risco e alvos para você.', title: 'Estilo de Trading' },
    { target: '.tour-step-4', content: 'Navegue pelo menu para acessar a aba Histórico, Dashboard Elite e o Auto-Trading!', title: 'Menu Principal' }
  ];

  useEffect(() => {
    if (hasCompletedTour === false) {
      const timer = setTimeout(() => {
        setShow(true);
        measureTarget(0);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTour]);

  const measureTarget = (stepIndex: number) => {
    const el = document.querySelector(steps[stepIndex].target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPositions(prev => ({
        ...prev,
        [stepIndex]: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      }));
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(c => c + 1);
      setTimeout(() => measureTarget(currentStep + 1), 100);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setShow(false);
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          hasCompletedTour: true
        });
      } catch (error) {
        // ignore
      }
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (show) measureTarget(currentStep);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [show, currentStep]);

  if (!show || hasCompletedTour) return null;

  const pos = positions[currentStep];

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity duration-300" />
      
      {pos && (
        <div 
          className="absolute border-2 border-brand-red rounded-xl bg-transparent transition-all duration-500 ease-out z-[10001] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
          style={{ top: pos.top - 4, left: pos.left - 4, width: pos.width + 8, height: pos.height + 8 }}
        />
      )}

      <AnimatePresence mode="wait">
        {pos && (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="absolute z-[10002] bg-zinc-900 border border-white/10 rounded-xl p-5 shadow-2xl w-80 max-w-[90vw] pointer-events-auto"
            style={{
              top: pos.top + pos.height + 16 > window.innerHeight - 200 ? pos.top - 200 : pos.top + pos.height + 16,
              left: Math.max(16, Math.min(pos.left + pos.width / 2 - 160, window.innerWidth - 336))
            }}
          >
            <button onClick={handleFinish} className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
            <div className="flex flex-col gap-2 relative">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-red">Passo {currentStep + 1} de {steps.length}</span>
              <h3 className="font-bold text-white text-lg leading-tight">{steps[currentStep].title}</h3>
              <p className="text-sm text-zinc-400 mb-4">{steps[currentStep].content}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="flex gap-1">
                  {steps.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentStep ? 'w-4 bg-brand-red' : 'w-1.5 bg-zinc-700'}`} />
                  ))}
                </span>
                <button 
                  onClick={handleNext}
                  className="bg-brand-red hover:bg-brand-red/90 text-white px-4 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all"
                >
                  {currentStep === steps.length - 1 ? 'Concluir' : 'Próximo'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
