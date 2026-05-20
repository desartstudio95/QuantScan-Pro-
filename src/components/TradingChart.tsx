import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import { fetchChartData } from '../services/marketData';
import { Signal, SignalType } from '../types';
import { Loader2 } from 'lucide-react';

interface TradingChartProps {
  signal: Signal;
}

export const TradingChart: React.FC<TradingChartProps> = ({ signal }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    let active = true;

    const initChart = async () => {
      setLoading(true);
      try {
        const data = await fetchChartData(signal.pair);
        if (!active) return;

        if (data && data.length > 0 && chartContainerRef.current) {
          const chart = createChart(chartContainerRef.current, {
            layout: {
              background: { type: ColorType.Solid, color: 'transparent' },
              textColor: '#d4d4d8', // zinc-300
            },
            grid: {
              vertLines: { color: 'rgba(255, 255, 255, 0)' },
              horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 350,
            timeScale: {
              timeVisible: true,
              secondsVisible: false,
            },
            crosshair: {
               mode: 0,
            }
          });

          const mainSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e', // green-500
            downColor: '#ef4444', // red-500
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
          });

          // Filter out duplicates directly with lightweight-charts requirement (strictly ascending)
          const uniqueData = data.reduce((acc: any[], curr) => {
             if (acc.length === 0 || curr.time > acc[acc.length - 1].time) {
                 acc.push(curr);
             }
             return acc;
          }, []);

          mainSeries.setData(uniqueData);

          const entry = parseFloat(signal.entry.replace(/[^0-9.]/g, ''));
          const sl = parseFloat(signal.stopLoss.replace(/[^0-9.]/g, ''));
          const tp1 = parseFloat(signal.takeProfit.replace(/[^0-9.]/g, ''));
          const tp2 = signal.takeProfit2 ? parseFloat(signal.takeProfit2.replace(/[^0-9.]/g, '')) : null;
          const tp3 = signal.takeProfit3 ? parseFloat(signal.takeProfit3.replace(/[^0-9.]/g, '')) : null;

          if (!isNaN(entry)) {
            mainSeries.createPriceLine({ price: entry, color: '#3b82f6', lineWidth: 2, lineStyle: 0, title: 'Entry' });
          }
          if (!isNaN(sl)) {
            mainSeries.createPriceLine({ price: sl, color: '#ef4444', lineWidth: 2, lineStyle: 2, title: 'SL' });
          }
          if (!isNaN(tp1)) {
            mainSeries.createPriceLine({ price: tp1, color: '#22c55e', lineWidth: 2, lineStyle: 2, title: 'TP1' });
          }
          if (tp2 && !isNaN(tp2)) {
            mainSeries.createPriceLine({ price: tp2, color: '#22c55e', lineWidth: 1, lineStyle: 3, title: 'TP2' });
          }
          if (tp3 && !isNaN(tp3)) {
            mainSeries.createPriceLine({ price: tp3, color: '#22c55e', lineWidth: 1, lineStyle: 3, title: 'TP3' });
          }

          chart.timeScale().fitContent();

          chartRef.current = chart;
          seriesRef.current = mainSeries;
        }
      } catch (e) {
        console.error("Failed to load chart", e);
      } finally {
        if (active) setLoading(false);
      }
    };

    initChart();

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      active = false;
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [signal.pair]);

  return (
    <div className="w-full h-[350px] bg-brand-gray/30 rounded-xl border border-white/5 relative overflow-hidden flex items-center justify-center">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <Loader2 className="animate-spin text-brand-red mb-4" size={24} />
          <span className="text-zinc-400 font-bold ml-2">A carregar gráfico...</span>
        </div>
      )}
      <div ref={chartContainerRef} className="w-full h-full" />
      {!loading && !chartRef.current && (
         <div className="text-zinc-500 font-bold text-sm">Dados de gráfico não disponíveis para este ativo.</div>
      )}
    </div>
  );
};
