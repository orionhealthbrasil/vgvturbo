import { useState, useCallback } from 'react';

export interface SelectedMessage {
  id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  created_at: string;
  // Source info
  senderName?: string | null;
  direction?: string;
}

export function useMessageSelection() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Map<string, SelectedMessage>>(new Map());

  const startSelecting = useCallback((initialMessage?: SelectedMessage) => {
    setIsSelecting(true);
    if (initialMessage) {
      setSelectedMessages(new Map([[initialMessage.id, initialMessage]]));
    }
  }, []);

  const stopSelecting = useCallback(() => {
    setIsSelecting(false);
    setSelectedMessages(new Map());
  }, []);

  const toggleMessage = useCallback((message: SelectedMessage) => {
    setSelectedMessages(prev => {
      const next = new Map(prev);
      if (next.has(message.id)) {
        next.delete(message.id);
      } else {
        next.set(message.id, message);
      }
      return next;
    });
  }, []);

  // Get messages sorted by created_at
  const getOrderedMessages = useCallback(() => {
    return Array.from(selectedMessages.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [selectedMessages]);

  return {
    isSelecting,
    selectedMessages,
    selectedCount: selectedMessages.size,
    startSelecting,
    stopSelecting,
    toggleMessage,
    getOrderedMessages,
  };
}
