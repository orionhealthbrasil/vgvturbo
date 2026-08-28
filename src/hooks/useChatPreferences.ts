import { useCallback, useEffect, useState } from 'react';

const SHOW_SENDER_NAME_KEY = 'chat_show_sender_name';
const UNREAD_ON_TOP_KEY = 'chat_unread_on_top';

export function useChatPreferences() {
  const [showSenderName, setShowSenderName] = useState(() => {
    const stored = localStorage.getItem(SHOW_SENDER_NAME_KEY);
    return stored !== 'false'; // Default to true
  });

  const [unreadOnTop, setUnreadOnTop] = useState(() => {
    const stored = localStorage.getItem(UNREAD_ON_TOP_KEY);
    return stored === 'true'; // Default to false
  });

  useEffect(() => {
    localStorage.setItem(SHOW_SENDER_NAME_KEY, String(showSenderName));
  }, [showSenderName]);

  useEffect(() => {
    localStorage.setItem(UNREAD_ON_TOP_KEY, String(unreadOnTop));
    // Notify other components/tabs
    window.dispatchEvent(new CustomEvent('chat-preferences-changed'));
  }, [unreadOnTop]);

  const toggleShowSenderName = useCallback(() => {
    setShowSenderName((prev) => !prev);
  }, []);

  const toggleUnreadOnTop = useCallback(() => {
    setUnreadOnTop((prev) => !prev);
  }, []);

  return {
    showSenderName,
    setShowSenderName,
    toggleShowSenderName,
    unreadOnTop,
    setUnreadOnTop,
    toggleUnreadOnTop,
  };
}
