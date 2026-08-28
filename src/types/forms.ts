export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'select'
  | 'checkbox';

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  customFieldId?: string | null;
}

export type AssignmentStrategy = 'none' | 'fixed' | 'round_robin';

export interface LeadForm {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string;
  thank_you_message: string;
  redirect_url: string | null;
  fields: FormField[];
  default_tags: string[];
  pipeline_id: string | null;
  kanban_column_id: string | null;
  funnel_stage: string | null;
  assignment_strategy: AssignmentStrategy;
  assigned_to: string | null;
  is_active: boolean;
  submission_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  organization_id: string;
  contact_id: string | null;
  payload: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  status: 'received' | 'processed' | 'failed' | 'spam';
  error_message: string | null;
  created_at: string;
}

export interface PublicFormView {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string;
  thank_you_message: string;
  redirect_url: string | null;
  fields: FormField[];
}
