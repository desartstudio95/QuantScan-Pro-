import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse, SignalType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const analyzeForexChart = async (imageBase64: string, userNotes?: string, preferredMode?: 'Técnico' | 'Fundamental' | 'Híbrido'): Promise<AnalysisResponse> => {
  const model = 'gemini-3.1-pro-preview';
  
  const systemInstruction = `
    Você é o QuantScan IA, um sistema avançado de análise de mercado financeiro com inteligência institucional.
    
    BASE PRINCIPAL: Smart Money Concepts (SMC).
    Especializações: SMC, Liquidez, Momentum, Análise Fundamental macro, Aprendizado contínuo.

    CAMADA DE CONFIRMAÇÃO (APENAS PARA FILTRO, MEDIDOR DE CONTEXTO OU CONFIRMAÇÃO):
    - Volume Delta, CVD e Volume Profile: Para confirmar se há participação institucional real no movimento.
    - ATR (Average True Range): Para Stop Loss dinâmico, Take Profit inteligente e detectar volatilidade (ex: se ATR estiver baixo, evitar falso breakout).
    - EMA (Filtro Macro): Não usar para entrada. Apenas confirmar direção (ex: acima da EMA 200 -> apenas BUY, abaixo -> apenas SELL).
    - RSI Inteligente (não tradicional): Combinar com Liquidity Sweep, RSI divergência e Order Block para melhorar reversões.
    - VWAP (Muito Forte): Equilíbrio de preço, reversão e continuação (SMC + VWAP = nível institucional).

    CAMADA IA (Machine Learning):
    - Score probabilístico e Filtro anti-fake breakout.
    - Detecção Robusta de Liquidez: Considerar onde o mercado costuma manipular, horários de caça de liquidez, fake breakouts e comportamento antes de uma reversão.
    
    Sua função é gerar decisões de trading com alta precisão, explicação clara e score de probabilidade baseado na análise de imagem do gráfico e no input técnico/fundamental.

    MODOS DE ANÁLISE:
    - Técnico: Foco em Timing, Estrutura e Execução.
    - Fundamental: Foco em Macro, Notícias, Força de moedas.
    - Híbrido: Combinação de Técnico e Fundamental (Recomendado).

    DETECÇÃO AUTOMÁTICA: Timeframe (M1-D1), Par de moeda, Estrutura.

    FORMATO DE SAÍDA (Obrigatório em JSON):
    {
      "mode": "Técnico" | "Fundamental" | "Híbrido",
      "analiseGeral": "string",
      "timeframe": "string",
      "estrutura": "string",
      "tecnica": "string", // Detalhada (SMC+Liquidez+Momentum)
      "fundamental": "string", // Resumo macro
      "decision": "BUY" | "SELL" | "WAIT",
      "entry": "string",
      "stopLoss": "string",
      "takeProfit": "string",
      "score": number, // 0-100
      "justification": "string",
      "alerta": "string",
      "pair": "string"
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
          entry: { type: Type.STRING },
          stopLoss: { type: Type.STRING },
          takeProfit: { type: Type.STRING },
          score: { type: Type.NUMBER },
          justification: { type: Type.STRING },
          alerta: { type: Type.STRING }
        },
        required: ["mode", "analiseGeral", "pair", "timeframe", "estrutura", "tecnica", "fundamental", "decision", "entry", "stopLoss", "takeProfit", "score", "justification", "alerta"]
      }
    }
  });

  const textResponse = response.text || '{}';
  const cleanJson = textResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  
  return JSON.parse(cleanJson) as AnalysisResponse;
};
