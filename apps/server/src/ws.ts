import { WebSocketServer, WebSocket } from 'ws';

export interface AppEvent {
  seq: number;
  ts: number;
  runId: string;
  type: string;
  payload: any;
}

export class EventBroadcaster {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private seq = 0;
  private eventHistory: AppEvent[] = [];

  init(server: any) {
    this.wss = new WebSocketServer({ server, path: '/ws/events' });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log(`[WS] Client connected. Total: ${this.clients.size}`);

      // Send last 50 events on connect for initial sync
      const recent = this.eventHistory.slice(-50);
      for (const ev of recent) {
        ws.send(JSON.stringify(ev));
      }

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
      });
    });
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
        client.send(raw);
      }
    }

    return event;
  }

  getRecentEvents(limit = 100) {
    return this.eventHistory.slice(-limit);
  }
}

export const eventHub = new EventBroadcaster();
