import { WebSocketServer, WebSocket } from 'ws';

export interface AppEvent {
  seq: number;
  ts: number;
  runId: string;
  type: string;
  payload: any;
}

type HeartbeatSocket = WebSocket & { isAlive?: boolean };

const HEARTBEAT_INTERVAL_MS = 30_000;

export class EventBroadcaster {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private seq = 0;
  private eventHistory: AppEvent[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;

  init(server: any) {
    this.wss = new WebSocketServer({ server, path: '/ws/events' });

    this.wss.on('error', (err) => {
      console.error('[WS] WebSocketServer error:', err.message);
    });

    this.wss.on('connection', (ws) => {
      const tracked: HeartbeatSocket = ws;
      tracked.isAlive = true;
      this.clients.add(ws);
      console.log(`[WS] Client connected. Total: ${this.clients.size}`);

      ws.on('pong', () => {
        tracked.isAlive = true;
      });

      ws.on('error', (err) => {
        console.error('[WS] Socket error:', err.message);
        this.clients.delete(ws);
        console.log(`[WS] Client removed after error. Total: ${this.clients.size}`);
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
      });

      // Send last 50 events on connect for initial sync
      const recent = this.eventHistory.slice(-50);
      for (const ev of recent) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(ev));
        }
      }
    });

    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients) {
        const tracked: HeartbeatSocket = client;
        if (tracked.isAlive === false) {
          this.clients.delete(client);
          client.terminate();
          console.log(`[WS] Terminated dead connection. Total: ${this.clients.size}`);
          continue;
        }
        tracked.isAlive = false;
        try {
          client.ping();
        } catch {
          this.clients.delete(client);
          client.terminate();
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref?.();
  }

  stop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const client of this.clients) client.terminate();
    this.clients.clear();
    this.wss?.close();
  }

  broadcast(type: string, payload: any, runId = 'default-run') {
    this.seq += 1;
    const event: AppEvent = {
      seq: this.seq,
      ts: Date.now(),
      runId,
      type,
      payload,
    };

    this.eventHistory.push(event);
    if (this.eventHistory.length > 500) {
      this.eventHistory.shift();
    }

    const raw = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(raw);
        } catch (err: any) {
          console.error('[WS] Failed to send to client:', err?.message || err);
          this.clients.delete(client);
        }
      }
    }

    return event;
  }

  getRecentEvents(limit = 100) {
    return this.eventHistory.slice(-limit);
  }
}

export const eventHub = new EventBroadcaster();
