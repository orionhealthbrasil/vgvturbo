import { useRef, useCallback } from 'react';

interface QueuedMessage {
  execute: () => Promise<void>;
  resolve: () => void;
  reject: (error: any) => void;
}

/**
 * Hook to ensure messages are sent sequentially to preserve order.
 * Each message waits for the previous one to complete before being sent.
 */
export function useMessageQueue() {
  const queueRef = useRef<QueuedMessage[]>([]);
  const isProcessingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;

    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      
      try {
        await item.execute();
        item.resolve();
      } catch (error) {
        item.reject(error);
      }
      
      // Remove processed item
      queueRef.current.shift();
    }

    isProcessingRef.current = false;
  }, []);

  const enqueue = useCallback((execute: () => Promise<void>): Promise<void> => {
    return new Promise((resolve, reject) => {
      queueRef.current.push({ execute, resolve, reject });
      processQueue();
    });
  }, [processQueue]);

  return { enqueue };
}
