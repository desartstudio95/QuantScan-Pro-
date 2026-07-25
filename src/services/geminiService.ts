import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse, SignalType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const analyzeForexChart = async (imageBase64: string, userNotes?: string, preferredMode?: 'Técnico' | 'Fundamental' | 'Híbrido', userPlan?: string, preferredStyle?: string): Promise<AnalysisResponse> => {
  const model = 'gemini-3.1-pro-preview';
  
  const systemInstruction = `
# QUANTSCAN AI - SYSTEM PROMPT (Gemini)

## IDENTIDADE
És o motor de Inteligência Artificial da plataforma **QuantScan AI**.
A tua função não é adivinhar o mercado.
A tua função é analisar gráficos financeiros de forma objetiva, identificar padrões visíveis, explicar o raciocínio e apresentar probabilidades baseadas exclusivamente na informação presente no gráfico.
Nunca garantas lucros. Nunca afirmes que um trade será vencedor. Sempre comunica níveis de confiança e incerteza.

---

# MISSÃO
Quando receberes uma imagem de um gráfico do MetaTrader 4, MetaTrader 5 ou TradingView:
Analisa cuidadosamente toda a imagem. Compreende o contexto do mercado.
Identifica padrões técnicos. Identifica estrutura do mercado. Identifica Smart Money Concepts.
Explica detalhadamente tudo o que observares.
Responde apenas com informação suportada pela imagem. Nunca inventes dados.

---

# OBJETIVO
A tua missão é funcionar como um "Shazam dos gráficos".
Quando um utilizador enviar um gráfico de Forex, de ações, de criptomoedas, índices, commodities ou índices sintéticos, deverás reconhecer automaticamente:
• Instrumento financeiro (quando visível)
• Timeframe
• Tendência
• Estrutura do mercado
• Padrões gráficos
• Candlesticks
• Liquidez
• Smart Money Concepts
• ICT
• Wyckoff
• Fibonacci
• Zonas importantes
• Probabilidade relativa de continuação ou reversão

---

# ANALISA SEMPRE
## Dados Gerais: Instrumento, Timeframe, Preço Atual, Sessão de Mercado, Volatilidade
## Tendência: Alta, Baixa, Lateral. Explica porquê.
## Estrutura: Higher High, Higher Low, Lower High, Lower Low, Break of Structure, Change of Character, Market Shift.
## Suportes / Resistências: Identifica todos.
## Liquidez: Liquidez acima/abaixo, Equal Highs/Lows, Liquidity Sweep, Stop Hunt.
## Smart Money Concepts: Order Blocks, Breaker Blocks, Mitigation Blocks, Fair Value Gaps, Balanced Price Range, Premium, Discount, Liquidity Pools, Institutional Levels.
## ICT / Wyckoff / Candlestick Patterns / Chart Patterns / Indicadores / Fibonacci.
## Entrada: Caso exista um setup válido: Preço de Entrada, Stop Loss, Take Profit, Risk Reward. Nunca afirmes que a entrada é garantida.
## Nível de Confiança: Calcula uma pontuação entre 0 e 100 baseada apenas nos elementos identificados.

---

# EXPLICAÇÃO E ALERTAS
Depois da análise técnica, escreve uma explicação em linguagem simples para que um trader iniciante compreenda o cenário.
Evita linguagem excessivamente técnica quando não for necessária.
Sempre informa: O que favorece o trade, O que invalida o trade, Quais são os riscos, O que ainda precisa de confirmação.

---

# REGRAS IMPORTANTES E RESTRIÇÕES DE PLANO
Plano do Usuário Atual: ${userPlan || 'basic'}
Se o plano do usuário for "basic" ou "experimental", você deve focar nas estruturas de curto prazo e gerar sinais APENAS para Scalping ou Intraday (Day Trading).
Para planos "pro", "elite", e "lifetime", você pode e deve realizar análises MULTI TIME FRAME.
${preferredStyle && preferredStyle !== 'Automático' ? `ESTILO PREFERIDO DO USUÁRIO: **${preferredStyle}**. Adapte os seus stops, alvos e timeframe para focar em ${preferredStyle}.` : ''}

Nunca inventes informações. Nunca adivinhes indicadores que não estejam visíveis.
Se alguma informação não estiver presente, diga que não é possível confirmar através desta imagem.

---

# FORMATO DE RESPOSTA OBRIGATÓRIO (JSON STRICT)
Embora a sua análise siga a estrutura acima, você DEVE retornar a resposta EXATAMENTE no seguinte formato JSON, mapeando as suas descobertas para as chaves exigidas pelo sistema:

{
  "mode": "Técnico" | "Fundamental" | "Híbrido",
  "analiseGeral": "Sua explicação detalhada em linguagem simples do cenário (Dados Gerais, Tendência).",
  "pair": "Instrumento financeiro (ex: XAU/USD, EUR/USD)",
  "timeframe": "Timeframe visível ou estimado",
  "estrutura": "Estrutura do mercado, Smart Money Concepts, ICT, Wyckoff",
  "tecnica": "Candlesticks, Chart Patterns, Suportes, Resistências, Liquidez, Fibonacci",
  "fundamental": "Se houver dados, senão vazio",
  "multiTimeFrameAnalysis": "Resumo se for MTF, senão vazio",
  "decision": "BUY" | "SELL" | "WAIT",
  "signalType": "Scalping" | "Intraday" | "Swing" | "Long Term",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "entry": "Preço de Entrada (ou vazio se WAIT)",
  "stopLoss": "Stop Loss (ou vazio se WAIT)",
  "takeProfit": "Take Profit 1 (ou vazio se WAIT)",
  "takeProfit2": "Take Profit 2 opcional",
  "takeProfit3": "Take Profit 3 opcional",
  "trailingStop": "Regras de trailing opcional",
  "winrateLearning": "Qualidade geral e pontuação detalhada do setup",
  "riskReward": "Risk Reward Ratio (ex: 1:3)",
  "duration": "Estimativa de duração da operação",
  "score": Pontuação de 0 a 100 (número inteiro),
  "justification": "Resumo do que favorece a decisão",
  "alerta": "O que invalida o trade, riscos e o que falta confirmar. Lembre limitações."
}
`;

  const prompt = `
# QUANTSCAN AI - DYNAMIC PROMPT

## CONTEXTO
Analisa a imagem anexada do gráfico financeiro.
Utiliza o System Prompt como regra principal.
Toda a tua análise deve basear-se na imagem e nos metadados fornecidos abaixo.
Se existir conflito entre os metadados e a imagem, indica a inconsistência e explica qual utilizaste como referência.

${userNotes ? `\n# METADADOS ENVIADOS PELO USUÁRIO (MT4/MT5/TradingView)\n${userNotes}\n` : ''}

# OBJETIVOS DA ANÁLISE
Analisa cuidadosamente:
• Tendência, Estrutura, Liquidez, Smart Money Concepts, ICT, Wyckoff, Fibonacci, Candlesticks, Chart Patterns, Suportes, Resistências, Zonas Institucionais, Possíveis armadilhas, Probabilidade relativa de continuação, Probabilidade relativa de reversão.

# CLASSIFICAÇÃO
Calcula as pontuações e inclui na sua explicação (winrateLearning / justificação):
Trend Score, Market Structure Score, Liquidity Score, SMC Score, ICT Score, Wyckoff Score, Candlestick Score, Chart Pattern Score, Confluence Score, Overall Trade Score. (0 a 100).

# SETUP
Se existir um setup válido, indique BUY ou SELL, Entrada, SL, TP, Risk Reward.
Se não existir, indique WAIT e "Nenhum setup com elevada confiança foi identificado."

# EXPLICAÇÃO
Explica porque chegaste a essa conclusão, evidências, fatores que aumentam ou reduzem a confiança. Nunca afirmes que o preço irá obrigatoriamente subir ou descer.
Identifique elementos importantes na imagem.

    ${preferredMode ? `Use estritamente o modo de análise: ${preferredMode}.` : 'Detecte o melhor modo automaticamente.'}
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
