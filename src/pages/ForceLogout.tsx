import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

function clearAuthStorage() {
  // Supabase stores auth state in localStorage keys that start with: sb-<project-ref>-auth-token
  // We clear any key starting with 'sb-' and containing 'auth-token' to be safe across environments.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sb-') && key.includes('auth-token')) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

export default function ForceLogout() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      } finally {
        clearAuthStorage();
        if (!cancelled) navigate('/auth', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 text-foreground">
          <LogOut className="w-5 h-5" />
          <span className="font-semibold">Forçando logout…</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Encerrando sessão e limpando cache local</span>
        </div>
      </div>
    </div>
  );
}
