# WebSocket Realtime Updates

This document describes the WebSocket implementation for pushing API changes immediately to connected clients.

## Overview

The Incident Management System now uses WebSockets to push real-time updates when incidents are created, updated, or when RCA submissions occur. This eliminates polling latency and ensures the frontend displays the latest state immediately.

## Architecture

### Backend (TypeScript + ws)

**File**: [backend/src/realtime/ApiChangeBroadcaster.ts](../../backend/src/realtime/ApiChangeBroadcaster.ts)

- **ApiChangeBroadcaster**: Manages WebSocket server attached to the Express HTTP server at `/api/ws`
- **RealtimeBroadcaster interface**: Abstracts the broadcaster for testing and future implementations
- **NoopRealtimeBroadcaster**: No-op implementation for testing services without WebSocket overhead

**Wire Points**:
- [IncidentManagementService](../../backend/src/services/IncidentManagementService.ts): Broadcasts when incidents are created, transitioned, or RCA is submitted
- [SignalProcessingService](../../backend/src/services/SignalProcessingService.ts): Broadcasts when debounce flush creates or updates an incident
- [IMSApplication](../../backend/src/index.ts): Attaches the broadcaster to the HTTP server on startup

**Broadcast Event Format**:
```typescript
interface ApiChangeEvent {
  type: "api-change";
  resource: "incident" | "signal" | "health";
  action: "created" | "updated" | "deleted" | "processed";
  resourceId?: string;  // The ID of the changed resource
  timestamp: string;    // ISO timestamp
  message: string;      // Human-readable description
}
```

### Frontend (React + TypeScript)

**Service**: [frontend/src/services/realtimeService.ts](../../frontend/src/services/realtimeService.ts)

- `connectWebSocket()`: Establishes the WebSocket connection
- `disconnectWebSocket()`: Closes the connection
- `subscribeToChanges(listener)`: Register a listener for API change events
- `isWebSocketConnected()`: Check connection status

**Hook**: [frontend/src/hooks/useRealtimeUpdates.ts](../../frontend/src/hooks/useRealtimeUpdates.ts)

```typescript
useRealtimeUpdates({
  onIncidentCreated?: () => void;
  onIncidentUpdated?: (resourceId?: string) => void;
  enabled?: boolean;
})
```

Automatically connects on first subscription and triggers the appropriate callback when incidents are created or updated.

**Integrated Pages**:
- `DashboardPage`: Refreshes incident list on creation or update
- `IncidentDetailPage`: Refreshes the current incident on any update
- `MetricsPage`: Refreshes metrics when incidents change

## Connection Flow

1. **Page Mount**: Component calls `useRealtimeUpdates()`
2. **Hook Setup**: Hook calls `connectWebSocket()` on first render
3. **WebSocket Init**: Browser initiates connection to `ws://localhost:3001/api/ws`
4. **Connection Open**: WebSocket server accepts connection
5. **Event Stream**: Backend sends events when incidents change
6. **Message Handler**: Frontend receives JSON and calls registered listeners
7. **Callback Trigger**: Component callback triggers (e.g., `onIncidentUpdated`)
8. **Refresh**: Page refreshes data via REST API (e.g., `fetchIncidents()`)

## Benefits

- **Lower Latency**: No polling delay; updates arrive within milliseconds
- **Reduced Server Load**: No constant polling requests cluttering the network
- **Better UX**: Users see incident changes as they happen
- **Graceful Fallback**: If WebSocket connection fails, polling still works
- **Clean Separation**: WebSocket is purely additive; REST API unchanged

## Testing

### Backend Test
Run regression tests for broadcast emissions:

```bash
npm --prefix backend test -- realtime-broadcast.test.ts
```

Tests verify that:
- Incident creation triggers a "created" broadcast
- Incident state transitions trigger an "updated" broadcast

### Manual Test

1. **Start the backend**:
   ```bash
   npm --prefix backend run dev
   ```

2. **Start the frontend**:
   ```bash
   npm --prefix frontend run dev
   ```

3. **Open the dashboard** in two browser windows

4. **In one window**, emit a random signal:
   - Click **⚡ Emit Random Signal** button

5. **In both windows**, observe:
   - New incident appears immediately (WebSocket push)
   - No need to wait for the 5-second polling interval

6. **In incident detail**, change status:
   - Click **🔍 Start Investigation**
   - Other window's detail page updates immediately if viewing the same incident

## Configuration

### Environment Variables

No new environment variables are required. The WebSocket endpoint is automatically served at `/api/ws` relative to the API base URL.

The WebSocket path can be customized in [backend/src/realtime/ApiChangeBroadcaster.ts](../../backend/src/realtime/ApiChangeBroadcaster.ts) by modifying the `path` option in `WebSocketServer()`.

### Vite Proxy

The frontend Vite dev server automatically proxies WebSocket connections. In production, your reverse proxy (nginx, Caddy, etc.) must forward WebSocket upgrades to the backend:

```nginx
# Example nginx configuration
location /api/ws {
    proxy_pass http://backend:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## Deployment Notes

- **Docker Compose**: Already configured in [docker-compose.yml](../../docker-compose.yml); no changes needed
- **Kubernetes**: Ensure your ingress/load balancer forwards WebSocket upgrade headers
- **Scaling**: Each instance listens on its own WebSocket port; clients connect to their nearest instance and receive updates only for incidents processed on that instance (intended behavior)

## Future Enhancements

- Add room-based subscriptions (e.g., `subscribe("incident:incident-123")`) for filtered updates
- Implement presence tracking (who is viewing which incident)
- Add typing indicators during RCA form submission
- Broadcast health status changes to trigger status page updates
