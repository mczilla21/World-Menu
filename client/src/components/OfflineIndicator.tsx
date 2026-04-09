import { useState, useEffect, useCallback } from 'react';
import { getQueueLength, flushQueue } from '../lib/offlineQueue';

export default function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(getQueueLength());
  const [syncing, setSyncing] = useState(false);

  const handleOnline = useCallback(async () => {
    setOnline(true);
    // Auto-flush queue when back online
    if (getQueueLength() > 0) {
      setSyncing(true);
      const synced = await flushQueue();
      setQueueCount(getQueueLength());
      setSyncing(false);
    }
  }, []);

  const handleOffline = useCallback(() => {
    setOnline(false);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodically check queue
    const interval = setInterval(() => {
      setQueueCount(getQueueLength());
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [handleOnline, handleOffline]);

  // Don't show anything if online and no queued items
  if (online && queueCount === 0 && !syncing) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] px-4 py-2 text-center text-sm font-medium ${
      !online
        ? 'bg-red-600 text-white'
        : syncing
        ? 'bg-amber-500 text-amber-950'
        : queueCount > 0
        ? 'bg-amber-500 text-amber-950'
        : 'bg-emerald-500 text-emerald-950'
    }`}>
      {!online && (
        <span>Offline — orders will be saved and sent when connection returns</span>
      )}
      {online && syncing && (
        <span>Syncing {queueCount} queued order{queueCount !== 1 ? 's' : ''}...</span>
      )}
      {online && !syncing && queueCount > 0 && (
        <span>{queueCount} order{queueCount !== 1 ? 's' : ''} pending sync</span>
      )}
    </div>
  );
}
