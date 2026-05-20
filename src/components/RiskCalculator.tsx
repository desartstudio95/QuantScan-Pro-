import React, { useState } from 'react';
import { Signal, SignalType } from '../types';
import { Calculator } from 'lucide-react';

interface RiskCalculatorProps {
  signal: Signal;
}

export const RiskCalculator: React.FC<RiskCalculatorProps> = ({ signal }) => {
  const [balance, setBalance] = useState<string>('500');
  const [riskPercent, setRiskPercent] = useState<string>('2');

  const entry = parseFloat(signal.entry.replace(/[^0-9.]/g, ''));
  const sl = parseFloat(signal.stopLoss.replace(/[^0-9.]/g, ''));

  let lotSize = null;
  let riskAmount = null;
  let slPips = null;

  if (!isNaN(entry) && !isNaN(sl) && parseFloat(balance) > 0 && parseFloat(riskPercent) > 0) {
    const bal = parseFloat(balance);
    const risk = parseFloat(riskPercent);
    riskAmount = bal * (risk / 100);

    const priceDiff = Math.abs(entry - sl);
    
    // Simplistic Pip calculation - assumes standard forex pairs (usually 4th decimal for non-JPY, 2nd for JPY)
    // For Crypto, it's point diff. For Deriv indices it's points.
    // Let's use generic point value or just raw price difference and assume standard contract size 100,000 for calculation or let the user know it's a generic point value
    // To give a useful "Lot Size" across mixed assets is tricky without knowing contract size. 
    // We will show Risk Amount and a generic "Units to Trade".
    slPips = priceDiff; 

    // RiskAmount = Units * PriceDiff
    // Units = RiskAmount / PriceDiff
    if (priceDiff > 0) {
       const units = riskAmount / priceDiff;
       // For standard forex lot (100,000 units), lot size = units / 100k
       // But keeping it generic: "Unidades"
       lotSize = units;
    }
  }

  return (
    <div className="bg-brand-gray/30 p-4 rounded-xl border border-white/5 space-y-4">
      <div className="flex items-center gap-2 text-brand-red font-black uppercase text-sm">
        <Calculator size={16} />
        <span>Calculadora de Risco</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] text-zinc-500 font-black uppercase block mb-1">Banca ($)</label>
          <input 
            type="number" 
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full bg-brand-dark/50 border border-white/5 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-black uppercase block mb-1">Risco (%)</label>
          <input 
            type="number" 
            value={riskPercent}
            onChange={(e) => setRiskPercent(e.target.value)}
            className="w-full bg-brand-dark/50 border border-white/5 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
        {riskAmount !== null && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-400">Valor em Risco:</span>
            <span className="font-bold text-brand-red">${riskAmount.toFixed(2)}</span>
          </div>
        )}
        {slPips !== null && slPips > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-400">Distância SL:</span>
            <span className="font-bold text-zinc-300">{slPips.toFixed(5)}</span>
          </div>
        )}
        {lotSize !== null && lotSize > 0 && (
          <div className="flex justify-between items-center text-sm p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
             <span className="text-blue-500 font-bold">Unidades / Lote Ideal:</span>
             <span className="font-black text-white">{lotSize.toFixed(4)} Unidades</span>
          </div>
        )}
        {lotSize !== null && lotSize > 0 && (
          <p className="text-[10px] text-zinc-500 mt-1 leading-tight text-right">
             *O valor real de lot pode variar consoante a corretora e ativo (contratos por lote).
          </p>
        )}
      </div>
    </div>
  );
};
