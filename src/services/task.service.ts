import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import type {
  SubTaskItem,
  UpdateSubTaskDto,
  ManualTaskItem,
  CreateManualTaskDto,
  UpdateManualTaskDto,
  TaskStatusOverrideItem,
} from '../types/task.types.js';

export function computeTaskUrgency(
  deadline: Date | null,
  status: string
): { priority: 'urgent' | 'mendatang' | 'selesai'; urgensiLabel: string } {
  if (status === 'done') {
    return { priority: 'selesai', urgensiLabel: 'Selesai' };
  }
  if (!deadline) {
    return { priority: 'mendatang', urgensiLabel: 'Mendatang' };
  }

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) {
    return { priority: 'urgent', urgensiLabel: 'Terlewat' };
  }
  if (diffHours <= 24) {
    return { priority: 'urgent', urgensiLabel: 'Urgent H-1' };
  }
  if (diffHours <= 72) {
    const diffDays = Math.ceil(diffHours / 24);
    return { priority: 'urgent', urgensiLabel: `H-${diffDays}` };
  }
  return { priority: 'mendatang', urgensiLabel: 'Mendatang' };
}

export function formatDeadlineDisplay(date: Date | null, raw?: string | null): string {
  if (raw && raw.trim().length > 0) return raw;
  if (!date) return 'Batas Waktu Belum Ditentukan';

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${d} ${m} ${y} | ${hours}.${minutes} WIB`;
}

export async function getSubTasksByTaskId(userId: string, taskId: string): Promise<SubTaskItem[]> {
  try {
    const subTasks = await prisma.subTask.findMany({
      where: {
        userId,
        taskId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return subTasks;
  } catch (error) {
    logger.error({ userId, taskId, err: error }, 'Failed to fetch sub-tasks from database');
    throw error;
  }
}

export async function createSubTask(userId: string, taskId: string, title: string): Promise<SubTaskItem> {
  try {
    const newSubTask = await prisma.subTask.create({
      data: {
        userId,
        taskId,
        title: title.trim(),
        isCompleted: false,
      },
    });

    logger.info({ userId, taskId, subTaskId: newSubTask.id }, 'Sub-task created successfully');
    return newSubTask;
  } catch (error) {
    logger.error({ userId, taskId, title, err: error }, 'Failed to create sub-task');
    throw error;
  }
}

export async function updateSubTask(
  userId: string,
  taskId: string,
  subTaskId: string,
  updates: UpdateSubTaskDto
): Promise<SubTaskItem | null> {
  try {
    const existing = await prisma.subTask.findFirst({
      where: {
        id: subTaskId,
        userId,
        taskId,
      },
    });

    if (!existing) {
      return null;
    }

    const updated = await prisma.subTask.update({
      where: { id: subTaskId },
      data: {
        ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
        ...(updates.isCompleted !== undefined ? { isCompleted: updates.isCompleted } : {}),
      },
    });

    logger.info({ userId, taskId, subTaskId }, 'Sub-task updated successfully');
    return updated;
  } catch (error) {
    logger.error({ userId, taskId, subTaskId, err: error }, 'Failed to update sub-task');
    throw error;
  }
}

export async function deleteSubTask(userId: string, taskId: string, subTaskId: string): Promise<boolean> {
  try {
    const existing = await prisma.subTask.findFirst({
      where: {
        id: subTaskId,
        userId,
        taskId,
      },
    });

    if (!existing) {
      return false;
    }

    await prisma.subTask.delete({
      where: { id: subTaskId },
    });

    logger.info({ userId, taskId, subTaskId }, 'Sub-task deleted successfully');
    return true;
  } catch (error) {
    logger.error({ userId, taskId, subTaskId, err: error }, 'Failed to delete sub-task');
    throw error;
  }
}

export async function createManualTask(
  userId: string,
  data: CreateManualTaskDto
): Promise<ManualTaskItem> {
  try {
    let deadlineDate: Date | null = null;
    if (data.deadline) {
      const parsed = new Date(data.deadline);
      if (!isNaN(parsed.getTime())) {
        deadlineDate = parsed;
      }
    }

    const status = data.status || 'todo';
    const { priority } = computeTaskUrgency(deadlineDate, status);

    const task = await prisma.task.create({
      data: {
        userId,
        title: data.title.trim(),
        course: data.course.trim(),
        deadline: deadlineDate,
        deadlineRaw: data.deadline || null,
        description: data.description ? data.description.trim() : null,
        status,
        priority,
        isCompleted: status === 'done',
      },
    });

    logger.info({ userId, taskId: task.id }, 'Manual task created successfully');
    return task;
  } catch (error) {
    logger.error({ userId, data, err: error }, 'Failed to create manual task');
    throw error;
  }
}

export async function getManualTasks(
  userId: string,
  status?: string
): Promise<ManualTaskItem[]> {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tasks;
  } catch (error) {
    logger.error({ userId, status, err: error }, 'Failed to fetch manual tasks');
    throw error;
  }
}

export async function updateManualTask(
  userId: string,
  taskId: string,
  updates: UpdateManualTaskDto
): Promise<ManualTaskItem | null> {
  try {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!existing) {
      return null;
    }

    let deadlineDate: Date | null | undefined = undefined;
    if (updates.deadline !== undefined) {
      const parsed = new Date(updates.deadline);
      deadlineDate = !isNaN(parsed.getTime()) ? parsed : null;
    }

    const nextStatus = updates.status !== undefined ? updates.status : existing.status;
    const nextDeadline = deadlineDate !== undefined ? deadlineDate : existing.deadline;
    const { priority } = computeTaskUrgency(nextDeadline, nextStatus);

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
        ...(updates.course !== undefined ? { course: updates.course.trim() } : {}),
        ...(deadlineDate !== undefined ? { deadline: deadlineDate, deadlineRaw: updates.deadline } : {}),
        ...(updates.description !== undefined ? { description: updates.description ? updates.description.trim() : null } : {}),
        ...(updates.status !== undefined ? { status: updates.status, isCompleted: updates.status === 'done' } : {}),
        ...(updates.isCompleted !== undefined ? { isCompleted: updates.isCompleted, status: updates.isCompleted ? 'done' : 'todo' } : {}),
        priority,
      },
    });

    logger.info({ userId, taskId }, 'Manual task updated successfully');
    return updated;
  } catch (error) {
    logger.error({ userId, taskId, err: error }, 'Failed to update manual task');
    throw error;
  }
}

export async function deleteManualTask(
  userId: string,
  taskId: string
): Promise<boolean> {
  try {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!existing) {
      return false;
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    logger.info({ userId, taskId }, 'Manual task deleted successfully');
    return true;
  } catch (error) {
    logger.error({ userId, taskId, err: error }, 'Failed to delete manual task');
    throw error;
  }
}

export async function upsertTaskStatusOverride(
  userId: string,
  taskId: string,
  status: 'todo' | 'inProgress' | 'done'
): Promise<TaskStatusOverrideItem> {
  try {
    const record = await prisma.taskStatusOverride.upsert({
      where: { userId_taskId: { userId, taskId } },
      update: { status },
      create: { userId, taskId, status },
    });
    logger.info({ userId, taskId, status }, 'Task status override upserted');
    return record;
  } catch (error) {
    logger.error({ userId, taskId, status, err: error }, 'Failed to upsert task status override');
    throw error;
  }
}

export async function getTaskStatusOverride(
  userId: string,
  taskId: string
): Promise<string | null> {
  try {
    const record = await prisma.taskStatusOverride.findUnique({
      where: { userId_taskId: { userId, taskId } },
      select: { status: true },
    });
    return record?.status ?? null;
  } catch (error) {
    logger.error({ userId, taskId, err: error }, 'Failed to get task status override');
    throw error;
  }
}

export async function batchGetTaskStatusOverrides(
  userId: string,
  taskIds: string[]
): Promise<Map<string, string>> {
  try {
    if (taskIds.length === 0) return new Map();
    const records = await prisma.taskStatusOverride.findMany({
      where: { userId, taskId: { in: taskIds } },
      select: { taskId: true, status: true },
    });
    return new Map(records.map((r) => [r.taskId, r.status]));
  } catch (error) {
    logger.error({ userId, taskIds, err: error }, 'Failed to batch get task status overrides');
    throw error;
  }
}

export async function deleteTaskStatusOverride(
  userId: string,
  taskId: string
): Promise<boolean> {
  try {
    const existing = await prisma.taskStatusOverride.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });
    if (!existing) return false;
    await prisma.taskStatusOverride.delete({
      where: { userId_taskId: { userId, taskId } },
    });
    logger.info({ userId, taskId }, 'Task status override deleted');
    return true;
  } catch (error) {
    logger.error({ userId, taskId, err: error }, 'Failed to delete task status override');
    throw error;
  }
}
