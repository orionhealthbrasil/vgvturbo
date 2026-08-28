import { ReactNode } from 'react';
import { useCanAccess, Permission } from '@/hooks/usePermissions';
import { ShieldX, Loader2 } from 'lucide-react';
import { useUserPermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  children: ReactNode;
  permission: Permission;
  requireEdit?: boolean;
  fallback?: ReactNode;
}

export function PermissionGuard({
  children,
  permission,
  requireEdit = false,
  fallback,
}: PermissionGuardProps) {
  const { canView, canEdit } = useCanAccess(permission);
  const { isLoading } = useUserPermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasAccess = requireEdit ? canEdit : canView;

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <ShieldX className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          Você não tem permissão para acessar esta página.
          Entre em contato com o administrador da sua organização.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

interface PermissionGateProps {
  children: ReactNode;
  permission: Permission;
  requireEdit?: boolean;
}

export function PermissionGate({ children, permission, requireEdit = false }: PermissionGateProps) {
  const { canView, canEdit } = useCanAccess(permission);
  const hasAccess = requireEdit ? canEdit : canView;
  if (!hasAccess) return null;
  return <>{children}</>;
}
