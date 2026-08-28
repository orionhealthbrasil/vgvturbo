import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, ShieldCheck, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  useRolePermissions,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type MemberRole,
  type Permission,
  type RolePermission,
} from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  organizationId: string;
}

const ROLES: MemberRole[] = ['admin', 'analyst', 'viewer'];
const PERMISSIONS: Permission[] = [
  'dashboard',
  'chat',
  'contacts',
  'pipeline',
  'pipeline_edit',
  'analytics',
  'automations',
  'broadcast',
  'support',
  'internal_chat',
  'squad_ai',
  'tasks',
  'projects',
  'goals',
  'forms',
  'bookings_view',
  'bookings_manage',
  'connection',
  'settings',
  'new_review',
];

type Cell = { canView: boolean; canEdit: boolean };
type Matrix = Record<MemberRole, Record<Permission, Cell>>;

function emptyMatrix(): Matrix {
  return ROLES.reduce((acc, r) => {
    acc[r] = PERMISSIONS.reduce((acc2, p) => {
      acc2[p] = { canView: false, canEdit: false };
      return acc2;
    }, {} as Record<Permission, Cell>);
    return acc;
  }, {} as Matrix);
}

function buildMatrix(rows: RolePermission[], orgId: string): Matrix {
  const m = emptyMatrix();
  // First apply globals
  rows
    .filter((r) => r.organization_id == null)
    .forEach((r) => {
      if (m[r.role] && PERMISSIONS.includes(r.permission)) {
        m[r.role][r.permission] = { canView: r.can_view, canEdit: r.can_edit };
      }
    });
  // Then overrides
  rows
    .filter((r) => r.organization_id === orgId)
    .forEach((r) => {
      if (m[r.role] && PERMISSIONS.includes(r.permission)) {
        m[r.role][r.permission] = { canView: r.can_view, canEdit: r.can_edit };
      }
    });
  return m;
}

export function PermissionsMatrix({ organizationId }: Props) {
  const qc = useQueryClient();
  const { data: rolePermissions = [], isLoading } = useRolePermissions(organizationId);
  const baseMatrix = useMemo(
    () => buildMatrix(rolePermissions, organizationId),
    [rolePermissions, organizationId]
  );
  const [matrix, setMatrix] = useState<Matrix>(baseMatrix);
  const [baseSnapshot, setBaseSnapshot] = useState<string>(() => JSON.stringify(baseMatrix));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextSnapshot = JSON.stringify(baseMatrix);
    if (nextSnapshot !== baseSnapshot) {
      setBaseSnapshot(nextSnapshot);
      setMatrix(baseMatrix);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMatrix]);

  const dirty = useMemo(
    () => JSON.stringify(matrix) !== baseSnapshot,
    [matrix, baseSnapshot]
  );

  const toggle = (role: MemberRole, permission: Permission, key: 'canView' | 'canEdit') => {
    setMatrix((prev) => {
      const next = { ...prev, [role]: { ...prev[role] } };
      const current = next[role][permission];
      const updated = { ...current, [key]: !current[key] };
      // If turning off view, also turn off edit
      if (key === 'canView' && !updated.canView) updated.canEdit = false;
      // If turning on edit, ensure view is on
      if (key === 'canEdit' && updated.canEdit) updated.canView = true;
      next[role][permission] = updated;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build upserts for org-specific overrides only when value differs from global
      const globals: Record<string, Cell> = {};
      rolePermissions
        .filter((r) => r.organization_id == null)
        .forEach((r) => {
          globals[`${r.role}:${r.permission}`] = { canView: r.can_view, canEdit: r.can_edit };
        });

      const rowsToUpsert: any[] = [];
      const rowsToDelete: { role: MemberRole; permission: Permission }[] = [];

      for (const role of ROLES) {
        for (const permission of PERMISSIONS) {
          const cell = matrix[role][permission];
          const global = globals[`${role}:${permission}`] || { canView: false, canEdit: false };
          const matchesGlobal = cell.canView === global.canView && cell.canEdit === global.canEdit;
          if (matchesGlobal) {
            rowsToDelete.push({ role, permission });
          } else {
            rowsToUpsert.push({
              organization_id: organizationId,
              role,
              permission,
              can_view: cell.canView,
              can_edit: cell.canEdit,
            });
          }
        }
      }

      // Delete org overrides that match globals
      if (rowsToDelete.length > 0) {
        for (const d of rowsToDelete) {
          await supabase
            .from('role_permissions')
            .delete()
            .eq('organization_id', organizationId)
            .eq('role', d.role)
            .eq('permission', d.permission);
        }
      }

      // Upsert overrides
      for (const row of rowsToUpsert) {
        // Try update first
        const { data: existing } = await supabase
          .from('role_permissions')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('role', row.role)
          .eq('permission', row.permission)
          .maybeSingle();

        if (existing?.id) {
          const { error } = await supabase
            .from('role_permissions')
            .update({ can_view: row.can_view, can_edit: row.can_edit })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('role_permissions').insert(row);
          if (error) throw error;
        }
      }

      await qc.invalidateQueries({ queryKey: ['role-permissions'] });
      toast.success('Permissões atualizadas');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setMatrix(baseMatrix);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Permissões por cargo
            </CardTitle>
            <CardDescription>
              Personalize o que cada cargo pode ver e editar nesta organização. Sobrescreve os
              padrões do sistema.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reverter
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium text-muted-foreground">Seção</th>
                {ROLES.map((r) => (
                  <th key={r} className="py-2 px-3 font-medium text-muted-foreground">
                    <Badge variant="outline">{ROLE_LABELS[r]}</Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p} className="border-b last:border-0">
                  <td className="py-3 pr-4 align-top">
                    <span className="font-medium">{PERMISSION_LABELS[p]}</span>
                  </td>
                  {ROLES.map((r) => {
                    const cell = matrix[r]?.[p] ?? { canView: false, canEdit: false };
                    return (
                      <td key={r} className="py-3 px-3 align-top">
                        <div className="flex flex-col gap-1.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Switch
                              checked={cell.canView}
                              onCheckedChange={() => toggle(r, p, 'canView')}
                            />
                            <span className="text-xs text-muted-foreground">Ver</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Switch
                              checked={cell.canEdit}
                              onCheckedChange={() => toggle(r, p, 'canEdit')}
                              disabled={!cell.canView}
                            />
                            <span className="text-xs text-muted-foreground">Editar</span>
                          </label>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Separator className="my-4" />
        <p className="text-xs text-muted-foreground">
          Proprietários sempre têm acesso total e não aparecem nesta tabela. Mudanças se aplicam
          imediatamente a todos os membros desta organização.
        </p>
      </CardContent>
    </Card>
  );
}
