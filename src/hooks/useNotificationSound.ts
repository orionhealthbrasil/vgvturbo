import { useCallback, useRef, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const WHATSAPP_SOUND_URL = '/sounds/notification.mp3';
const SOUND_ENABLED_KEY = 'notification_sound_enabled';

export type SoundType = 'whatsapp' | 'internal';

// Generate a soft chime sound for internal chat using Web Audio API
const createInternalChatSound = (audioContext: AudioContext) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.4);
};

export function useNotificationSound() {
  const whatsappAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Start from localStorage so UI is instant; sync with DB in the background
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    const stored = localStorage.getItem(SOUND_ENABLED_KEY);
    return stored === 'true'; // default false until DB responds
  });

  // On mount: load preference from DB (overrides localStorage)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('notification_sound_enabled')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data && typeof data.notification_sound_enabled === 'boolean') {
            setIsSoundEnabled(data.notification_sound_enabled);
            localStorage.setItem(SOUND_ENABLED_KEY, String(data.notification_sound_enabled));
          }
        });
    });
  }, []);

  // Initialize audio elements
  useEffect(() => {
    whatsappAudioRef.current = new Audio(WHATSAPP_SOUND_URL);
    whatsappAudioRef.current.volume = 0.7;
    whatsappAudioRef.current.preload = 'auto';

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playNotificationSound = useCallback((type: SoundType = 'whatsapp') => {
    if (!isSoundEnabled) return;

    if (type === 'whatsapp' && whatsappAudioRef.current) {
      whatsappAudioRef.current.currentTime = 0;
      whatsappAudioRef.current.play().catch(() => {});
    } else if (type === 'internal') {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      createInternalChatSound(audioContextRef.current);
    }
  }, [isSoundEnabled]);

  const toggleSound = useCallback(() => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      // Persist locally (instant feedback)
      localStorage.setItem(SOUND_ENABLED_KEY, String(next));
      // Persist to DB (fire-and-forget — must chain .then()/await or the
      // Supabase query builder never actually sends the request)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        return supabase
          .from('profiles')
          .update({ notification_sound_enabled: next })
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) console.error('Failed to persist sound preference:', error);
          });
      });
      return next;
    });
  }, []);

  return {
    playNotificationSound,
    isSoundEnabled,
    setIsSoundEnabled,
    toggleSound
  };
}
