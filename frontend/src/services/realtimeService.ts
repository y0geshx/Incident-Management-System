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

type UnsubscribeFn = () => void;

let webSocket: WebSocket | null = null;
const listeners: ((event: ApiChangeEvent) => void)[] = [];

function getWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}/api/ws`;
}

export function connectWebSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    try {
      webSocket = new WebSocket(getWebSocketUrl());

      webSocket.onopen = () => {
        console.log("[WebSocket] Connected to realtime updates");
        resolve();
      };

      webSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ApiChangeEvent;
          listeners.forEach((listener) => listener(data));
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

      webSocket.onerror = (err) => {
        console.error("[WebSocket] Connection error:", err);
        reject(new Error("WebSocket connection failed"));
      };

      webSocket.onclose = () => {
        console.log("[WebSocket] Connection closed");
        webSocket = null;
      };
    } catch (err) {
      reject(err);
    }
  });
}

export function disconnectWebSocket(): void {
  if (webSocket) {
    webSocket.close();
    webSocket = null;
  }
}

export function subscribeToChanges(
  listener: (event: ApiChangeEvent) => void
): UnsubscribeFn {
  listeners.push(listener);

  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

export function isWebSocketConnected(): boolean {
  return webSocket !== null && webSocket.readyState === WebSocket.OPEN;
}
