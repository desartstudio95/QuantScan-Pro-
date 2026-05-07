import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TickerItem {
  symbol: string;
  price: string;
  change: string;
  isUp: boolean;
}

const BINANCE_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'EURUSDT',
  'GBPUSDT',
  'AUDUSDT',
  'BNBUSDT',
  'XRPUSDT',
];

export const MarketTicker: React.FC = () => {
  const [items, setItems] = useState<TickerItem[]>(
    BINANCE_SYMBOLS.map(sym => ({
      symbol: sym.replace('USDT', ''),
      price: '...',
      change: '...',
      isUp: true
    }))
  );

  useEffect(() => {
    const streams = BINANCE_SYMBOLS.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data && data.s && data.c && data.P) {
        setItems(prev => {
          const newItems = [...prev];
          const index = newItems.findIndex(item => item.symbol === data.s.replace('USDT', ''));
          if (index !== -1) {
            const currentPrice = parseFloat(data.c);
            const priceChangePercent = parseFloat(data.P);
            newItems[index] = {
              ...newItems[index],
              price: currentPrice >= 1 ? currentPrice.toFixed(2) : currentPrice.toFixed(4),
              change: `${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`,
              isUp: priceChangePercent >= 0
            };
          }
          return newItems;
        });
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="w-full bg-brand-dark/50 border-y border-white/5 py-2 overflow-hidden select-none">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...items, ...items, ...items].map((item, idx) => (
          <div key={`${item.symbol}-${idx}`} className="flex items-center gap-6 px-8 border-r border-white/5 last:border-r-0">
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">{item.symbol}</span>
            <span className="text-xs font-mono font-bold tabular-nums text-white">{item.price}</span>
            <div className={`flex items-center gap-1 text-[10px] font-black ${item.change !== '...' ? (item.isUp ? 'text-green-500' : 'text-brand-red') : 'text-zinc-500'}`}>
              {item.change !== '...' && (item.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
              {item.change}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
