import http from "http";
import { WebSocket, WebSocketServer } from "ws";

export type ApiChangeResource = "incident" | "signal" | "health";

export type ApiChangeAction = "created" | "updated" | "deleted" | "processed";

export interface ApiChangeEvent {
  type: "api-change";
  resource: ApiChangeResource;
  action: ApiChangeAction;
  resourceId?: string;
  timestamp: string;
  message: string;
}

export interface RealtimeBroadcaster {
  broadcast(event: ApiChangeEvent): void;
}

export class NoopRealtimeBroadcaster implements RealtimeBroadcaster {
  broadcast(_event: ApiChangeEvent): void {
    return;
  }
}

export class ApiChangeBroadcaster implements RealtimeBroadcaster {
  private webSocketServer?: WebSocketServer;

  attach(server: http.Server): void {
    this.webSocketServer = new WebSocketServer({
      server,
      path: "/api/ws",
    });
  }

  broadcast(event: ApiChangeEvent): void {
    if (!this.webSocketServer) {
      return;
    }

    const payload = JSON.stringify(event);

    for (const client of this.webSocketServer.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  async close(): Promise<void> {
    if (!this.webSocketServer) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.webSocketServer?.close(() => resolve());
    });
  }
}