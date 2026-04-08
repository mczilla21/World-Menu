type WebSocket = any;

const clients = new Map<string, Set<WebSocket>>();

export function addClient(role: string, ws: WebSocket) {
  if (!clients.has(role)) clients.set(role, new Set());
  clients.get(role)!.add(ws);
}

export function removeClient(role: string, ws: WebSocket) {
  clients.get(role)?.delete(ws);
}

export function broadcastToRole(role: string, message: object) {
  const payload = JSON.stringify(message);
  clients.get(role)?.forEach(ws => {
    if (ws.readyState === 1) ws.send(payload);
  });
}

export function broadcastToAll(message: object) {
  const payload = JSON.stringify(message);
  for (const group of clients.values()) {
    group.forEach(ws => {
      if (ws.readyState === 1) ws.send(payload);
    });
  }
}

export function broadcastToTable(tableNumber: string, message: object) {
  const payload = JSON.stringify(message);
  const key = `table-${tableNumber}`;
  clients.get(key)?.forEach(ws => {
    if (ws.readyState === 1) ws.send(payload);
  });
}
