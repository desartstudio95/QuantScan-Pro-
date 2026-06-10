import WebSocket from 'ws';
import { DerivConfig } from './types.js';

export class DerivWsClient {
    private ws: WebSocket | null = null;
    private config: DerivConfig;
    private messageCounter = 1;
    private pendingRequests: Map<number, { resolve: (value: any) => void, reject: (reason?: any) => void }> = new Map();
    private eventListeners: Map<string, ((data: any) => void)[]> = new Map();

    constructor(config: DerivConfig) {
        this.config = {
            endpoint: 'wss://ws.binaryws.com/websockets/v3',
            ...config
        };
    }

    private connectionPromise: Promise<void> | null = null;

    public onConnect?: () => Promise<void>;

    public async connect(): Promise<void> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            const wsUrl = `${this.config.endpoint}?app_id=${this.config.appId}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', async () => {
                if (this.onConnect) {
                    try {
                        await this.onConnect();
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    resolve();
                }
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const response = JSON.parse(data.toString());
                    const reqId = response.req_id;

                    if (reqId && this.pendingRequests.has(reqId)) {
                        const { resolve, reject } = this.pendingRequests.get(reqId)!;
                        this.pendingRequests.delete(reqId);
                        
                        if (response.error) {
                            reject(response.error);
                        } else {
                            resolve(response);
                        }
                    }

                    // Handle subscriptions
                    if (response.msg_type) {
                        const listeners = this.eventListeners.get(response.msg_type) || [];
                        listeners.forEach(listener => listener(response));
                    }
                } catch (err) {
                    console.error("Error parsing Deriv WS message:", err);
                }
            });

            this.ws.on('error', (err) => {
                this.connectionPromise = null;
                reject(err);
            });
            
            this.ws.on('close', () => {
                this.ws = null;
                this.connectionPromise = null;
                this.pendingRequests.forEach(({ reject }) => reject(new Error('WebSocket closed')));
                this.pendingRequests.clear();
            });
        });

        return this.connectionPromise;
    }

    public async send(request: any): Promise<any> {
        if (!request.authorize) {
             await this.connect();
        }
        
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket is not open'));
            }

            const reqId = this.messageCounter++;
            this.pendingRequests.set(reqId, { resolve, reject });
            
            this.ws.send(JSON.stringify({
                ...request,
                req_id: reqId
            }));
        });
    }

    public on(msgType: string, callback: (data: any) => void) {
        const listeners = this.eventListeners.get(msgType) || [];
        listeners.push(callback);
        this.eventListeners.set(msgType, listeners);
    }

    public off(msgType: string, callback: (data: any) => void) {
        const listeners = this.eventListeners.get(msgType) || [];
        this.eventListeners.set(msgType, listeners.filter(cb => cb !== callback));
    }

    public disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
