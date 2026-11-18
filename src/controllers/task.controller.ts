import type { Request, Response } from 'express';
import { clearAssignmentsSummaryCache } from './ethol/assignment.controller.js';
import {
  getSubTasksByTaskId,
  createSubTask,
  updateSubTask,
  deleteSubTask,
  createManualTask,
  getManualTasks,
  updateManualTask,
  deleteManualTask,
  computeTaskUrgency,
  formatDeadlineDisplay,
  upsertTaskStatusOverride,
  getTaskStatusOverride,
  batchGetTaskStatusOverrides,
  deleteTaskStatusOverride,
} from '../services/task.service.js';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import type {
  SubTaskResponse,
  ManualTaskResponse,
  ManualTaskItem,
} from '../types/task.types.js';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0]?.trim() || '';
  return param?.trim() || '';
}

async function resolveUserId(req: Request): Promise<string | null> {
  if (req.user?.userId) {
    return req.user.userId;
  }

  const candidate = (
    (req.query.userId as string) ||
    (req.body?.userId as string) ||
    (req.query.email as string) ||
    (req.body?.email as string) ||
    (req.query.nrp as string) ||
    (req.body?.nrp as string)
  )?.trim();

  if (!candidate) {
    return null;
  }

  const userById = await prisma.user.findUnique({
    where: { id: candidate },
    select: { id: true },
  });
  if (userById) {
    return userById.id;
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: candidate },
        { etholCredentials: { some: { etholEmail: candidate } } },
        { etholCredentials: { some: { etholNrp: candidate } } },
      ],
    },
    select: { id: true },
  });

  return user?.id || null;
}

function mapSubTaskResponse(item: {
  id: string;
  userId: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SubTaskResponse {
  return {
    id: item.id,
    userId: item.userId,
    taskId: item.taskId,
    title: item.title,
    isCompleted: item.isCompleted,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function mapManualTaskResponse(item: ManualTaskItem): ManualTaskResponse {
  const { priority, urgensiLabel } = computeTaskUrgency(item.deadline, item.status);
  const deadlineStr = formatDeadlineDisplay(item.deadline, item.deadlineRaw);

  return {
    id: item.id,
    userId: item.userId,
    title: item.title,
    course: item.course,
    deadline: deadlineStr,
    deadlineRaw: item.deadlineRaw || (item.deadline ? item.deadline.toISOString() : null),
    description: item.description,
    status: (item.status === 'inProgress' ? 'inProgress' : item.status === 'done' ? 'done' : 'todo'),
    priority,
    urgensiLabel,
    isCompleted: item.isCompleted,
    isManual: true,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function createManualTaskHandler(req: Request, res: Response): Promise<void> {
  try {
    const { title, course, deadline, description, status } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Judul tugas wajib diisi.',
        data: null,
      });
      return;
    }

    if (!course || typeof course !== 'string' || course.trim().length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Nama mata kuliah wajib diisi.',
        data: null,
      });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Pengguna tidak terautentikasi.',
        data: null,
      });
      return;
    }

    const newTask = await createManualTask(userId, {
      title,
      course,
      deadline,
      description,
      status,
    });

    clearAssignmentsSummaryCache();

    res.status(201).json({
      status: 'success',
      message: 'Tugas manual berhasil ditambahkan.',
      data: mapManualTaskResponse(newTask),
    });
  } catch (error) {
    logger.error({ err: error, body: req.body }, 'Error in createManualTaskHandler');
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat menambahkan tugas.',
      data: null,
    });
  }
}

export async function getManualTasksHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Pengguna tidak terautentikasi.',
        data: null,
      });
      return;
    }

    const status = (req.query.status as string | undefined)?.trim();
    const tasks = await getManualTasks(userId, status);
    const data = tasks.map(mapManualTaskResponse);

    res.status(200).json({
      status: 'success',
      message: 'Daftar tugas manual berhasil diambil.',
      data,
    });
  } catch (error) {
    logger.error({ err: error, query: req.query }, 'Error in getManualTasksHandler');
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat mengambil tugas.',
      data: null,
    });
  }
}

export async function updateManualTaskHandler(req: Request, res: Response): Promise<void> {
  try {
    const taskId = getParam(req.params.id || req.params.taskId);
    if (!taskId) {
      res.status(400).json({
        status: 'error',
        message: 'Parameter id tugas wajib disertakan.',
        data: null,
      });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Pengguna tidak terautentikasi.',
        data: null,
      });
      return;
    }

    const updated = await updateManualTask(userId, taskId, req.body);
    if (!updated) {
      res.status(404).json({
        status: 'error',
        message: 'Tugas tidak ditemukan atau tidak memiliki hak akses.',
        data: null,
      });
      return;
    }

    clearAssignmentsSummaryCache();

    res.status(200).json({
      status: 'success',
      message: 'Tugas manual berhasil diperbarui.',
      data: mapManualTaskResponse(updated),
    });
  } catch (error) {
    logger.error({ err: error, params: req.params, body: req.body }, 'Error in updateManualTaskHandler');
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat memperbarui tugas.',
      data: null,
    });
  }
}

export async function deleteManualTaskHandler(req: Request, res: Response): Promise<void> {
  try {
    const taskId = getParam(req.params.id || req.params.taskId);
    if (!taskId) {
      res.status(400).json({
        status: 'error',
        message: 'Parameter id tugas wajib disertakan.',
        data: null,
      });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Pengguna tidak terautentikasi.',
        data: null,
      });
      return;
    }

    const deleted = await deleteManualTask(userId, taskId);
    if (!deleted) {
      res.status(404).json({
        status: 'error',
        message: 'Tugas tidak ditemukan atau tidak memiliki hak akses.',
        data: null,
      });
      return;
    }

    clearAssignmentsSummaryCache();

    res.status(200).json({
      status: 'success',
      message: 'Tugas manual berhasil dihapus.',
      data: null,
    });
  } catch (error) {
    logger.error({ err: error, params: req.params }, 'Error in deleteManualTaskHandler');
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat menghapus tugas.',
      data: null,
    });
  }
}

export async function getSubTasksHandler(req: Request, res: Response): Promise<void> {
  try {
    const taskId = getParam(req.params.taskId);
    if (!taskId) {
      res.status(400).json({
        status: 'error',
        message: 'Parameter taskId wajib disertakan.',
        data: null,
      });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Pengguna tidak terautentikasi.',
        data: null,
      });
      return;
    }

    const subTasks = await getSubTasksByTaskId(userId, taskId);
    const data = subTasks.map(mapSubTaskResponse);

    res.status(200).json({
      status: 'success',
      message: 'Daftar sub-tugas berhasil diambil.',
      data,
    });
  } catch (error) {
    logger.error({ err: error, params: req.params }, 'Error in getSubTasksHandler');
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat mengambil sub-tugas.',
      data: null,
    });
  }
}

export async function createSubTaskHandler(req: Request, res: Response): Promise<void> {
  try {
    const taskId = getParam(req.params.taskId);
    const { title } = req.body;

    if (!taskId) {
      res.status(400).json({
        status: 'error',
        message: 'Parameter taskId wajib disertakan.',
        data: null,
      });
      return;
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Judul sub-tugas tidak boleh kosong.',
        data: null,
      });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Pengguna tidak terautentikasi.',
        data: null,
      });
      return;
    }

    const newSubTask = await createSubTask(userId, taskId, title.trim());

    res.status(201).json({
      status: 'success',
      message: 'Sub-tugas berhasil ditambahkan.',
      data: mapSubTaskResponse(newSubTask),
    });
  } catch (error) {
    logger.error({ err: error, body: req.body, params: req.params }, 'Error in createSubTaskHandler');
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat menambahkan sub-tugas.',
      data: null,
    });
  }
}

export async function updateSubTaskHandler(req: Request, res: Response): Promise<void> {
  try {
    const taskId = getParam(req.params.taskId);
    const subTaskId = getParam(req.params.subtaskId || req.params.subTaskId);
    const { title, isCompleted } = req.body;

    if (!taskId || !subTaskId) {
      res.status(400).json({
        status: 'error',
        message: 'Parameter taskId dan subTaskId wajib disertakan.',
        data: null,
      });
      return;
    }

    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      res.status(400).json({
        status: 'error',
        message: 'Judul sub-tugas tidak boleh kosong jika diperbarui.',
        data: null,
      });
      return;
    }

    if (isCompleted !== undefined && typeof isCompleted !== 'boolean') {
      res.status(400).json({
        status: 'error',
        message: 'Nilai isCompleted harus berupa boolean (true atau false).',
        data: null,
      });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Pengguna tidak terautentikasi.',
        data: null,
      });
      return;
    }

    const updated = await updateSubTask(userId, taskId, subTaskId, {
      title: title !== undefined ? title.trim() : undefined,
      isCompleted: isCompleted !== undefined ? isCompleted : undefined,
    });

    if (!updated) {
      res.status(404).json({
        status: 'error',
        message: 'Sub-tugas tidak ditemukan atau tidak memiliki hak akses.',
        data: null,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      message: 'Sub-tugas berhasil diperbarui.',
      data: mapSubTaskResponse(updated),
    });
  } catch (error) {
    logger.error({ err: error, body: req.body, params: req.params }, 'Error in updateSubTaskHandler');
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat memperbarui sub-tugas.',
      data: null,
    });
  }
}

export async function deleteSubTaskHandler(req: Request, res: Response): Promise<void> {
  try {
    const taskId = getParam(req.params.taskId);
    const subTaskId = getParam(req.params.subtaskId || req.params.subTaskId);

    if (!taskId || !subTaskId) {
      res.status(400).json({
        status: 'error',
        message: 'Parameter taskId dan subTaskId wajib disertakan.',
        data: null,
      });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Pengguna tidak terautentikasi.',
        data: null,
      });
      return;
    }

    const success = await deleteSubTask(userId, taskId, subTaskId);

    if (!success) {
      res.status(404).json({
        status: 'error',
        message: 'Sub-tugas tidak ditemukan atau tidak memiliki hak akses.',
        data: null,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      message: 'Sub-tugas berhasil dihapus.',
      data: null,
    });
  } catch (error) {
    logger.error({ err: error, params: req.params }, 'Error in deleteSubTaskHandler');
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat menghapus sub-tugas.',
      data: null,
    });
  }
}

export async function upsertTaskStatusOverrideHandler(req: Request, res: Response): Promise<void> {
  try {
    const taskId = getParam(req.params.taskId);
    if (!taskId) {
      res.status(400).json({ status: 'error', message: 'Parameter taskId wajib disertakan.', data: null });
      return;
    }

    const { status } = req.body as { status?: string };
    if (!status || !['todo', 'inProgress', 'done'].includes(status)) {
      res.status(400).json({ status: 'error', message: 'Nilai status harus salah satu dari: todo, inProgress, done.', data: null });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'Pengguna tidak terautentikasi.', data: null });
      return;
    }

    const record = await upsertTaskStatusOverride(userId, taskId, status as 'todo' | 'inProgress' | 'done');

    res.status(200).json({
      status: 'success',
      message: 'Status override tugas berhasil disimpan.',
      data: { taskId: record.taskId, status: record.status, updatedAt: record.updatedAt.toISOString() },
    });
  } catch (error) {
    logger.error({ err: error, params: req.params, body: req.body }, 'Error in upsertTaskStatusOverrideHandler');
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.', data: null });
  }
}

export async function getTaskStatusOverrideHandler(req: Request, res: Response): Promise<void> {
  try {
    const taskId = getParam(req.params.taskId);
    if (!taskId) {
      res.status(400).json({ status: 'error', message: 'Parameter taskId wajib disertakan.', data: null });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'Pengguna tidak terautentikasi.', data: null });
      return;
    }

    const status = await getTaskStatusOverride(userId, taskId);

    res.status(200).json({
      status: 'success',
      message: 'Status override tugas berhasil diambil.',
      data: { taskId, status },
    });
  } catch (error) {
    logger.error({ err: error, params: req.params }, 'Error in getTaskStatusOverrideHandler');
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.', data: null });
  }
}

export async function batchGetTaskStatusOverridesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { taskIds } = req.body as { taskIds?: unknown };
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      res.status(400).json({ status: 'error', message: 'Body harus menyertakan taskIds (array non-kosong).', data: null });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'Pengguna tidak terautentikasi.', data: null });
      return;
    }

    const ids = taskIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    const overridesMap = await batchGetTaskStatusOverrides(userId, ids);
    const data: Record<string, string> = {};
    overridesMap.forEach((status, taskId) => { data[taskId] = status; });

    res.status(200).json({
      status: 'success',
      message: 'Batch status override berhasil diambil.',
      data,
    });
  } catch (error) {
    logger.error({ err: error, body: req.body }, 'Error in batchGetTaskStatusOverridesHandler');
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.', data: null });
  }
}

export async function deleteTaskStatusOverrideHandler(req: Request, res: Response): Promise<void> {
  try {
    const taskId = getParam(req.params.taskId);
    if (!taskId) {
      res.status(400).json({ status: 'error', message: 'Parameter taskId wajib disertakan.', data: null });
      return;
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'Pengguna tidak terautentikasi.', data: null });
      return;
    }

    const deleted = await deleteTaskStatusOverride(userId, taskId);
    if (!deleted) {
      res.status(404).json({ status: 'error', message: 'Status override tidak ditemukan.', data: null });
      return;
    }

    res.status(200).json({ status: 'success', message: 'Status override tugas berhasil dihapus.', data: null });
  } catch (error) {
    logger.error({ err: error, params: req.params }, 'Error in deleteTaskStatusOverrideHandler');
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.', data: null });
  }
}
