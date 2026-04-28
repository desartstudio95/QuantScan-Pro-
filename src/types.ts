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
  pair: string;
  timeframe: string;
  timestamp: number;
  type: SignalType;
  entry: string;
  stopLoss: string;
  takeProfit: string;
  score: number;
  justification: string;
  logicElements: string[];
  result: SignalResult;
  screenshotUrl?: string;
  userId: string;
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
  pair: string;
  timeframe: string;
  structure: string;
  conceptsDetected: string[];
  decision: SignalType;
  entry: string;
  stopLoss: string;
  takeProfit: string;
  score: number;
  justification: string;
  liquiditySweep?: string;
  momentum?: string;
  keyZones?: string[];
  institutionalContext?: 'Accumulation' | 'Manipulation' | 'Distribution' | 'None';
}
