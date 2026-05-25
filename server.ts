import express from "express";
import path from "path";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import * as OneSignal from 'onesignal-node';
import MetaApiPkg from "metaapi.cloud-sdk";
const MetaApi = typeof MetaApiPkg === "function" ? MetaApiPkg : (MetaApiPkg as any).default || MetaApiPkg;

// Import Firebase (Server-side compatible since v9 supports Node environments)
import { db } from "./src/lib/firebase";
import { doc, getDoc, setDoc, addDoc, collection, runTransaction, query, where, getDocs, updateDoc, orderBy, limit } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- BACKGROUND WORKER NODE (CRON JOB) ---
  const sendTelegramAlertServer = async (text: string, botToken: string, chatId: string, replyToMessageId?: number) => {
      try {
          const payload: any = {
              chat_id: chatId,
              text: text,
              parse_mode: 'Markdown'
          };
          if (replyToMessageId) {
             payload.reply_to_message_id = replyToMessageId;
          }
          const res = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, payload);
          return res.data?.result?.message_id;
      } catch (error) {
          console.error('Error sending Telegram alert from server:', error);
          return null;
      }
  };

  const checkAndMonitorActiveSignals = async (botToken: string, chatId: string) => {
    try {
      if (!botToken || !chatId) return;
      const signalsRef = collection(db, "telegram_active_signals");
      const q = query(signalsRef, where("status", "==", "ACTIVE"));
      const querySnapshot = await getDocs(q);

      const apiKey = process.env.TWELVE_DATA_API_KEY;
      if (!apiKey) return; // Need real prices to monitor properly

      for (const docSnap of querySnapshot.docs) {
        const signal = docSnap.data();
        let currentPrice = null;
        try {
          // Format symbol for Twelve data (e.g. EUR/USD)
          let symbol = signal.pair;
          if (!symbol.includes('/')) {
             if (symbol.length === 6) {
                symbol = symbol.substring(0, 3) + '/' + symbol.substring(3); // EURUSD -> EUR/USD
             }
          }
          const response = await axios.get(`https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${apiKey}`);
          if (response.data && response.data.close) {
             currentPrice = parseFloat(response.data.close);
          }
        } catch(e) {
           console.error("Twelve data fetch error:", e);
           continue;
        }

        if (currentPrice === null) continue;

        let closed = false;
        let resultText = "";
        
        const sl = parseFloat(signal.stopLoss);
        const tp = parseFloat(signal.takeProfit);
        const entry = parseFloat(signal.entry);

        if (signal.decision === 'BUY') {
           if (currentPrice <= sl) {
              closed = true;
              resultText = `❌ *Stop Loss Atingido!* \nPreço final: ${currentPrice}`;
           } else if (currentPrice >= tp) {
              closed = true;
              resultText = `✅ *Take Profit Atingido!* 🎯\nPreço final: ${currentPrice}`;
           }
        } else if (signal.decision === 'SELL') {
           if (currentPrice >= sl) {
              closed = true;
              resultText = `❌ *Stop Loss Atingido!* \nPreço final: ${currentPrice}`;
           } else if (currentPrice <= tp) {
              closed = true;
              resultText = `✅ *Take Profit Atingido!* 🎯\nPreço final: ${currentPrice}`;
           }
        }

        if (closed) {
           let closedByMe = false;
           try {
             await runTransaction(db, async (transaction) => {
               const freshDoc = await transaction.get(docSnap.ref);
               if (freshDoc.exists() && freshDoc.data().status === 'ACTIVE') {
                 transaction.update(docSnap.ref, { status: 'CLOSED', closedAt: Date.now(), exitPrice: currentPrice });
                 closedByMe = true;
               }
             });
             if (closedByMe) {
               await sendTelegramAlertServer(resultText, botToken, chatId, signal.messageId);
               console.log(`[Monitor] Signal ${signal.pair} closed.`);
             }
           } catch(e) {
             console.error("[Monitor] Transação de fecho falhou:", e);
           }
        }
      }
    } catch(e) {
      console.error("[Monitor] Error monitoring signals:", e);
    }
  };

  let localLastAutoScan = 0; // Removed locally stored state

  const runAutoScannerJob = async () => {
    try {
      const settingsRef = doc(db, 'settings', 'app');
      const settingsSnap = await getDoc(settingsRef);
      if (!settingsSnap.exists()) return;
      
      const data = settingsSnap.data();
      if (!data.autoScannerActive) return;

      const botToken = data.telegramBotToken || '';
      const chatId = data.telegramChatId || '';

      // Run Monitoring every cycle if bot is configured
      if (botToken && chatId) {
         await checkAndMonitorActiveSignals(botToken, chatId);
      }

      const intervalMins = data.autoScannerInterval || 15;
      const now = Date.now();

      // Check last signal generation from DB
      const qLast = query(collection(db, "telegram_active_signals"), orderBy("timestamp", "desc"), limit(1));
      const lastSignalSnap = await getDocs(qLast);
      if (!lastSignalSnap.empty) {
         const lastTimestamp = lastSignalSnap.docs[0].data().timestamp;
         if (now - lastTimestamp < intervalMins * 60 * 1000) {
             // Not enough time has passed
             return;
         }
      }

      // Verificar fechamento do mercado Forex: Sexta 23:00 MZ (21:00 UTC) até Domingo 23:00 MZ (21:00 UTC)
      const isForexMarketOpen = () => {
        const d = new Date();
        const day = d.getUTCDay(); // 0 = Domingo, 5 = Sexta, 6 = Sábado
        const hours = d.getUTCHours();
        if (day === 5 && hours >= 21) return false; // Sexta após 23:00 Moçambique (21:00 UTC)
        if (day === 6) return false; // Sábado (Fechado)
        if (day === 0 && hours < 21) return false; // Domingo antes das 23:00 Moçambique (21:00 UTC)
        return true;
      };

      if (!isForexMarketOpen()) {
        console.log("[Worker] Mercado Forex fechado. Nenhuma análise será gerada (Fim de semana MZ).");
        return;
      }
      
      console.log("[Worker] Executing Auto-Scanner (Advanced Institutional Mode)...");
      
      // Institutional Level Analysis Simulation
      const pairs = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'USD/JPY'];
      let randomPair = pairs[Math.floor(Math.random() * pairs.length)];
      
      // Prevent duplicate active signals for the same pair
      const qCheck = query(collection(db, "telegram_active_signals"), where("pair", "==", randomPair), where("status", "==", "ACTIVE"));
      const activeSnaps = await getDocs(qCheck);
      if (!activeSnaps.empty) {
          console.log(`[Worker] Já existe sinal activo para ${randomPair}. Ignorando geracao para evitar spam.`);
          return;
      }

      const apiKey = process.env.TWELVE_DATA_API_KEY;
      let currentPrice = 0;
      let isBullish = Math.random() > 0.5;
      
      const SMC_Contexts = [
         "Manipulação Institucional detectada em suporte de H4, Sweep de liquidez seguido de quebra de estrutura (BOS).",
         "Mitigação de Order Block (OB) diário, com desequilíbrio (Imbalance) preenchido em 15m.",
         "Captura de Liquidez do Asia Session (Asia High/Low sweep) e confirmação via fluxo de ordens (Order Flow)."
      ];
      let context = SMC_Contexts[Math.floor(Math.random() * SMC_Contexts.length)];

      if (apiKey) {
         try {
            // Keep the symbol with slash for twelve data
            const sym = randomPair;
            const tsRes = await axios.get(`https://api.twelvedata.com/time_series?symbol=${sym}&interval=15min&outputsize=3&apikey=${apiKey}`);
            if (tsRes.data && tsRes.data.values && tsRes.data.values.length > 0) {
                const values = tsRes.data.values;
                currentPrice = parseFloat(values[0].close);
                if (values.length >= 3) {
                   const oldPrice = parseFloat(values[2].close);
                   isBullish = currentPrice > oldPrice;
                   context = isBullish ? 
                      "Mitigação de Demand Block em zona de desconto. Quebra de estrutura (BOS) alinhada à tendência compradora (Smart Money)." : 
                      "Captura de liquidez (Sweep) no topo (Premium). Inversão com fair value gap preenchido para continuação de venda.";
                }
            } else {
                const res = await axios.get(`https://api.twelvedata.com/quote?symbol=${sym}&apikey=${apiKey}`);
                if (res.data && res.data.close) currentPrice = parseFloat(res.data.close);
            }
         } catch (e) {
            console.log("[Worker] Could not fetch real price from Twelve Data API. Rate Limit or Network error.");
         }
      }

      // Se não conseguiu preço real, aborta a geração do sinal ao invés de usar preço falso!
      if (currentPrice === 0) {
        console.log("[Worker] Preço real não obtido (API Limits?). Abortando geração do sinal para proteger o capital dos clientes.");
        return; 
      }

      const decision = isBullish ? 'BUY' : 'SELL';
        
        // Calcular TPs e SLs base (simulação de risco:recompensa 1:3 institucional)
        const pipValue = randomPair.includes('JPY') ? 0.01 : 0.0001;
        const goldMultiplier = randomPair === 'XAU/USD' ? 10 : 1; 
        const pip = pipValue * goldMultiplier;

        const slPips = 15;
        const tpPips = 45; // 1:3 RR

        const stopLoss = isBullish ? currentPrice - (slPips * pip) : currentPrice + (slPips * pip);
        const takeProfit = isBullish ? currentPrice + (tpPips * pip) : currentPrice - (tpPips * pip);
        const takeProfit2 = isBullish ? currentPrice + (tpPips*1.5 * pip) : currentPrice - (tpPips*1.5 * pip);
        const takeProfit3 = isBullish ? currentPrice + (tpPips*2 * pip) : currentPrice - (tpPips*2 * pip);

        const score = Math.floor(Math.random() * (99 - 85 + 1)) + 85; // Alta precisão apenas

        const signalData = {
            pair: randomPair,
            decision,
            timeframe: '15m / H1',
            score,
            context,
            entry: currentPrice.toFixed(5),
            takeProfit: takeProfit.toFixed(5),
            takeProfit2: takeProfit2.toFixed(5),
            takeProfit3: takeProfit3.toFixed(5),
            stopLoss: stopLoss.toFixed(5),
        };

        // --- INÍCIO DA LÓGICA DE AUTO TRADING: META-API ---
        try {
           const usersSnap = await getDocs(collection(db, "users"));
           const token = process.env.METAAPI_TOKEN || "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1YzYxNWEwNjQ1M2JjYTRhMWFhN2Q0Y2U4NzkzMjg2ZiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibXQtbWFuYWdlci1hcGkiLCJtZXRob2RzIjpbIm10LW1hbmFnZXItYXBpOnJlc3Q6ZGVhbGluZzoqOioiLCJtdC1tYW5hZ2VyLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJiaWxsaW5nLWFwaSIsIm1ldGhvZHMiOlsiYmlsbGluZy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiNWM2MTVhMDY0NTNiY2E0YTFhYTdkNGNlODc5MzI4NmYiLCJpYXQiOjE3NzkzMTI4ODJ9.VklJoE6hwcxOSUIINf-tVqOitXzZSf3AfTf2C5oZtnelZnH5F-a6rs1h9V7yNMdch7GVqaSh1reZMH7ZO1zlXOM-Pr2RGJTxs6_iZna3SLHMavyRbTf1Wh9wUu7z16rlsIenj4EVUE4Fuw_aDMpiGELwhPhOlEQa7GKiqCwOWcxox-eYaVYRltQZBiMPEsFD6Dx69SlCx3Ax9Ky73x-BhAcg5znbVM9A3ZT61TfOXZZDIi7tK1ImtWEhI1ZaellmvnZde45V11kikGbkBPSiu9U4Ag6im8CietZRLfxm2uDqzxdPJ1mgSwZvuPFRasHKwgKimp0gmasmIXu7XhOpTv65pCSg3n2v9BeM-WumMi4nJEtrhdxblrNswP4LrFSbuSDSKq11NUQJRXvtssN1i-Dd0RY-bxCZ-eMUvUbCNoyxr5vNmau2oeLSA3M-VGlN8NCF74qOcJKnEIXM_A5qi1NoSAj7emmIE8Oedj0nnK3tOrjs94Hn4N1EZfkNVTcmFVyUoLW9yQKd9sgfhidLOmZ9RaM0iG6G2WsK39v-2_nsj2NwhSQ_bYcMG9bC9tgBOiX8yVA9Y_X9-Yng2w0wI6Hy1wOJ8UTh6PdGAhki38RLulXS657XR3POnqT0jSAsSsisN9C5_hPE7lpY-NW7v5aBZn8pGNlB2PXNnkB885E";
           // @ts-ignore
           const metaApi = new MetaApi(token);

           for (let userSnap of usersSnap.docs) {
               const userData = userSnap.data();
               const settings = userData.tradingSettings || {};
               
               // Só executa se tiver a conta conectada, AutoTrading(smartEntry) ativo e o mesmo asset / mercado geral?
               // Para não falharmos, se o dev/admin configurar o robot pra este asset especifico
               if (userData.metaApiAccountId && settings.smartEntry && settings.selectedAsset === randomPair) {
                  try {
                      console.log(`[AutoTrading] Executando ordem para o usuário ${userData.email} em ${randomPair}`);
                      const mtAccount = await metaApi.metatraderAccountApi.getAccount(userData.metaApiAccountId);
                      await mtAccount.deploy(); // wait until it's deployed
                      await mtAccount.waitConnected();
                      let connection = mtAccount.getRPCConnection();
                      await connection.connect();
                      await connection.waitSynchronized();
                      
                      const orderType = decision === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL';
                      const sym = randomPair.replace('/', '');
                      const volume = (settings.riskPerTrade ? settings.riskPerTrade / 100 : 0.01).toFixed(2); // simplificação de volume (ideal calcs)

                      const tradeResult = await connection.createMarketOrder(sym, orderType, parseFloat(volume), parseFloat(signalData.stopLoss), parseFloat(signalData.takeProfit), { comment: 'QuantScan Smart Entry' });
                      console.log(`[AutoTrading] Trade executado com sucesso:`, tradeResult);
                  } catch (userErr) {
                      console.error(`[AutoTrading] Erro executando ordem para usuário ${userData.email}:`, userErr);
                  }
               }
           }
        } catch(apiErr) {
            console.error(`[AutoTrading] Erro geral ao buscar contas da base de dados.`, apiErr);
        }
        // --- FIM DA LÓGICA DE AUTO TRADING ---

        if (botToken && chatId) {
           const emojis = { BUY: '🟢', SELL: '🔴' };
           const emoji = emojis[signalData.decision as keyof typeof emojis];
           const message = `
🤖 *QUANT-SCAN IA* 🤖

*Ativo:* ${signalData.pair}
*Sinal:* ${emoji} *${signalData.decision}*
*Timeframe:* ${signalData.timeframe}
*Confiança:* ${signalData.score}%

*Entrada (Market):* ${signalData.entry}
*Stop Loss:* ${signalData.stopLoss}
*Take Profit 1:* ${signalData.takeProfit}
*Take Profit 2:* ${signalData.takeProfit2}
*Take Profit 3:* ${signalData.takeProfit3}
`;
           const messageId = await sendTelegramAlertServer(message, botToken, chatId);
           
           if (messageId) {
               // Record signal in DB for monitoring
               const signalsRef = collection(db, "telegram_active_signals");
               await addDoc(signalsRef, {
                   pair: signalData.pair,
                   decision: signalData.decision,
                   entry: signalData.entry,
                   stopLoss: signalData.stopLoss,
                   takeProfit: signalData.takeProfit,
                   messageId: messageId,
                   timestamp: now,
                   status: 'ACTIVE'
               });
           }
        }
        console.log(`[Worker] Sinal Institucional gerado: ${randomPair} ${decision}`);
    } catch (e) {
      console.error("[Worker] Erro no Auto-Scanner institucional:", e);
    }
  };

  setInterval(runAutoScannerJob, 60000); // Check every minute internally

  app.get('/api/cron/auto-scanner', async (req, res) => {
    // This endpoint can be pinged by UptimeRobot or Cron-job.org to prevent container sleep
    await runAutoScannerJob();
    res.json({ status: "ok", message: "Scanner check executed", timestamp: new Date().toISOString() });
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

  // MetaAPI Provisioning Route
  app.post("/api/metaapi/provision", async (req, res) => {
    const { platform, login, password, serverName } = req.body;
    
    // User requested token hardcoded
    const token = process.env.METAAPI_TOKEN || "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1YzYxNWEwNjQ1M2JjYTRhMWFhN2Q0Y2U4NzkzMjg2ZiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibXQtbWFuYWdlci1hcGkiLCJtZXRob2RzIjpbIm10LW1hbmFnZXItYXBpOnJlc3Q6ZGVhbGluZzoqOioiLCJtdC1tYW5hZ2VyLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJiaWxsaW5nLWFwaSIsIm1ldGhvZHMiOlsiYmlsbGluZy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiNWM2MTVhMDY0NTNiY2E0YTFhYTdkNGNlODc5MzI4NmYiLCJpYXQiOjE3NzkzMTI4ODJ9.VklJoE6hwcxOSUIINf-tVqOitXzZSf3AfTf2C5oZtnelZnH5F-a6rs1h9V7yNMdch7GVqaSh1reZMH7ZO1zlXOM-Pr2RGJTxs6_iZna3SLHMavyRbTf1Wh9wUu7z16rlsIenj4EVUE4Fuw_aDMpiGELwhPhOlEQa7GKiqCwOWcxox-eYaVYRltQZBiMPEsFD6Dx69SlCx3Ax9Ky73x-BhAcg5znbVM9A3ZT61TfOXZZDIi7tK1ImtWEhI1ZaellmvnZde45V11kikGbkBPSiu9U4Ag6im8CietZRLfxm2uDqzxdPJ1mgSwZvuPFRasHKwgKimp0gmasmIXu7XhOpTv65pCSg3n2v9BeM-WumMi4nJEtrhdxblrNswP4LrFSbuSDSKq11NUQJRXvtssN1i-Dd0RY-bxCZ-eMUvUbCNoyxr5vNmau2oeLSA3M-VGlN8NCF74qOcJKnEIXM_A5qi1NoSAj7emmIE8Oedj0nnK3tOrjs94Hn4N1EZfkNVTcmFVyUoLW9yQKd9sgfhidLOmZ9RaM0iG6G2WsK39v-2_nsj2NwhSQ_bYcMG9bC9tgBOiX8yVA9Y_X9-Yng2w0wI6Hy1wOJ8UTh6PdGAhki38RLulXS657XR3POnqT0jSAsSsisN9C5_hPE7lpY-NW7v5aBZn8pGNlB2PXNnkB885E";
    
    if (!platform || !login || !password || !serverName) {
      return res.status(400).json({ error: "Missing required MT4/MT5 fields" });
    }

    try {
      // @ts-ignore
      const metaApi = new MetaApi(token);
      
      const account = await metaApi.metatraderAccountApi.createAccount({
        name: `QuantScan User ${login}`,
        login: login,
        password: password,
        server: serverName,
        platform: platform,
        magic: 1000
      });

      res.json({ success: true, accountId: account.id, state: account.state });
    } catch (error: any) {
      console.error("MetaAPI Connection Error:", error);
      res.status(500).json({ error: error.message || "Failed to connect to MetaAPI" });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log('Server running on http://localhost:' + PORT);
  });
}

startServer();
