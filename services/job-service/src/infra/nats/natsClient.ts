import type { ConnectionOptions, NatsConnection } from 'nats';

let natsConnection: NatsConnection | null = null;

export async function initNatsConnection(options: ConnectionOptions): Promise<NatsConnection> {
  if (natsConnection) {
    return natsConnection;
  }

  const { connect } = await import('nats');
  natsConnection = await connect(options);
  return natsConnection;
}

export function getNatsConnection(): NatsConnection {
  if (!natsConnection) {
    throw new Error('NATS connection has not been initialised.');
  }

  return natsConnection;
}

export function getNatsConnectionOrNull(): NatsConnection | null {
  return natsConnection;
}

export async function closeNatsConnection(): Promise<void> {
  if (!natsConnection) {
    return;
  }

  await natsConnection.drain();
  natsConnection = null;
}
