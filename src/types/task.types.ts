export interface SubTaskItem {
  id: string;
  userId: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubTaskResponse {
  id: string;
  userId: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubTaskDto {
  title: string;
  userId?: string;
}

export interface UpdateSubTaskDto {
  title?: string;
  isCompleted?: boolean;
}

export interface ManualTaskItem {
  id: string;
  userId: string;
  title: string;
  course: string;
  deadline: Date | null;
  deadlineRaw: string | null;
  description: string | null;
  status: string;
  priority: string;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManualTaskResponse {
  id: string;
  userId: string;
  title: string;
  course: string;
  deadline: string;
  deadlineRaw: string | null;
  description: string | null;
  status: 'todo' | 'inProgress' | 'done';
  priority: 'urgent' | 'mendatang' | 'selesai';
  urgensiLabel: string;
  isCompleted: boolean;
  isManual: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateManualTaskDto {
  title: string;
  course: string;
  deadline?: string;
  description?: string;
  status?: 'todo' | 'inProgress' | 'done';
  userId?: string;
}

export interface UpdateManualTaskDto {
  title?: string;
  course?: string;
  deadline?: string;
  description?: string;
  status?: 'todo' | 'inProgress' | 'done';
  isCompleted?: boolean;
}

export interface TaskStatusOverrideItem {
  id: string;
  userId: string;
  taskId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertTaskStatusOverrideDto {
  status: 'todo' | 'inProgress' | 'done';
}
