import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown } from 'lucide-react';

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'BTC/USD'];

export function LiveMarketTicker() {
  const [quotes, setQuotes] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const promises = PAIRS.map(symbol => 
          axios.get(`/api/twelve/quote?symbol=${symbol}`).catch(() => null)
        );
        const results = await Promise.all(promises);
        
        const newQuotes: Record<string, any> = {};
        results.forEach((res, index) => {
          if (res && res.data && !res.data.error) {
            newQuotes[PAIRS[index]] = res.data;
          }
        });
        
        setQuotes(newQuotes);
        setLoading(false);
      } catch (e: any) {
        console.error("Failed to fetch market data", e?.message || e);
        setLoading(false);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000); // 1 min update limit for free api generally
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="w-full bg-brand-dark border-y border-white/5 py-1 px-4 text-[10px] uppercase font-black tracking-widest text-zinc-500 overflow-hidden flex items-center gap-4">
        <span>Conectando ao mercado em tempo real...</span>
      </div>
    );
  }

  return (
    <div className="w-full bg-black/40 border-y border-white/5 py-1 overflow-hidden relative">
      <div className="flex animate-marquee whitespace-nowrap items-center gap-8">
        {PAIRS.map(pair => {
          const q = quotes[pair];
          if (!q) return null;
          
          const change = parseFloat(q.change);
          const isUp = change >= 0;
          
          return (
            <div key={pair} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className="text-zinc-400">{pair}</span>
              <span className="text-white">{parseFloat(q.close).toFixed(4)}</span>
              <span className={'flex items-center gap-0.5 ' + (isUp ? 'text-green-500' : 'text-brand-red')}>
                {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {change > 0 ? '+' : ''}{change} ({q.percent_change}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
