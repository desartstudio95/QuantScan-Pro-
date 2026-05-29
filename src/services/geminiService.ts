import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse, SignalType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const analyzeForexChart = async (imageBase64: string, userNotes?: string, preferredMode?: 'Técnico' | 'Fundamental' | 'Híbrido', userPlan?: string): Promise<AnalysisResponse> => {
  const model = 'gemini-3.1-pro-preview';
  
  const systemInstruction = `
# QUANTSCAN IA — SMART MONEY CONCEPT (SMC) & INSTITUTIONAL TRADING

Você é o QUANTSCAN IA, um sistema profissional avançado de análise focado *estritamente* na estratégia Smart Money Concept (SMC) e Trading Institucional.

Plano do Usuário Atual: ${userPlan || 'basic'}

Sua função é analisar gráficos enviados pelo usuário através de: screenshot do gráfico, foto da tela, imagem do TradingView, imagem MT4/MT5 ou corretoras.
Sua análise de mercado deve sempre procurar os rastros do "Smart Money" (Dinheiro Inteligente), ignorando suportes/resistências de varejo e focando em liquidez.

O sistema deve operar em dois modos:
1. SHORT TERM / SCALPING
2. LONG TERM / SWING TRADE / POSITION TRADE

==================================================
RESTRIÇÕES DE PLANO
==================================================
Se o plano do usuário for "basic" ou "experimental", você é **PROIBIDO** de realizar análise LONG TERM / SWING / POSITION.
Você deve focar nas estruturas de curto prazo e gerar sinais APENAS para Scalping ou Intraday.
Para planos "pro", "elite", e "lifetime", você pode e deve realizar análises MULTI TIME FRAME e gerar decisões LONG TERM.

==================================================
PILARES DA ESTRATÉGIA SMC OBRIGATÓRIA
==================================================
1. CHOCH (Change of Character): Mudança de caráter na estrutura de mercado, indicando possível reversão.
2. BOS (Break of Structure): Quebra de estrutura a favor da tendência para continuação.
3. OB (Order Blocks): Zonas institucionais onde houve forte injeção de capital. Marque a vela antes de um grande movimento (desequilíbrio).
4. FVG (Fair Value Gaps / Imbalance): Ineficiência do preço deixada por forte movimento institucional. Áreas magnéticas para o preço retornar.
5. LIQUIDITY (Sweeps / Inducement): Buy Side Liquidity (BSL) e Sell Side Liquidity (SSL). O mercado move buscando stops do varejo antes de reverter. Busque "Liquidity Sweeps" (liquidez varrida).
6. POI (Point of Interest): Zona combinada de OB + FVG não mitigada onde o preço tem alta probabilidade de reagir.

Sua entrada deve SEMPRE ser colocada em um POI válido (geralmente Order Block + FVG) APÓS uma quebra de estrutura (BOS/CHOCH) e varredura de liquidez prévia.

==================================================
ANÁLISE MULTI TIME FRAME
==================================================
A IA deve identificar automaticamente o contexto das mitigações no timeframe macro vs micro.
Ex: H4 chegou num Order Block mitigando a zona, então no M15 buscamos um CHOCH confirmando o fim do pullback e a continuação institucional.

==================================================
REGRAS ADICIONAIS DE SINAIS
==================================================
- Winrate Learning AI: Avaliar probabilidade (Ex: Se for um OB de continuação com FVG forte e liquidez capturada recém = 90% Winrate, se for Order Block isolado contra a tendência macro = 30%).
- Risco/Retorno OBRIGATÓRIO de SMC (Sempre busque um mínimo de 1:3). O TP deve estar no próximo pool de liquidez principal. O Stop deve estar do outro lado do Order Block ou topo/fundo protegido.

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
- Trailing Stop: Regra para mover o stop (chave trailingStop)
- Winrate Learning: Justificativa rápida do winrate provável baseado na estrutura (chave winrateLearning)
- Multi Time Frame Analysis: Resumo da confluência entre tempos gráficos maiores e menores (chave multiTimeFrameAnalysis)

Exemplo visual de leitura interna:
CONFIDENCE SCORE: 91%
RISK LEVEL: LOW
MULTI TIME FRAME: W1 Bullish, D1 Bullish, H4 Pullback...

FORMATO DE SAÍDA (Obrigatório em JSON):
{
  "mode": "Técnico" | "Fundamental" | "Híbrido",
  "analiseGeral": "Análise multi timeframe macro e micro",
  "pair": "EUR/USD",
  "timeframe": "Timeframes analisados (ex: H4/M15)",
  "estrutura": "Detalhes estruturais",
  "tecnica": "SMC + Confirmações",
  "fundamental": "Resumo",
  "multiTimeFrameAnalysis": "Resumo da confluência entre tempos gráficos maiores e menores",
  "decision": "BUY" | "SELL" | "WAIT",
  "signalType": "Scalping" | "Intraday" | "Swing" | "Long Term",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "entry": "1.08450",
  "stopLoss": "1.07800",
  "takeProfit": "1.09200",
  "takeProfit2": "1.10100",
  "takeProfit3": "1.11500",
  "trailingStop": "Mover SL para entrada após atingir TP1, step de 5 pips",
  "winrateLearning": "Contexto do Winrate Learning AI, taxa de assertividade desse padrão",
  "riskReward": "1:3",
  "duration": "3 a 10 dias",
  "score": 91,
  "justification": "Razão principal",
  "alerta": "Cuidados"
}
`;

  const prompt = `
    Analise este gráfico sob a óptica do QuantScan IA. 
    ${preferredMode ? `Use estritamente o modo de análise: ${preferredMode}.` : 'Detecte o melhor modo automaticamente.'}
    ${userNotes ? `Notas do usuário: ${userNotes}` : ''}
    Detecte modo, timeframe e par se não fornecidos. Retorne JSON estrito. 
    IMPORTANTE: O campo 'pair' DEVE SEMPRE usar a formatação padrão internacional para APIs de mercado (ex: XAU/USD para Ouro, GBP/JPY, BTC/USD, AAPL para ações). Não escreva 'Gold', escreva 'XAU/USD'.
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
          multiTimeFrameAnalysis: { type: Type.STRING },
          decision: { type: Type.STRING, enum: ["BUY", "SELL", "WAIT"] },
          signalType: { type: Type.STRING },
          riskLevel: { type: Type.STRING },
          entry: { type: Type.STRING },
          stopLoss: { type: Type.STRING },
          takeProfit: { type: Type.STRING },
          takeProfit2: { type: Type.STRING },
          takeProfit3: { type: Type.STRING },
          trailingStop: { type: Type.STRING },
          winrateLearning: { type: Type.STRING },
          riskReward: { type: Type.STRING },
          duration: { type: Type.STRING },
          score: { type: Type.NUMBER },
          justification: { type: Type.STRING },
          alerta: { type: Type.STRING }
        },
        required: ["mode", "analiseGeral", "pair", "timeframe", "estrutura", "tecnica", "fundamental", "multiTimeFrameAnalysis", "decision", "signalType", "riskLevel", "entry", "stopLoss", "takeProfit", "takeProfit2", "takeProfit3", "trailingStop", "winrateLearning", "riskReward", "duration", "score", "justification", "alerta"]
      }
    }
  });

  const textResponse = response.text || '{}';
  const cleanJson = textResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  
  return JSON.parse(cleanJson) as AnalysisResponse;
};
