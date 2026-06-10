import { DerivWsClient } from './derivWs.js';

export class DerivAuth {
    constructor(private client: DerivWsClient, private token: string) {}

    public async authorize(): Promise<any> {
        try {
            const response = await this.client.send({
                authorize: this.token
            });
            return response.authorize;
        } catch (error) {
            console.error("Deriv authorization failed:", error);
            throw error;
        }
    }
}
