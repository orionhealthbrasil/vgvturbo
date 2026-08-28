export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'A Fazer',
  in_progress: 'Em Andamento',
  in_review: 'Em Revisão',
  done: 'Concluída',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  in_review: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
  medium: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  urgent: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

export const TASK_STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  task_count?: number;
}

export interface TaskAssignee {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  mentioned_user_ids: string[] | null;
  created_at: string;
  updated_at: string;
  user_full_name?: string | null;
  user_avatar_url?: string | null;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface ProjectArea {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  color: string;
  icon: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  organization_id: string;
  project_id: string | null;
  area_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  created_by: string;
  position: number;
  created_at: string;
  updated_at: string;
  // Joined data
  project?: Pick<Project, 'id' | 'name' | 'color'> | null;
  area?: Pick<ProjectArea, 'id' | 'name' | 'color' | 'icon'> | null;
  contact?: { id: string; name: string; phone: string } | null;
  assignees?: TaskAssignee[];
  subtasks?: TaskSubtask[];
  subtask_count?: { total: number; completed: number };
  comment_count?: number;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_at?: string | null;
  project_id?: string | null;
  area_id?: string | null;
  contact_id?: string | null;
  assignee_user_ids?: string[];
}
