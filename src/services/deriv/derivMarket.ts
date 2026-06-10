import { DerivWsClient } from './derivWs.js';

export interface TickResponse {
    symbol: string;
    quote: number;
    epoch: number;
}

export class DerivMarket {
    constructor(private client: DerivWsClient) {}

    public async subscribeTicks(symbol: string, callback: (tick: TickResponse) => void): Promise<string> {
        const response = await this.client.send({
            ticks: symbol,
            subscribe: 1
        });

        const subscriptionId = response.subscription?.id;

        // Listen for new ticks
        this.client.on('tick', (data) => {
            if (data.tick && data.tick.symbol === symbol) {
                callback({
                    symbol: data.tick.symbol,
                    quote: data.tick.quote,
                    epoch: data.tick.epoch
                });
            }
        });

        return subscriptionId;
    }

    public async unsubscribeTicks(subscriptionId: string): Promise<boolean> {
        const response = await this.client.send({
            forget: subscriptionId
        });
        return response.forget === 1;
    }
}
