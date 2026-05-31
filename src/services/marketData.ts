import axios from 'axios';

import { Signal } from '../types';

export const getDerivSymbol = (pair: string): string | null => {
  if (!pair) return null;
  const p = pair.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (p.includes('BOOM1000')) return 'BOOM1000';
  if (p.includes('BOOM500')) return 'BOOM500';
  if (p.includes('BOOM300')) return 'BOOM300';
  if (p.includes('CRASH1000')) return 'CRASH1000';
  if (p.includes('CRASH500')) return 'CRASH500';
  if (p.includes('CRASH300')) return 'CRASH300';
  if (p.includes('STEP')) return 'STEPINX';
  if (p.includes('VOLATILITY751S') || p.includes('V751S')) return '1HZ75V';
  if (p.includes('VOLATILITY101S') || p.includes('V101S')) return '1HZ10V';
  if (p.includes('VOLATILITY251S') || p.includes('V251S')) return '1HZ25V';
  if (p.includes('VOLATILITY501S') || p.includes('V501S')) return '1HZ50V';
  if (p.includes('VOLATILITY1001S') || p.includes('V1001S')) return '1HZ100V';
  if (p.includes('VOLATILITY2001S') || p.includes('V2001S')) return '1HZ200V';
  if (p.includes('VOLATILITY3001S') || p.includes('V3001S')) return '1HZ300V';
  if (p.includes('VOLATILITY10') || p.includes('V10')) return 'R_10';
  if (p.includes('VOLATILITY25') || p.includes('V25')) return 'R_25';
  if (p.includes('VOLATILITY50') || p.includes('V50')) return 'R_50';
  if (p.includes('VOLATILITY75') || p.includes('V75')) return 'R_75';
  if (p.includes('VOLATILITY100') || p.includes('V100')) return 'R_100';
  if (p.includes('JUMP10')) return 'JD10';
  if (p.includes('JUMP25')) return 'JD25';
  if (p.includes('JUMP50')) return 'JD50';
  if (p.includes('JUMP75')) return 'JD75';
  if (p.includes('JUMP100')) return 'JD100';
  return null;
};

export const checkHistoricalSignalResult = async (signal: Signal): Promise<string | null> => {
  const reqSymbol = signal.pair.trim().toUpperCase();
  const derivSymbol = getDerivSymbol(reqSymbol);
  
  const tp1 = parseFloat(signal.takeProfit.replace(/[^0-9.]/g, ''));
  const tp2 = signal.takeProfit2 ? parseFloat(signal.takeProfit2.replace(/[^0-9.]/g, '')) : null;
  const tp3 = signal.takeProfit3 ? parseFloat(signal.takeProfit3.replace(/[^0-9.]/g, '')) : null;
  const sl = parseFloat(signal.stopLoss.replace(/[^0-9.]/g, ''));
  
  if (isNaN(tp1) || isNaN(sl)) return null;

  try {
    // 1. Crypto Binance
    const isCrypto = reqSymbol.includes('BTC') || reqSymbol.includes('ETH') || reqSymbol.includes('USDT') || reqSymbol.includes('BNB');
    if (isCrypto) {
      const binanceSymbol = reqSymbol.replace(/[^A-Z0-9]/g, '');
      const startTime = signal.timestamp;
      const response = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=15m&startTime=${startTime}`);
      
      if (response.data && Array.isArray(response.data)) {
        for (const candle of response.data) {
          const high = parseFloat(candle[2]);
          const low = parseFloat(candle[3]);
          
          if (signal.type === 'BUY') {
            if (tp3 && high >= tp3) return 'Take Profit 3';
            if (tp2 && high >= tp2) return 'Take Profit 2';
            if (high >= tp1) return 'Take Profit 1';
            if (low <= sl) return 'LOSS';
          } else {
            if (tp3 && low <= tp3) return 'Take Profit 3';
            if (tp2 && low <= tp2) return 'Take Profit 2';
            if (low <= tp1) return 'Take Profit 1';
            if (high >= sl) return 'LOSS';
          }
        }
      }
      return null; // Not hit yet
    }
    
    // 2. Deriv Historical
    if (derivSymbol) {
       return new Promise((resolve) => {
        try {
          const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
          ws.onopen = () => {
            ws.send(JSON.stringify({ 
              ticks_history: derivSymbol,
              adjust_start_time: 1,
              count: 5000,
              end: "latest",
              start: Math.floor(signal.timestamp / 1000),
              style: "candles",
              granularity: 60 // 1 minute
            }));
          };
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.candles) {
              for (const candle of data.candles) {
                const high = candle.high;
                const low = candle.low;
                if (signal.type === 'BUY') {
                  if (tp3 && high >= tp3) { resolve('Take Profit 3'); ws.close(); return; }
                  if (tp2 && high >= tp2) { resolve('Take Profit 2'); ws.close(); return; }
                  if (high >= tp1) { resolve('Take Profit 1'); ws.close(); return; }
                  if (low <= sl) { resolve('LOSS'); ws.close(); return; }
                } else {
                  if (tp3 && low <= tp3) { resolve('Take Profit 3'); ws.close(); return; }
                  if (tp2 && low <= tp2) { resolve('Take Profit 2'); ws.close(); return; }
                  if (low <= tp1) { resolve('Take Profit 1'); ws.close(); return; }
                  if (high >= sl) { resolve('LOSS'); ws.close(); return; }
                }
              }
              resolve(null);
              ws.close();
            } else if (data.error) {
               resolve(null);
               ws.close();
            }
          };
          ws.onerror = () => { resolve(null); };
          setTimeout(() => { if (ws.readyState !== WebSocket.CLOSED) { ws.close(); resolve(null); } }, 5000);
        } catch (e) { resolve(null); }
      });
    }

    // 3. Forex/TwelveData (if time_series is supported on free tier, usually it is for interval=15min)
    let twelveSymbol = reqSymbol;
    if (twelveSymbol === 'GOLD' || twelveSymbol === 'OURO') twelveSymbol = 'XAU/USD';
    if (twelveSymbol === 'SILVER' || twelveSymbol === 'PRATA') twelveSymbol = 'XAG/USD';
    
    const response = await axios.get(`/api/twelve/history?symbol=${twelveSymbol}`);
    if (response.data && response.data.values && Array.isArray(response.data.values)) {
       // TwelveData returns newest first. We need to iterate from oldest (after signal start) to newest.
       const values = [...response.data.values].reverse();
       for (const candle of values) {
          const candleTime = new Date(candle.datetime).getTime();
          // Skip candles before signal was created
          if (candleTime < signal.timestamp - 15 * 60 * 1000) continue;

          const high = parseFloat(candle.high);
          const low = parseFloat(candle.low);
          
          if (signal.type === 'BUY') {
            if (tp3 && high >= tp3) return 'Take Profit 3';
            if (tp2 && high >= tp2) return 'Take Profit 2';
            if (high >= tp1) return 'Take Profit 1';
            if (low <= sl) return 'LOSS';
          } else {
            if (tp3 && low <= tp3) return 'Take Profit 3';
            if (tp2 && low <= tp2) return 'Take Profit 2';
            if (low <= tp1) return 'Take Profit 1';
            if (high >= sl) return 'LOSS';
          }
       }
    }
  } catch (e: any) {
    console.error("Historical check error:", e.message);
  }
  return null;
};

export const fetchChartData = async (symbol: string): Promise<{ time: number, open: number, high: number, low: number, close: number }[] | null> => {
  const reqSymbol = symbol.trim().toUpperCase();
  const derivSymbol = getDerivSymbol(reqSymbol);
  
  try {
    const isCrypto = reqSymbol.includes('BTC') || reqSymbol.includes('ETH') || reqSymbol.includes('USDT') || reqSymbol.includes('BNB');
    if (isCrypto) {
      const binanceSymbol = reqSymbol.replace(/[^A-Z0-9]/g, '');
      const response = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=15m&limit=200`);
      if (response.data && Array.isArray(response.data)) {
        return response.data.map((candle: any) => ({
          time: Math.floor(candle[0] / 1000), // Original is ms, we need s
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4])
        }));
      }
    }

    if (derivSymbol) {
       return new Promise((resolve) => {
        try {
          const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
          ws.onopen = () => {
            ws.send(JSON.stringify({ 
              ticks_history: derivSymbol,
              adjust_start_time: 1,
              count: 200,
              end: "latest",
              style: "candles",
              granularity: 900 // 15 min
            }));
          };
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.candles) {
              const formatted = data.candles.map((c: any) => ({
                time: c.epoch,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
              }));
              resolve(formatted);
              ws.close();
            } else {
               resolve(null);
               ws.close();
            }
          };
          ws.onerror = () => resolve(null);
          setTimeout(() => { if (ws.readyState !== WebSocket.CLOSED) { ws.close(); resolve(null); } }, 5000);
        } catch (e) { resolve(null); }
      });
    }

    let twelveSymbol = reqSymbol;
    if (twelveSymbol === 'GOLD' || twelveSymbol === 'OURO') twelveSymbol = 'XAU/USD';
    if (twelveSymbol === 'SILVER' || twelveSymbol === 'PRATA') twelveSymbol = 'XAG/USD';
    
    const response = await axios.get(`/api/twelve/history?symbol=${twelveSymbol}`);
    if (response.data && response.data.values && Array.isArray(response.data.values)) {
        const values = [...response.data.values].reverse();
        return values.map((candle: any) => ({
          time: Math.floor(new Date(candle.datetime).getTime() / 1000),
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close)
        }));
    }
  } catch (e: any) {
    console.warn("Error fetching chart data:", e.message);
  }
  return null;
};

export const fetchCurrentPrice = async (symbol: string): Promise<number | null> => {
  const derivSymbol = getDerivSymbol(symbol);
  
  if (derivSymbol) {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        ws.onopen = () => {
          ws.send(JSON.stringify({ ticks: derivSymbol }));
        };
        ws.onmessage = (msg) => {
          const data = JSON.parse(msg.data);
          if (data.tick) {
            resolve(data.tick.quote);
            ws.close();
          } else if (data.error) {
             console.error("Deriv WS Error:", data.error);
             resolve(null);
             ws.close();
          }
        };
        ws.onerror = () => {
          resolve(null);
        };
        setTimeout(() => {
          if (ws.readyState !== WebSocket.CLOSED) {
             ws.close();
             resolve(null);
          }
        }, 5000);
      } catch (e) {
        resolve(null);
      }
    });
  }

  let reqSymbol = symbol.trim().toUpperCase();
  if (reqSymbol === 'GOLD' || reqSymbol === 'OURO') reqSymbol = 'XAU/USD';
  if (reqSymbol === 'SILVER' || reqSymbol === 'PRATA') reqSymbol = 'XAG/USD';
  
  // Basic check for Crypto to use Binance, KuCoin or OKX (no auth needed, high limits)
  const isCrypto = reqSymbol.includes('BTC') || reqSymbol.includes('ETH') || reqSymbol.includes('USDT') || reqSymbol.includes('BNB');
  if (isCrypto) {
    const cryptoSymbol = reqSymbol.replace(/[^A-Z0-9]/g, ''); // Convert BTC/USDT to BTCUSDT
    
    // 1. Try Binance
    try {
      const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${cryptoSymbol}`);
      if (response.data && response.data.price) {
        const price = parseFloat(response.data.price);
        if (!isNaN(price)) return price;
      }
    } catch (e) {
      console.warn("Binance API failed, trying KuCoin...");
    }

    // 2. Try KuCoin
    try {
      // KuCoin uses hyphenated symbols like BTC-USDT
      const kucoinSymbol = reqSymbol.replace('/', '-').toUpperCase();
      const response = await axios.get(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${kucoinSymbol}`);
      if (response.data && response.data.data && response.data.data.price) {
        const price = parseFloat(response.data.data.price);
        if (!isNaN(price)) return price;
      }
    } catch (e) {
      console.warn("KuCoin API failed, trying OKX...");
    }

    // 3. Try OKX
    try {
      const okxSymbol = reqSymbol.replace('/', '-').toUpperCase();
      const response = await axios.get(`https://www.okx.com/api/v5/market/ticker?instId=${okxSymbol}`);
      if (response.data && response.data.data && response.data.data.length > 0 && response.data.data[0].last) {
        const price = parseFloat(response.data.data[0].last);
        if (!isNaN(price)) return price;
      }
    } catch (e) {
      console.warn("OKX API failed.");
    }
  }

  try {
    const response = await axios.get(`/api/twelve/quote?symbol=${reqSymbol}`);
    if (response.data && response.data.close) {
      const price = parseFloat(response.data.close);
      if (!isNaN(price)) return price;
    }
  } catch (e: any) {
    console.error("Error fetching TWELVE DATA price:", e.message);
  }
  
  return null;
};
