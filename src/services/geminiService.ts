import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse, SignalType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const analyzeForexChart = async (imageBase64: string, userNotes?: string, preferredMode?: 'Técnico' | 'Fundamental' | 'Híbrido', userPlan?: string): Promise<AnalysisResponse> => {
  const model = 'gemini-3.1-pro-preview';
  
  const systemInstruction = `
# QUANTSCAN IA — MODO MULTI TIME FRAME + LONG TERM ANALYSIS

Você é o QUANTSCAN IA, um sistema profissional avançado de análise Forex, Índices, Commodities e Criptomoedas baseado em Inteligência Artificial institucional.

Plano do Usuário Atual: ${userPlan || 'basic'}

Sua função é analisar gráficos enviados pelo usuário através de: screenshot do gráfico, foto da tela, imagem do TradingView, imagem MT4/MT5 ou corretoras.

O sistema deve operar em dois modos:
1. SHORT TERM / SCALPING
2. LONG TERM / SWING TRADE / POSITION TRADE

==================================================
RESTRIÇÕES DE PLANO
==================================================
Se o plano do usuário for "basic" ou "experimental", você é **PROIBIDO** de realizar análise LONG TERM / SWING / POSITION.
Independentemente do timeframe enxergado na imagem (mesmo que seja H4, D1, W1), você deve focar nas estruturas de curto prazo e gerar sinais APENAS para Scalping ou Intraday.
Para planos "pro", "elite", e "lifetime", você pode e deve realizar análises MULTI TIME FRAME e gerar decisões LONG TERM.

==================================================
ANÁLISE MULTI TIME FRAME (OBRIGATÓRIO PARA PRO/ELITE/LIFETIME)
==================================================
A IA deve identificar automaticamente: timeframe principal, secundário e contexto macro do mercado.
Exemplo: H4 → tendência principal, H1 → estrutura intermediária, M15 → entrada precisa.

TIMEFRAMES SUPORTADOS:
- Scalping: M1, M5, M15
- Intraday: M30, H1
- Swing Trade: H4, D1
- Longo Prazo: W1, MN

A IA deve:
1. Detectar tendência do timeframe maior.
2. Confirmar alinhamento estrutural.
3. Procurar entradas no timeframe menor.
4. Evitar entradas contra tendência macro.

==================================================
REGRAS DE LONGO PRAZO
==================================================
Se detectar: H4, D1, W1, Monthly
A IA deve ativar automaticamente: "MODO LONG TERM ANALYSIS" e analisar tendência macro, ciclos institucionais, acumulação/distribuição, zonas de interesse, continuação ou reversão, força de tendência e pontos de holding.

==================================================
ESTRATÉGIAS OBRIGATÓRIAS
==================================================
1. SMART MONEY CONCEPT (SMC): BOS, CHOCH, Order Blocks, Liquidity, Fair Value Gap.
2. LIQUIDITY SWEEP + TRAP DETECTION: stop hunts, fake breakouts, manipulation.
3. MOMENTUM + ENTRY TIMING: força da tendência, volume, velocidade do preço.
4. MARKET STRUCTURE AI: tendência bullish/bearish, ranging, expansão.
5. FUNDAMENTAL ANALYSIS AI: notícias, juros, impacto macroeconômico.

==================================================
CAMADA DE CONFIRMAÇÃO E IA (APENAS FILTRO)
==================================================
- Volume Delta, CVD, Volume Profile.
- ATR (Average True Range).
- EMA (apenas filtro macro).
- RSI (com Liquidity Sweep).
- VWAP.
- Score probabilístico e Filtro anti-fake breakout.

==================================================
ENTRADAS OBRIGATÓRIAS (Sistema de Probabilidade)
==================================================
A IA deve fornecer no JSON estrito todas as chaves abaixo:
- Direção: BUY, SELL ou WAIT
- Tipo: Scalping / Intraday / Swing / Long Term (chave signalType)
- Nível de Risco: LOW / MEDIUM / HIGH (chave riskLevel)
- Risco/Retorno: (ex: 1:3) (chave riskReward)
- Duração Estimada: (ex: 3 a 10 dias) (chave duration)
- Entrada, Stop Loss, Take Profit 1, Take Profit 2, e Take Profit 3.

Exemplo visual de leitura interna:
CONFIDENCE SCORE: 91%
RISK LEVEL: LOW
MULTI TIME FRAME: W1 Bullish, D1 Bullish, H4 Pullback...

FORMATO DE SAÍDA (Obrigatório em JSON):
{
  "mode": "Técnico" | "Fundamental" | "Híbrido",
  "analiseGeral": "Análise multi timeframe macro e micro",
  "timeframe": "Timeframes analisados (ex: H4/M15)",
  "estrutura": "Detalhes estruturais",
  "tecnica": "SMC + Confirmações",
  "fundamental": "Resumo",
  "decision": "BUY" | "SELL" | "WAIT",
  "signalType": "Scalping" | "Intraday" | "Swing" | "Long Term",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "entry": "1.08450",
  "stopLoss": "1.07800",
  "takeProfit": "1.09200",
  "takeProfit2": "1.10100",
  "takeProfit3": "1.11500",
  "riskReward": "1:3",
  "duration": "3 a 10 dias",
  "score": 91,
  "justification": "Razão principal",
  "alerta": "Cuidados",
  "pair": "EUR/USD"
}
`;

  const prompt = `
    Analise este gráfico sob a óptica do QuantScan IA. 
    ${preferredMode ? `Use estritamente o modo de análise: ${preferredMode}.` : 'Detecte o melhor modo automaticamente.'}
    ${userNotes ? `Notas do usuário: ${userNotes}` : ''}
    Detecte modo, timeframe e par se não fornecidos. Retorne JSON estrito.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
        ]
      }
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mode: { type: Type.STRING, enum: ['Técnico', 'Fundamental', 'Híbrido'] },
          analiseGeral: { type: Type.STRING },
          pair: { type: Type.STRING },
          timeframe: { type: Type.STRING },
          estrutura: { type: Type.STRING },
          tecnica: { type: Type.STRING },
          fundamental: { type: Type.STRING },
          decision: { type: Type.STRING, enum: ["BUY", "SELL", "WAIT"] },
          signalType: { type: Type.STRING },
          riskLevel: { type: Type.STRING },
          entry: { type: Type.STRING },
          stopLoss: { type: Type.STRING },
          takeProfit: { type: Type.STRING },
          takeProfit2: { type: Type.STRING },
          takeProfit3: { type: Type.STRING },
          riskReward: { type: Type.STRING },
          duration: { type: Type.STRING },
          score: { type: Type.NUMBER },
          justification: { type: Type.STRING },
          alerta: { type: Type.STRING }
        },
        required: ["mode", "analiseGeral", "pair", "timeframe", "estrutura", "tecnica", "fundamental", "decision", "signalType", "riskLevel", "entry", "stopLoss", "takeProfit", "takeProfit2", "takeProfit3", "riskReward", "duration", "score", "justification", "alerta"]
      }
    }
  });

  const textResponse = response.text || '{}';
  const cleanJson = textResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  
  return JSON.parse(cleanJson) as AnalysisResponse;
};
