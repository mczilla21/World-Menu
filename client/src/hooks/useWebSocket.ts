import { useEffect, useRef, useCallback, useState } from 'react';

type MessageHandler = (data: any) => void;
type StatusHandler = () => void;

// Singleton WebSocket connections per role
const connections = new Map<string, {
  ws: WebSocket | null;
  listeners: Set<MessageHandler>;
  statusListeners: Set<StatusHandler>;
  retries: number;
  connectFn: (() => void) | null;
}>();

function getOrCreateConnection(role: string): { ws: WebSocket | null; listeners: Set<MessageHandler> } {
  if (!role) return { ws: null, listeners: new Set() };

  if (!connections.has(role)) {
    const entry = {
      ws: null as WebSocket | null,
      listeners: new Set<MessageHandler>(),
      statusListeners: new Set<StatusHandler>(),
      retries: 0,
      connectFn: null as (() => void) | null,
    };

    const connect = () => {
      if (entry.ws && entry.ws.readyState <= 1) return; // Already open or connecting
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/ws?role=${role}`);
      entry.ws = ws;

      // Every open/close has to notify subscribed components, or the "connected" dot/label
      // freezes at whatever it happened to be on the render before the socket actually
      // settled -- that's what was showing "Reconnecting..." under a live connection.
      ws.onopen = () => { entry.retries = 0; entry.statusListeners.forEach(fn => fn()); };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type !== 'pong') {
            entry.listeners.forEach(fn => fn(data));
          }
        } catch {}
      };

      ws.onclose = () => {
        entry.ws = null;
        entry.statusListeners.forEach(fn => fn());
        // Only reconnect if there are still listeners
        if (entry.listeners.size > 0) {
          const delay = Math.min(1000 * 2 ** entry.retries, 10000);
          entry.retries++;
          setTimeout(connect, delay);
        }
      };

      ws.onerror = () => ws.close();
    };

    entry.connectFn = connect;
    connections.set(role, entry);
    connect();
  }

  return connections.get(role)!;
}

function removeListener(role: string, handler: MessageHandler) {
  const entry = connections.get(role);
  if (!entry) return;
  entry.listeners.delete(handler);
  // If no more listeners, close the connection
  if (entry.listeners.size === 0) {
    entry.ws?.close();
    connections.delete(role);
  }
}

export function useWebSocket(role: string, onMessage: MessageHandler) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Stable wrapper so we can remove it later
  const stableHandler = useCallback((data: any) => {
    onMessageRef.current(data);
  }, []);

  const [connected, setConnected] = useState(() => connections.get(role)?.ws?.readyState === 1);

  useEffect(() => {
    if (!role) return;
    const entry = getOrCreateConnection(role);
    entry.listeners.add(stableHandler);

    const statusHandler = () => setConnected(entry.ws?.readyState === 1);
    entry.statusListeners.add(statusHandler);
    statusHandler();   // sync immediately in case the socket opened between mount and this effect running

    return () => {
      entry.statusListeners.delete(statusHandler);
      removeListener(role, stableHandler);
    };
  }, [role, stableHandler]);

  return { connected };
}
