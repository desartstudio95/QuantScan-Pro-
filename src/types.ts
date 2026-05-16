/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  WAIT = 'WAIT'
}

export enum SignalResult {
  GAIN = 'GAIN',
  LOSS = 'LOSS',
  BE = 'BE',
  PENDING = 'PENDING'
}

export interface Signal {
  id: string;
  timestamp: number;
  type: SignalType;
  entry: string;
  stopLoss: string;
  takeProfit: string;
  score: number;
  justification: string;
  result: SignalResult;
  screenshotUrl?: string;
  userId: string;
  // QuantScan IA fields
  mode: string;
  pair: string;
  analiseGeral: string;
  timeframe: string;
  estrutura: string;
  tecnica: string;
  fundamental: string;
  alerta: string;
}

export interface UserStats {
  userId: string;
  totalSignals: number;
  winRate: number;
  totalProfitPips: number;
  bestTimeframe: string;
  bestPattern: string;
  performanceByTimeframe: Record<string, number>;
  performanceByPattern: Record<string, number>;
}

export interface AnalysisResponse {
  mode: 'Técnico' | 'Fundamental' | 'Híbrido';
  analiseGeral: string;
  pair: string;
  timeframe: string;
  estrutura: string;
  tecnica: string;
  fundamental: string;
  decision: SignalType;
  entry: string;
  stopLoss: string;
  takeProfit: string;
  takeProfit2?: string;
  takeProfit3?: string;
  riskReward?: string;
  duration?: string;
  riskLevel?: string;
  signalType?: string;
  score: number;
  justification: string;
  alerta: string;
}
