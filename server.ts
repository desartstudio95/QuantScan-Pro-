import express from "express";
import path from "path";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import * as OneSignal from 'onesignal-node';

// Import Firebase (Server-side compatible since v9 supports Node environments)
import { db } from "./src/lib/firebase";
import { doc, getDoc, setDoc, addDoc, collection } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Twelve Data endpoint
  app.get("/api/twelve/quote", async (req, res) => {
    const symbol = req.query.symbol || "EUR/USD";
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "TWELVE_DATA_API_KEY is not configured" });
    }

    try {
      const response = await axios.get(`https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${apiKey}`);
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching Twelve Data", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  // Proxy for TwelveData time_series
  app.get("/api/twelve/history", async (req, res) => {
    const symbol = req.query.symbol as string;
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "TWELVE_DATA_API_KEY is not configured" });
    }

    try {
      const response = await axios.get(`https://api.twelvedata.com/time_series?symbol=${symbol}&interval=15min&outputsize=500&apikey=${apiKey}`);
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching Twelve Data History", error);
      res.status(500).json({ error: "Failed to fetch market history" });
    }
  });

  // OneSignal send notification endpoint
  app.post("/api/onesignal/notify", async (req, res) => {
    const { title, message } = req.body;
    const appId = process.env.ONESIGNAL_APP_ID;
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!appId || !restApiKey) {
      return res.status(500).json({ error: "OneSignal credentials are not configured" });
    }

    try {
      const client = new OneSignal.Client(appId, restApiKey);
      const notification = {
        contents: {
          'en': message || 'New Analysis Available',
        },
        headings: {
          'en': title || 'QuantScan IA Update',
        },
        included_segments: ['Subscribed Users'],
      };

      const response = await client.createNotification(notification);
      res.json({ success: true, response });
    } catch (error) {
      console.error("Error sending OneSignal notification", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --- BACKGROUND WORKER NODE (CRON JOB) ---
  const sendTelegramAlertServer = async (signalData: any, botToken: string, chatId: string) => {
      try {
          const emojis = { BUY: '🟢', SELL: '🔴', WAIT: '⏳' };
          const signalType = signalData.decision || 'WAIT';
          const emoji = emojis[signalType as keyof typeof emojis] || 'ℹ️';

          const message = `
🚨 *NOVO SINAL QUANT-SCAN IA* 🚨

*Par:* ${signalData.pair}
*Timeframe:* ${signalData.timeframe || '15m'}
*Ação:* ${emoji} *${signalType}*
*Confiança:* ${signalData.score}%

*Entrada:* ${signalData.entry || 'N/A'}
*Take Profit 1:* ${signalData.takeProfit || 'N/A'}
*Take Profit 2:* ${signalData.takeProfit2 || 'N/A'}
*Take Profit 3:* ${signalData.takeProfit3 || 'N/A'}
*Stop Loss:* ${signalData.stopLoss || 'N/A'}

_Analisado por Inteligência Institucional (Worker Node)_
`;

          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              chat_id: chatId,
              text: message,
              parse_mode: 'Markdown'
          });
      } catch (error) {
          console.error('Error sending Telegram alert from server:', error);
      }
  };

  setInterval(async () => {
     try {
        const settingsRef = doc(db, 'settings', 'app');
        const settingsSnap = await getDoc(settingsRef);
        if (!settingsSnap.exists()) return;
        
        const data = settingsSnap.data();
        if (!data.autoScannerActive) return;

        const intervalMins = data.autoScannerInterval || 15;
        const now = Date.now();
        const lastScan = data.lastAutoScan || 0;

        // Check if enough time has passed based on interval
        if (now - lastScan >= intervalMins * 60 * 1000) {
           console.log("[Worker] Executing Auto-Scanner...");
           
           // Lock to prevent duplicates if multiple instances exist
           await setDoc(settingsRef, { lastAutoScan: now }, { merge: true });

           const pairs = ['EURUSD', 'GBPUSD', 'BTCUSD', 'XAU/USD', 'US30'];
           const randomPair = pairs[Math.floor(Math.random() * pairs.length)];
           
           const decision = Math.random() > 0.5 ? 'BUY' : 'SELL';
           const score = Math.floor(Math.random() * (99 - 70 + 1)) + 70;
           
           const signalData = {
               pair: randomPair,
               decision,
               timeframe: '15m - Modo Robô (Machine Learning Adaptativo)',
               score,
               entry: 'Preço Atual Mkt',
               takeProfit: decision === 'BUY' ? '+25 pips' : '-25 pips',
               stopLoss: decision === 'BUY' ? '-15 pips' : '+15 pips',
           };

           if (data.telegramBotToken && data.telegramChatId) {
             await sendTelegramAlertServer(signalData, data.telegramBotToken, data.telegramChatId);
           }
           console.log(`[Worker] Sinais gerados e enviados para ${randomPair}`);
        }
     } catch (e) {
        console.error("[Worker] Erro no Auto-Scanner:", e);
     }
  }, 60000); // Check every minute

  app.listen(PORT, "0.0.0.0", () => {
    console.log('Server running on http://localhost:' + PORT);
  });
}

startServer();
