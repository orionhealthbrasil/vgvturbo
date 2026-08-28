export type GoalType = 'revenue' | 'deals_count' | 'conversion_rate';
export type GoalScope = 'individual' | 'team' | 'group';
export type GoalPeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type GoalStatus = 'active' | 'completed' | 'archived' | 'failed';

export interface Goal {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  goal_type: GoalType;
  scope: GoalScope;
  target_value: number;
  period_type: GoalPeriodType;
  period_start: string; // YYYY-MM-DD
  period_end: string;
  pipeline_id: string | null;
  status: GoalStatus;
  created_by: string;
  notified_50: boolean;
  notified_80: boolean;
  notified_100: boolean;
  created_at: string;
  updated_at: string;
  participants?: GoalParticipant[];
  progress_total?: GoalProgress | null;
  progress_by_user?: GoalProgress[];
}

export interface GoalParticipant {
  id: string;
  goal_id: string;
  user_id: string;
  created_at: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface GoalProgress {
  id: string;
  goal_id: string;
  user_id: string | null;
  current_value: number;
  deals_count: number;
  updated_at: string;
}

export interface GoalInput {
  title: string;
  description?: string | null;
  goal_type: GoalType;
  scope: GoalScope;
  target_value: number;
  period_type: GoalPeriodType;
  period_start: string;
  period_end: string;
  pipeline_id?: string | null;
  participant_user_ids?: string[];
}

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  revenue: 'Faturamento (R$)',
  deals_count: 'Quantidade de vendas',
  conversion_rate: 'Taxa de conversão (%)',
};

export const GOAL_SCOPE_LABELS: Record<GoalScope, string> = {
  individual: 'Individual',
  team: 'Equipe',
  group: 'Grupo',
};

export const GOAL_PERIOD_LABELS: Record<GoalPeriodType, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
  custom: 'Personalizado',
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Ativa',
  completed: 'Concluída',
  archived: 'Arquivada',
  failed: 'Não atingida',
};

export function formatGoalValue(type: GoalType, value: number): string {
  if (type === 'revenue') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);
  }
  if (type === 'conversion_rate') {
    return `${(value || 0).toFixed(1)}%`;
  }
  return `${Math.round(value || 0)}`;
}

export function calcGoalPercent(target: number, current: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}
