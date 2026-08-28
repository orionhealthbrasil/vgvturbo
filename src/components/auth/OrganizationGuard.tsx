import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface OrganizationGuardProps {
  children: ReactNode;
}

export function OrganizationGuard({ children }: OrganizationGuardProps) {
  const { data: orgData, isLoading, error, refetch } = useUserOrganization();
  const { user, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    const isAuthError = errorMsg.includes('JWT') || errorMsg.includes('token') || errorMsg.includes('auth') || errorMsg.includes('401');

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-3">
          <p className="font-semibold text-foreground">Não foi possível carregar sua organização</p>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
            {isAuthError ? (
              <Button onClick={async () => { await signOut(); window.location.href = '/auth'; }}>
                Fazer login novamente
              </Button>
            ) : (
              <Button onClick={() => (window.location.href = '/onboarding')}>
                Ir para onboarding
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!orgData) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
