import { useEffect } from "react";
import {
  connectWebSocket,
  subscribeToChanges,
  ApiChangeEvent,
} from "../services/realtimeService";

export interface UseRealtimeUpdatesOptions {
  onIncidentCreated?: () => void;
  onIncidentUpdated?: (resourceId?: string) => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to realtime API changes via WebSocket.
 * Automatically connects to the WebSocket endpoint on first subscription.
 * Calls the provided callbacks when incidents are created or updated.
 */
export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions = {}) {
  const { onIncidentCreated, onIncidentUpdated, enabled = true } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      try {
        await connectWebSocket();

        unsubscribe = subscribeToChanges((event: ApiChangeEvent) => {
          if (event.resource === "incident") {
            if (
              event.action === "created" &&
              onIncidentCreated
            ) {
              console.log(
                "[Realtime] Incident created:",
                event.resourceId
              );
              onIncidentCreated();
            } else if (
              event.action === "updated" &&
              onIncidentUpdated
            ) {
              console.log(
                "[Realtime] Incident updated:",
                event.resourceId
              );
              onIncidentUpdated(event.resourceId);
            }
          }
        });
      } catch (err) {
        console.warn("[Realtime] Failed to connect to WebSocket:", err);
        // Fallback to polling or silent failure - app still works
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [enabled, onIncidentCreated, onIncidentUpdated]);
}
