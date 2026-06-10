import { DerivWsClient } from './derivWs.js';
import { DerivAuth } from './derivAuth.js';
import { DerivAccount } from './derivAccount.js';
import { DerivMarket } from './derivMarket.js';
import { DerivTrading } from './derivTrading.js';

export class DerivService {
    public ws: DerivWsClient;
    public auth: DerivAuth;
    public account: DerivAccount;
    public market: DerivMarket;
    public trading: DerivTrading;

    constructor(appId: string, token: string) {
        this.ws = new DerivWsClient({ appId, token });
        this.auth = new DerivAuth(this.ws, token);
        this.account = new DerivAccount(this.ws);
        this.market = new DerivMarket(this.ws);
        this.trading = new DerivTrading(this.ws);
    }
    
    public async initialize(): Promise<void> {
        await this.ws.connect();
        await this.auth.authorize();
        // Automatically re-authorize when websocket reconnects
        this.ws.onConnect = async () => {
            await this.auth.authorize();
        };
    }
    
    public disconnect(): void {
        this.ws.disconnect();
    }
}
