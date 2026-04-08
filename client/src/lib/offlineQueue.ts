// Offline queue — stores failed requests and retries when back online

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body: string;
  timestamp: number;
}

const QUEUE_KEY = 'worldmenu_offline_queue';

function getQueue(): QueuedRequest[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedRequest[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(url: string, method: string, body: any) {
  const queue = getQueue();
  queue.push({
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    method,
    body: JSON.stringify(body),
    timestamp: Date.now(),
  });
  saveQueue(queue);
}

export function getQueueLength(): number {
  return getQueue().length;
}

export async function flushQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  const failed: QueuedRequest[] = [];
  let synced = 0;

  for (const req of queue) {
    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body: req.body,
      });
      if (res.ok) {
        synced++;
      } else {
        failed.push(req);
      }
    } catch {
      failed.push(req);
    }
  }

  saveQueue(failed);
  return synced;
}

// Enhanced fetch that queues on failure for POST/PATCH requests
export async function resilientFetch(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (err) {
    // Network error — queue if it's a write operation
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH'].includes(method) && options.body) {
      enqueue(url, method, JSON.parse(options.body as string));

      // Return a fake successful response so the UI doesn't break
      return new Response(JSON.stringify({ ok: true, queued: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw err;
  }
}
