import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const ENABLED_KEY = 'browser_notifications_enabled';
const THROTTLE_MS = 10_000; // 1 notif por contato a cada 10s
const APP_ICON_PATH = '/favicon.png';

function resolveIcon(icon?: string | null): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const target = icon || APP_ICON_PATH;
    return new URL(target, window.location.origin).toString();
  } catch {
    return undefined;
  }
}

type MediaKind = 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | string;

function previewForMessage(content: string | null | undefined, type: MediaKind | null | undefined): string {
  const t = (type || '').toLowerCase();
  if (t === 'audio' || t === 'ptt' || t === 'voice') return '🎤 Áudio';
  if (t === 'image') return '📷 Imagem';
  if (t === 'video') return '🎥 Vídeo';
  if (t === 'document' || t === 'file') return '📎 Documento';
  if (t === 'sticker') return '💟 Sticker';
  if (t === 'location') return '📍 Localização';
  if (t === 'contact' || t === 'vcard') return '👤 Contato';
  const c = (content || '').trim();
  if (!c) return 'Nova mensagem';
  return c.length > 120 ? c.slice(0, 117) + '…' : c;
}

function detectInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access threw → estamos em iframe cross-origin
    return true;
  }
}

export type NotificationFailureReason =
  | 'unsupported'
  | 'iframe'
  | 'denied'
  | 'default'
  | 'disabled'
  | 'hidden-skip'
  | 'throttled'
  | 'error';

export interface ShowBrowserNotificationArgs {
  contactId: string;
  title: string;
  body?: string | null;
  messageType?: string | null;
  icon?: string | null;
  /** rota a navegar quando o usuário clicar (default: /chat?contact={contactId}) */
  url?: string;
  /** força disparo mesmo se a aba estiver visível */
  force?: boolean;
}

export interface ShowResult {
  ok: boolean;
  reason?: NotificationFailureReason;
}

export function useBrowserNotifications() {
  const isInIframe = useMemo(() => detectInIframe(), []);
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (!isSupported) return 'unsupported';
    return Notification.permission;
  });
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ENABLED_KEY) === 'true';
  });
  const lastShownRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    localStorage.setItem(ENABLED_KEY, String(isEnabled));
  }, [isEnabled]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    if (!isSupported) {
      console.warn('[BrowserNotification] Notifications API não suportada neste navegador.');
      return 'denied';
    }
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return 'granted';
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        console.warn(
          `[BrowserNotification] Permissão = "${result}".` +
            (isInIframe
              ? ' Você está em um iframe cross-origin (ex.: preview do Lovable). Abra a app em janela própria (URL publicada) para ativar.'
              : ' Verifique configurações do navegador.'),
        );
      }
      return result;
    } catch (err) {
      console.warn('[BrowserNotification] requestPermission falhou:', err);
      return 'denied';
    }
  }, [isSupported, isInIframe]);

  const enable = useCallback(async (): Promise<{ ok: boolean; reason?: NotificationFailureReason }> => {
    if (!isSupported) {
      setIsEnabled(false);
      return { ok: false, reason: 'unsupported' };
    }
    const res = await requestPermission();
    if (res === 'granted') {
      setIsEnabled(true);
      return { ok: true };
    }
    setIsEnabled(false);
    if (isInIframe) return { ok: false, reason: 'iframe' };
    if (res === 'denied') return { ok: false, reason: 'denied' };
    return { ok: false, reason: 'default' };
  }, [isSupported, isInIframe, requestPermission]);

  const disable = useCallback(() => setIsEnabled(false), []);

  const showNotification = useCallback(
    (args: ShowBrowserNotificationArgs): ShowResult => {
      if (!isSupported) return { ok: false, reason: 'unsupported' };
      if (!args.force && !isEnabled) return { ok: false, reason: 'disabled' };
      if (Notification.permission !== 'granted') {
        if (isInIframe) return { ok: false, reason: 'iframe' };
        return { ok: false, reason: Notification.permission === 'denied' ? 'denied' : 'default' };
      }
      // Só notifica se a aba não estiver visível (a menos que force=true)
      if (!args.force && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        return { ok: false, reason: 'hidden-skip' };
      }

      // Throttle por contato
      const now = Date.now();
      const last = lastShownRef.current.get(args.contactId) ?? 0;
      if (!args.force && now - last < THROTTLE_MS) return { ok: false, reason: 'throttled' };
      lastShownRef.current.set(args.contactId, now);

      try {
        const body = previewForMessage(args.body, args.messageType);
        const iconUrl = resolveIcon(args.icon);
        const targetUrl = args.url || `/chat?contact=${encodeURIComponent(args.contactId)}`;
        const notifOpts: NotificationOptions = {
          body,
          tag: `contact-${args.contactId}`,
          data: { url: targetUrl },
          ...({ renotify: true, silent: false } as Record<string, unknown>),
        };
        if (iconUrl) {
          notifOpts.icon = iconUrl;
          notifOpts.badge = iconUrl;
        }

        // Preferir Service Worker (caminho confiável no Windows/Chrome)
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then((reg) => {
              reg.showNotification(args.title, notifOpts);
              console.info('[BrowserNotification] via SW', { title: args.title, contactId: args.contactId, icon: iconUrl });
            })
            .catch((err) => {
              console.warn('[BrowserNotification] SW falhou, usando Notification()', err);
              try {
                const n = new Notification(args.title, notifOpts);
                n.onclick = () => {
                  window.focus();
                  try {
                    window.location.assign(new URL(targetUrl, window.location.origin).toString());
                  } catch { /* noop */ }
                  n.close();
                };
                setTimeout(() => n.close(), 8000);
              } catch (e) {
                console.warn('[BrowserNotification] Notification() também falhou', e);
              }
            });
          return { ok: true };
        }

        const n = new Notification(args.title, notifOpts);
        console.info('[BrowserNotification] disparada', { title: args.title, contactId: args.contactId, icon: iconUrl });
        n.onclick = () => {
          try {
            window.focus();
            const url = new URL(targetUrl, window.location.origin);
            if (window.location.pathname + window.location.search !== url.pathname + url.search) {
              window.location.assign(url.toString());
            }
          } catch {
            window.focus();
          }
          n.close();
        };
        setTimeout(() => n.close(), 8000);
        return { ok: true };
      } catch (err) {
        console.warn('[BrowserNotification] falha ao exibir:', err);
        return { ok: false, reason: 'error' };
      }
    },
    [isSupported, isEnabled, isInIframe],
  );

  const testNotification = useCallback((): ShowResult => {
    return showNotification({
      contactId: 'test',
      title: 'VGV Turbo',
      body: 'Notificações ativas! Você receberá alertas de novas mensagens.',
      force: true,
    });
  }, [showNotification]);

  return {
    isSupported,
    isInIframe,
    permission,
    isEnabled,
    enable,
    disable,
    requestPermission,
    showNotification,
    testNotification,
  };
}
