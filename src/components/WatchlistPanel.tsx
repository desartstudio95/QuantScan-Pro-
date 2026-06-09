import React, { useState, useEffect } from 'react';
import { fetchCurrentPrice } from '../services/marketData';
import { Star, Plus, X, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const WatchlistPanel: React.FC = () => {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('quantscan_watchlist');
    return saved ? JSON.parse(saved) : ['XAU/USD', 'BTC/USDT'];
  });
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [previousPrices, setPreviousPrices] = useState<Record<string, number>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newPair, setNewPair] = useState('');

  useEffect(() => {
    localStorage.setItem('quantscan_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    if (watchlist.length === 0) return;

    let isMounted = true;
    
    const updatePrices = async () => {
      const results = await Promise.all(
        watchlist.map(async (pair) => {
          const price = await fetchCurrentPrice(pair);
          return { pair, price };
        })
      );

      if (isMounted) {
        setPreviousPrices(prev => ({ ...prev, ...prices }));
        const newPrices: Record<string, number> = {};
        results.forEach(({ pair, price }) => {
          if (price !== null) newPrices[pair] = price;
        });
        setPrices(prev => ({ ...prev, ...newPrices }));
      }
    };

    updatePrices();
    const interval = setInterval(updatePrices, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [watchlist]);

  const addPair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPair) return;
    const pairToAdd = newPair.toUpperCase().trim();
    if (!watchlist.includes(pairToAdd)) {
      setWatchlist(prev => [...prev, pairToAdd]);
    }
    setNewPair('');
    setIsAdding(false);
  };

  const removePair = (pairToRemove: string) => {
    setWatchlist(prev => prev.filter(p => p !== pairToRemove));
  };

  return (
    <div className="w-full glass-card p-4 space-y-4 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
          <Star size={14} className="text-yellow-500" /> Watchlist Favoritos
        </h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="p-1 hover:bg-white/10 rounded transition-colors text-zinc-500 hover:text-white"
        >
          {isAdding ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={addPair}
            className="flex gap-2 overflow-hidden"
          >
            <input 
              type="text" 
              placeholder="Ex: EUR/USD, BOOM1000"
              value={newPair}
              onChange={(e) => setNewPair(e.target.value)}
              className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-brand-red"
            />
            <button type="submit" className="bg-brand-red text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-brand-red/90 transition-all">
              Add
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar rounded-lg">
        {watchlist.length === 0 && (
           <p className="text-zinc-600 text-[10px] font-bold uppercase w-full text-center py-2">Nenhum ativo adicionado.</p>
        )}
        {watchlist.map((pair) => {
          const price = prices[pair];
          const prevPrice = previousPrices[pair];
          const isUp = price && prevPrice ? price > prevPrice : true;
          const isDown = price && prevPrice ? price < prevPrice : false;
          
          return (
            <div key={pair} className="flex-shrink-0 bg-black/40 border border-white/5 p-3 rounded-lg flex flex-col gap-1 min-w-[120px] relative group h-[64px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black text-zinc-400">{pair}</span>
                <button 
                  onClick={() => removePair(pair)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-white/10 rounded text-zinc-500 absolute top-2 right-2"
                >
                  <X size={10} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-auto">
                {price !== undefined ? (
                  <>
                    <span className={cn(
                      "text-sm font-black font-mono transition-colors duration-500",
                      isUp ? "text-green-500" : isDown ? "text-brand-red" : "text-white"
                    )}>
                      {price > 100 ? price.toFixed(2) : price.toFixed(5)}
                    </span>
                    {(isUp || isDown) && (
                      <Activity size={10} className={isUp ? "text-green-500" : "text-brand-red"} />
                    )}
                  </>
                ) : (
                  <span className="text-xs font-mono text-zinc-600 animate-pulse">---</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
