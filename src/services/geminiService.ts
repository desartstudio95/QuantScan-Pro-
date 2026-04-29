import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse, SignalType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const analyzeForexChart = async (imageBase64: string, userNotes?: string): Promise<AnalysisResponse> => {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    Você é um Analista Institucional de Forex com IA adaptativa, especializado em Fluxo de Ordens, Liquidez e Comportamento Institucional (PRO Logic).
    Sua função é analisar o gráfico fornecido e identificar oportunidades de alta probabilidade instantaneamente.
    
    Analise a imagem detalhadamente em busca de:
    1. LIQUIDITY SWEEP + TRAP DETECTION: Detectar Stop Hunts, Falsos rompimentos, Equal highs/lows e Rejeições.
    2. MOMENTUM + ENTRY TIMING: Avaliar força dos candles e rejeições.
    3. ZONAS IMPORTANTES: Oferta/Demanda e Níveis psicológicos.
    
    Detecte automaticamente o Timeframe e o Par de Moedas.
    
    Seja breve, preciso e ultrarrápido na resposta.
  `;

  const prompt = `
    Analise este gráfico de Forex sob a óptica institucional. ${userNotes ? `Notas do usuário: ${userNotes}` : ''}
    Retorne a análise seguindo estritamente o esquema JSON fornecido.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: imageBase64 } }
        ]
      }
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pair: { type: Type.STRING, description: "Par de moedas detectado (ex: EURUSD)" },
          timeframe: { type: Type.STRING, description: "Timeframe detectado (ex: H1)" },
          structure: { type: Type.STRING, description: "Resumo da estrutura de mercado" },
          conceptsDetected: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Lista de conceitos identificados"
          },
          decision: { 
            type: Type.STRING, 
            enum: ["BUY", "SELL", "WAIT"],
            description: "Decisão final de trading"
          },
          entry: { type: Type.STRING, description: "Preço ou zona de entrada" },
          stopLoss: { type: Type.STRING, description: "Preço de Stop Loss" },
          takeProfit: { type: Type.STRING, description: "Preço de Take Profit" },
          score: { type: Type.NUMBER, description: "Score de probabilidade de 0 a 100" },
          justification: { type: Type.STRING, description: "Explicação técnica para o score" },
          liquiditySweep: { type: Type.STRING, description: "Descrição do sweep de liquidez detectado ou armadilhas" },
          momentum: { type: Type.STRING, description: "Análise do momentum e timing de entrada" },
          keyZones: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Zonas importantes detectadas"
          },
          institutionalContext: { 
            type: Type.STRING,
            enum: ["Accumulation", "Manipulation", "Distribution", "None"],
            description: "Fase do ciclo institucional"
          }
        },
        required: ["pair", "timeframe", "structure", "conceptsDetected", "decision", "entry", "stopLoss", "takeProfit", "score", "justification", "liquiditySweep", "momentum", "keyZones", "institutionalContext"]
      }
    }
  });

  return JSON.parse(response.text || '{}') as AnalysisResponse;
};
