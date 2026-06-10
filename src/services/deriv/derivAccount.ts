import { DerivWsClient } from './derivWs.js';

export class DerivAccount {
    constructor(private client: DerivWsClient) {}

    public async getBalance(): Promise<{ balance: number; currency: string }> {
        const response = await this.client.send({
            balance: 1
        });
        
        return {
            balance: response.balance.balance,
            currency: response.balance.currency
        };
    }
}
