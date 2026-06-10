import axios from 'axios';

export interface AISignal {
    symbol: string;
    action: 'BUY' | 'SELL';
    confidence: number;
    reason: string;
    timestamp: number;
}

export interface RiskLimits {
    maxDailyLoss: number;
    maxOpenPositions: number;
    maxTradeValue: number;
    minConfidence?: number;
    dailyProfitTarget?: number;
}

export class AITradingEngine {
    static async analyze(symbol: string, currentPrice: number): Promise<AISignal> {
        // Simulated AI Analysis
        // Em um sistema real, aqui chamaria um endpoint de machine learning ou usaria indicadores técnicos reais
        const confidence = Math.floor(Math.random() * 40) + 60; // 60 to 100
        const action: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
        
        const reasons = [
            'RSI indicates oversold conditions combined with strong volume surge.',
            'MACD crossover detected on primary timeframe with volatility expansion.',
            'Price action bounced from major institutional support/resistance level.',
            'Moving Average ribbon alignment indicates strong trend strength.',
            'Institutional order block detected aligning with current momentum.'
        ];
        
        return {
            symbol,
            action,
            confidence: confidence >= 75 ? confidence + 5 : confidence, // Bias towards higher confidence to trigger some trades
            reason: reasons[Math.floor(Math.random() * reasons.length)],
            timestamp: Date.now()
        };
    }
}

export class RiskManager {
    static validate(
        signal: AISignal,
        openPositionsCount: number,
        balance: number,
        limits: RiskLimits,
        tradeAmount: number,
        currentDailyProfit: number,
        systemOnline: boolean
    ): { valid: boolean; reason?: string } {
        if (!systemOnline) return { valid: false, reason: 'System offline' };
        
        const minConf = limits.minConfidence || 80;
        if (signal.confidence < minConf) return { valid: false, reason: `Confidence too low (${signal.confidence}% < ${minConf}%)` };
        
        if (openPositionsCount >= limits.maxOpenPositions) return { valid: false, reason: `Max open positions reached (${openPositionsCount}/${limits.maxOpenPositions})` };
        if (tradeAmount > limits.maxTradeValue) return { valid: false, reason: `Trade value exceeds max allowed (${tradeAmount} > ${limits.maxTradeValue})` };
        if (balance < tradeAmount) return { valid: false, reason: `Insufficient balance (${balance} < ${tradeAmount})` };
        
        // currentDailyProfit could be negative (loss) or positive (profit)
        // Check Loss:
        if (currentDailyProfit < 0 && Math.abs(currentDailyProfit) >= limits.maxDailyLoss) {
            return { valid: false, reason: `Max daily loss reached (${Math.abs(currentDailyProfit)} >= ${limits.maxDailyLoss})` };
        }

        // Check Profit Target:
        if (limits.dailyProfitTarget && currentDailyProfit >= limits.dailyProfitTarget) {
            return { valid: false, reason: `Daily profit target reached (${currentDailyProfit} >= ${limits.dailyProfitTarget})` };
        }
        
        return { valid: true };
    }
}
