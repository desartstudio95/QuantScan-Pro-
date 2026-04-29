import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TickerItem {
  symbol: string;
  price: string;
  change: string;
  isUp: boolean;
}

export const MarketTicker: React.FC = () => {
  const [items, setItems] = useState<TickerItem[]>([
    { symbol: 'EURUSD', price: '1.08542', change: '+0.12%', isUp: true },
    { symbol: 'GBPUSD', price: '1.26410', change: '-0.05%', isUp: false },
    { symbol: 'USDJPY', price: '151.420', change: '+0.25%', isUp: true },
    { symbol: 'XAUUSD', price: '2345.12', change: '+0.84%', isUp: true },
    { symbol: 'BTCUSD', price: '64240.5', change: '-1.20%', isUp: false },
    { symbol: 'NAS100', price: '18240.2', change: '+0.45%', isUp: true },
    { symbol: 'AUDUSD', price: '0.65120', change: '+0.08%', isUp: true },
    { symbol: 'USDCAD', price: '1.35410', change: '-0.02%', isUp: false },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setItems(prev => prev.map(item => {
        const changeVal = (Math.random() * 0.0002) - 0.0001;
        const newPrice = parseFloat(item.price) + parseFloat(item.price) * changeVal;
        return {
          ...item,
          price: newPrice.toFixed(item.symbol.includes('JPY') ? 3 : 5)
        };
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-brand-dark/50 border-y border-white/5 py-2 overflow-hidden select-none">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...items, ...items].map((item, idx) => (
          <div key={`${item.symbol}-${idx}`} className="flex items-center gap-6 px-8 border-r border-white/5 last:border-r-0">
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">{item.symbol}</span>
            <span className="text-xs font-mono font-bold tabular-nums text-white">{item.price}</span>
            <div className={`flex items-center gap-1 text-[10px] font-black ${item.isUp ? 'text-green-500' : 'text-brand-red'}`}>
              {item.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {item.change}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
