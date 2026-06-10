export interface DerivConfig {
    appId: string;
    token: string;
    endpoint?: string;
}

export interface DerivResponse<T = any> {
    msg_type: string;
    error?: {
        code: string;
        message: string;
    };
    [key: string]: any;
}
