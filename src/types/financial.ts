export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type AccountType = 'cash' | 'bank' | 'credit_card' | 'other';
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type PaymentMethod = 'pix' | 'cash' | 'credit_card' | 'debit_card' | 'transfer' | 'boleto' | 'other';
export type TransactionSource = 'manual' | 'recurrence' | 'pipeline_won' | 'automation';

export interface FinancialAccount {
  id: string;
  organization_id: string;
  name: string;
  account_type: AccountType;
  initial_balance: number;
  color: string;
  icon: string | null;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialCategory {
  id: string;
  organization_id: string;
  name: string;
  category_type: TransactionType;
  color: string;
  icon: string | null;
  parent_id: string | null;
  position: number;
  is_default: boolean;
  is_active: boolean;
}

export interface FinancialTransaction {
  id: string;
  organization_id: string;
  account_id: string;
  category_id: string | null;
  recurrence_id: string | null;
  contact_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  description: string;
  notes: string | null;
  payment_method: PaymentMethod | null;
  status: TransactionStatus;
  due_date: string | null;
  paid_date: string | null;
  transaction_date: string;
  attachment_url: string | null;
  source: TransactionSource;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
  // joined
  account?: { name: string; color: string } | null;
  category?: { name: string; color: string; icon: string | null } | null;
  contact?: { name: string } | null;
}

export interface FinancialRecurrence {
  id: string;
  organization_id: string;
  account_id: string;
  category_id: string | null;
  description: string;
  amount: number;
  transaction_type: TransactionType;
  frequency: RecurrenceFrequency;
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  last_run_date: string | null;
  total_occurrences: number | null;
  occurrences_done: number;
  is_active: boolean;
  notes: string | null;
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Entrada',
  expense: 'Saída',
};

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Atrasado',
  cancelled: 'Cancelado',
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Caixa',
  bank: 'Banco',
  credit_card: 'Cartão de Crédito',
  other: 'Outro',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  cash: 'Dinheiro',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  transfer: 'Transferência',
  boleto: 'Boleto',
  other: 'Outro',
};

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};
