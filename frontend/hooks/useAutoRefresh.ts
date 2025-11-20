import React, { useEffect, useCallback } from 'react';

interface AutoRefreshOptions {
  interval?: number;
  enabled?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export function useAutoRefresh(options: AutoRefreshOptions = {}) {
  const {
    interval = 30000, // 30 seconds default
    enabled = true,
    onRefresh
  } = options;

  const refresh = useCallback(async () => {
    if (onRefresh) {
      try {
        await onRefresh();
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || !onRefresh) return;

    // Initial refresh
    refresh();

    // Set up interval
    const intervalId = setInterval(refresh, interval);

    // Cleanup
    return () => clearInterval(intervalId);
  }, [enabled, interval, refresh]);

  return { refresh };
}

// Hook for real-time data synchronization
export function useRealtimeSync<T>(
  fetchData: () => Promise<T>,
  options: AutoRefreshOptions & {
    socketEvent?: string;
    onDataUpdate?: (data: T) => void;
  } = {}
) {
  const {
    socketEvent,
    onDataUpdate,
    ...refreshOptions
  } = options;

  const handleRefresh = useCallback(async () => {
    try {
      const data = await fetchData();
      if (onDataUpdate) {
        onDataUpdate(data);
      }
    } catch (error) {
      console.error('Real-time sync failed:', error);
    }
  }, [fetchData, onDataUpdate]);

  // Use auto-refresh as base
  const { refresh } = useAutoRefresh({
    ...refreshOptions,
    onRefresh: handleRefresh
  });

  // Additional real-time updates via socket events
  useEffect(() => {
    if (!socketEvent) return;

    // This would integrate with socket events
    // For now, we'll rely on the auto-refresh mechanism
    const handleSocketEvent = () => {
      refresh();
    };

    // Placeholder for socket integration
    // socket.on(socketEvent, handleSocketEvent);

    return () => {
      // socket.off(socketEvent, handleSocketEvent);
    };
  }, [socketEvent, refresh]);

  return { refresh };
}

// Hook for optimistic updates with auto-sync
export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (data: T) => Promise<T>,
  options: {
    autoSync?: boolean;
    syncInterval?: number;
    onError?: (error: Error) => void;
  } = {}
) {
  const [data, setData] = React.useState<T>(initialData);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const update = useCallback(async (newData: T) => {
    setIsUpdating(true);
    try {
      // Optimistic update
      setData(newData);

      // Persist to server
      const result = await updateFn(newData);
      setData(result);
    } catch (error) {
      // Revert on error
      setData(initialData);
      if (options.onError) {
        options.onError(error as Error);
      }
    } finally {
      setIsUpdating(false);
    }
  }, [initialData, updateFn, options.onError]);

  // Auto-sync functionality
  useAutoRefresh({
    enabled: options.autoSync,
    interval: options.syncInterval || 60000, // 1 minute default
    onRefresh: async () => {
      try {
        const freshData = await updateFn(data);
        setData(freshData);
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }
  });

  return { data, update, isUpdating };
}