import express from "express";
import path from "path";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import * as OneSignal from 'onesignal-node';

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log('Server running on http://localhost:' + PORT);
  });
}

startServer();
