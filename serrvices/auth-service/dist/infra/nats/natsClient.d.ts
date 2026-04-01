import type { ConnectionOptions, NatsConnection } from 'nats';
export declare function initNatsConnection(options: ConnectionOptions): Promise<NatsConnection>;
export declare function getNatsConnection(): NatsConnection;
export declare function getNatsConnectionOrNull(): NatsConnection | null;
export declare function closeNatsConnection(): Promise<void>;
//# sourceMappingURL=natsClient.d.ts.map