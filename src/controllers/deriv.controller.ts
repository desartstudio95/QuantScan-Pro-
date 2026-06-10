import { Request, Response } from 'express';
import { DerivService } from '../services/deriv/index.js';
import { getDerivSymbol } from '../services/marketData.js';

class DerivManager {
    private instances: Map<string, DerivService> = new Map();
    private initializing: Map<string, Promise<DerivService>> = new Map();

    public async getInstance(appId: string, token: string): Promise<DerivService> {
        const key = `${appId}:${token}`;
        
        if (this.instances.has(key)) {
            return this.instances.get(key)!;
        }

        if (this.initializing.has(key)) {
            return this.initializing.get(key)!;
        }

        const initPromise = (async () => {
            try {
                const service = new DerivService(appId, token);
                await service.initialize();
                this.instances.set(key, service);
                return service;
            } finally {
                this.initializing.delete(key);
            }
        })();

        this.initializing.set(key, initPromise);
        return initPromise;
    }

    public removeInstance(appId: string, token: string) {
        const key = `${appId}:${token}`;
        if (this.instances.has(key)) {
            this.instances.get(key)!.disconnect();
            this.instances.delete(key);
        }
    }
}

export const derivManager = new DerivManager();

export const connect = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        const appId = req.body.appId || '1089';
        if (!token) return res.status(400).json({ error: 'Token is required' });
        
        console.log(`[Deriv] Connecting with appId: ${appId}...`);
        await derivManager.getInstance(appId, token);
        
        res.json({ success: true, message: 'Connected to Deriv' });
    } catch (err: any) {
        console.error('[Deriv] Connection Error:', err);
        const errMessage = err?.message || String(err);
        res.status(500).json({ error: errMessage || 'Connection failed' });
    }
};

export const getAccount = async (req: Request, res: Response) => {
    try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const appId = (req.query.appId as string) || '1089';
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
        
        const service = await derivManager.getInstance(appId, token);
        const { balance, currency } = await service.account.getBalance();
        
        // Re-authorize to ensure we have the loginid
        const authData = await service.auth.authorize();

        // Get open positions
        let openPositionsCount = 0;
        try {
            const positions = await service.trading.getOpenPositions();
            openPositionsCount = Array.isArray(positions) ? positions.length : 0;
        } catch(e) {
            console.error('[Deriv] Fetch positions error:', e);
        }
        
        res.json({
            success: true,
            balance,
            currency,
            loginid: authData?.loginid || '',
            openPositions: openPositionsCount
        });
    } catch (err: any) {
        console.error('[Deriv] Get Account Error:', err);
        const errMessage = err?.message || String(err);
        res.status(500).json({ error: errMessage || 'Failed to fetch account' });
    }
};

export const getSymbols = async (req: Request, res: Response) => {
    try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const appId = (req.query.appId as string) || '1089';
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
        
        const service = await derivManager.getInstance(appId, token);
        
        const response = await service.ws.send({
            active_symbols: "brief",
            product_type: "basic"
        });
        
        res.json({
            success: true,
            symbols: response.active_symbols
        });
    } catch (err: any) {
        console.error('[Deriv] Get Symbols Error:', err);
        const errMessage = err?.message || String(err);
        res.status(500).json({ error: errMessage || 'Failed to fetch symbols' });
    }
};

export const getTick = async (req: Request, res: Response) => {
    let cleanSymbol = 'R_100';
    try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const appId = (req.query.appId as string) || '1089';
        const { symbol } = req.params;
        
        cleanSymbol = getDerivSymbol(symbol) || 'R_100';
        
        console.log(`[Deriv] Get Tick called with symbol:`, cleanSymbol);
        
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
        
        const service = await derivManager.getInstance(appId, token);
        
        const response = await service.ws.send({
            ticks_history: cleanSymbol,
            end: 'latest',
            count: 1,
            style: 'ticks'
        });
        
        if (response.error) {
            return res.status(400).json({ error: response.error.message });
        }
        
        res.json({
            success: true,
            tick: {
                symbol: cleanSymbol,
                quote: response.history?.prices?.[0] || 0,
                epoch: response.history?.times?.[0] || 0
            }
        });
    } catch (err: any) {
        console.error('[Deriv] Get Tick Error:', err?.message || String(err), 'symbol:', cleanSymbol);
        res.json({ success: false, error: err?.message || 'Failed to fetch tick', symbol: cleanSymbol });
    }
};

export const testBuy = async (req: Request, res: Response) => {
    try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const appId = (req.query.appId as string) || '1089';
        let { symbol, amount, contract_typeBase, duration, duration_unit, multiplier } = req.body;
        
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
        if (!symbol) return res.status(400).json({ error: 'Symbol is required' });
        
        let cleanSymbol = getDerivSymbol(symbol) || 'R_100';
        
        const service = await derivManager.getInstance(appId, token);
        
        let finalMultiplier = multiplier;
        if (contract_typeBase && contract_typeBase.includes('MULT')) {
            const allowedMultipliers = await getAllowedMultipliers(service, cleanSymbol);
            if (allowedMultipliers && allowedMultipliers.length > 0) {
                if (!finalMultiplier || !allowedMultipliers.includes(finalMultiplier)) {
                    finalMultiplier = allowedMultipliers[0]; // Pick the first valid multiplier
                }
            } else {
                 return res.status(400).json({ error: `Multipliers not supported for symbol ${cleanSymbol}` });
            }
        }

        const tradeParams: any = {
            symbol: cleanSymbol,
            amount: amount || 1, // Minimum demo value usually 1 for USD, depends on currency
            contract_typeBase: contract_typeBase || 'CALL'
        };

        if (finalMultiplier) {
            tradeParams.multiplier = finalMultiplier;
        } else {
            tradeParams.duration = duration || 5;
            tradeParams.duration_unit = duration_unit || 't';
        }

        const result = await service.trading.executeTrade(tradeParams);
        
        res.json({
            success: true,
            trade: result
        });
    } catch (err: any) {
        console.error('[Deriv] Test Buy Error:', err);
        const errMessage = err?.message || String(err);
        res.status(500).json({ error: errMessage, details: err });
    }
};

const multipliersCache: Map<string, { values: number[], timestamp: number }> = new Map();

async function getAllowedMultipliers(service: DerivService, symbol: string): Promise<number[] | null> {
    const cacheKey = symbol;
    const cached = multipliersCache.get(cacheKey);
    // Cache for 1 hour
    if (cached && Date.now() - cached.timestamp < 3600 * 1000) {
        return cached.values;
    }

    try {
        const response = await service.ws.send({ contracts_for: symbol });
        if (response.contracts_for && response.contracts_for.available) {
            const multiContracts = response.contracts_for.available.filter((c: any) => c.contract_category === 'multiplier');
            if (multiContracts.length > 0) {
                // Different contracts might have different arrays (e.g., MULTUP vs MULTDOWN), usually they are the same
                // We flatten and deduplicate the multiplier_range arrays
                const allRanges = multiContracts.map((c: any) => c.multiplier_range || c.multipliers || []).flat();
                const uniqueMultipliers = Array.from(new Set(allRanges)).filter(Boolean) as number[];
                if (uniqueMultipliers.length > 0) {
                    uniqueMultipliers.sort((a, b) => a - b);
                    multipliersCache.set(cacheKey, { values: uniqueMultipliers, timestamp: Date.now() });
                    return uniqueMultipliers;
                }
            }
        }
    } catch (err) {
        console.error(`[Deriv] Error fetching allowed multipliers for ${symbol}:`, err);
    }
    
    return null;
}

export const getPositions = async (req: Request, res: Response) => {
    try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const appId = (req.query.appId as string) || '1089';
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
        
        const service = await derivManager.getInstance(appId, token);
        const positions = await service.trading.getOpenPositions();
        
        res.json({
            success: true,
            positions
        });
    } catch (err: any) {
        console.error('[Deriv] Get Positions Error:', err);
        const errMessage = err?.message || String(err);
        res.status(500).json({ error: errMessage || 'Failed to fetch positions' });
    }
};

export const getContractStatus = async (req: Request, res: Response) => {
    try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const appId = (req.query.appId as string) || '1089';
        const { contractId } = req.params;
        
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
        if (!contractId) return res.status(400).json({ error: 'Contract ID is required' });
        
        const service = await derivManager.getInstance(appId, token);
        const response = await service.ws.send({
            proposal_open_contract: 1,
            contract_id: Number(contractId)
        });
        
        res.json({
            success: true,
            contract: response.proposal_open_contract
        });
    } catch (err: any) {
        console.error('[Deriv] Get Contract Status Error:', err);
        const errMessage = err?.message || String(err);
        res.status(500).json({ error: errMessage || 'Failed to fetch contract status' });
    }
};

export const closeTrade = async (req: Request, res: Response) => {
    try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const appId = (req.query.appId as string) || '1089';
        const { contractId } = req.body;
        
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
        if (!contractId) return res.status(400).json({ error: 'Contract ID is required' });
        
        const service = await derivManager.getInstance(appId, token);
        
        const result = await service.trading.closeTrade(contractId);
        
        res.json({
            success: true,
            result
        });
    } catch (err: any) {
        console.error('[Deriv] Close Trade Error:', err);
        const errMessage = err?.message || String(err);
        res.status(500).json({ error: errMessage || 'Failed to close trade' });
    }
};
