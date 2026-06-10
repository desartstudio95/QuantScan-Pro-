import { DerivWsClient } from './derivWs.js';

export interface ExecuteTradeParams {
    symbol: string;
    contract_typeBase: 'CALL' | 'PUT' | 'MULTUP' | 'MULTDOWN';
    amount: number;
    currency?: string;
    duration?: number;
    duration_unit?: 's' | 'm' | 'h' | 'd' | 't';
    basis?: 'stake' | 'payout';
    multiplier?: number;
}

export class DerivTrading {
    constructor(private client: DerivWsClient) {}

    public async executeTrade(params: ExecuteTradeParams): Promise<any> {
        const parameters: any = {
            amount: params.amount,
            basis: params.basis || 'stake',
            contract_type: params.contract_typeBase,
            currency: params.currency || 'USD',
            symbol: params.symbol,
        };

        if (params.duration && params.duration_unit) {
             parameters.duration = params.duration;
             parameters.duration_unit = params.duration_unit;
        }

        if (params.multiplier) {
             parameters.multiplier = params.multiplier;
        }

        const response = await this.client.send({
            buy: 1,
            price: params.amount,
            parameters
        });

        return response.buy;
    }

    public async closeTrade(contractId: number): Promise<any> {
        const response = await this.client.send({
            sell: contractId,
            price: 0 // 0 means sell at market price
        });
        
        return response.sell;
    }

    public async getOpenPositions(): Promise<any[]> {
        const response = await this.client.send({
            portfolio: 1
        });
        
        return response.portfolio.contracts;
    }
}
