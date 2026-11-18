import type { Request, Response } from 'express';
import prisma from '../../config/prisma.js';
import { getAccessTokenForStudent, fetchEtholConfig } from '../../services/etholAuth.service.js';
import { fetchCourses, fetchAllCoursesAssignments } from '../../services/etholSync.service.js';
import logger from '../../utils/logger.js';
import type { EtholCourseItem, EtholAssignmentItem } from '../../types/ethol.types.js';

function formatDeadlineDisplay(rawDate?: string, indoDate?: string): string {
  if (rawDate) {
    const parts = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]+(\d{2}):(\d{2})/);
    if (parts) {
      const [, y, m, d, hh, mm] = parts;
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ];
      const monthIndex = parseInt(m, 10) - 1;
      const monthName = monthNames[monthIndex] || m;
      const day = parseInt(d, 10);
      return `${day} ${monthName} ${y} | ${hh}.${mm} WIB`;
    }
  }

  if (indoDate) {
    const cleaned = indoDate
      .replace(/^[A-Za-z'’]+,\s*/, '')
      .replace(/\s*-\s*/, ' | ')
      .replace(':', '.');
    return `${cleaned} WIB`;
  }

  return 'Waktu tidak ditentukan';
}

function computeUrgency(deadlineStr?: string, isSubmitted: boolean = false): {
  priority: 'urgent' | 'mendatang' | 'selesai';
  urgensiLabel: string;
} {
  if (isSubmitted) {
    return { priority: 'selesai', urgensiLabel: 'Selesai' };
  }

  if (!deadlineStr) {
    return { priority: 'mendatang', urgensiLabel: 'Mendatang' };
  }

  const deadline = new Date(deadlineStr);
  if (isNaN(deadline.getTime())) {
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

function normalizeAssignment(
  item: EtholAssignmentItem,
  course?: EtholCourseItem
) {
  const isSubmitted = Boolean(item.submission_time || item.nomor_tugas_mahasiswa);
  const { priority, urgensiLabel } = computeUrgency(item.deadline, isSubmitted);

  const status: 'todo' | 'inProgress' | 'done' = isSubmitted ? 'done' : 'todo';

  return {
    id: String(item.id || item.nomor || Math.random()),
    kuliahId: item.kuliah ?? item.course ?? course?.nomor ?? 0,
    course: course?.matakuliah?.nama || 'Mata Kuliah',
    title: item.title || item.judul || 'Tugas Kuliah',
    description: item.description || item.deskripsi || '',
    deadline: formatDeadlineDisplay(item.deadline, item.deadline_indonesia),
    deadlineRaw: item.deadline || '',
    deadlineIndonesia: item.deadline_indonesia || '',
    status: status as 'todo' | 'inProgress' | 'done',
    priority,
    urgensiLabel,
    isSubmitted,
    submissionTime: item.submission_time || null,
    submissionTimeIndonesia: item.submission_time_indonesia || null,
    submissionFile: item.submission_file || null,
    studentNote: item.student_note || null,
    file: item.file || [],
    isManual: false,
  };
}

async function fetchUserManualTasks(identifier: string, credentialId?: string) {
  try {
    let userId: string | null = null;
    if (credentialId) {
      const cred = await prisma.etholCredential.findUnique({
        where: { id: credentialId },
        select: { userId: true },
      });
      userId = cred?.userId || null;
    }
    if (!userId) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: identifier },
            { etholCredentials: { some: { etholEmail: identifier } } },
          ],
        },
        select: { id: true },
      });
      userId = user?.id || null;
    }
    if (!userId) return [];
    return await prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch manual tasks for assignment list');
    return [];
  }
}

function normalizeManualTask(mt: {
  id: string;
  title: string;
  course: string;
  deadline: Date | null;
  deadlineRaw: string | null;
  description: string | null;
  status: string;
  priority: string;
  isCompleted: boolean;
}) {
  const isDone = mt.status === 'done' || mt.isCompleted;
  const deadlineIso = mt.deadline ? mt.deadline.toISOString() : (mt.deadlineRaw || '');
  const { priority, urgensiLabel } = computeUrgency(deadlineIso, isDone);
  const status: 'todo' | 'inProgress' | 'done' = isDone
    ? 'done'
    : mt.status === 'inProgress'
    ? 'inProgress'
    : 'todo';

  return {
    id: mt.id,
    kuliahId: 0,
    course: mt.course,
    title: mt.title,
    description: mt.description || '',
    deadline: formatDeadlineDisplay(mt.deadlineRaw || (mt.deadline ? mt.deadline.toISOString().replace('T', ' ').substring(0, 16) : undefined)),
    deadlineRaw: mt.deadlineRaw || (mt.deadline ? mt.deadline.toISOString() : ''),
    deadlineIndonesia: '',
    status,
    priority,
    urgensiLabel,
    isSubmitted: isDone,
    submissionTime: null,
    submissionTimeIndonesia: null,
    submissionFile: null,
    studentNote: null,
    file: [],
    isManual: true,
  };
}

interface AssignmentsSummaryCacheEntry {
  timestamp: number;
  data: {
    total: number;
    belumSelesai: number;
    selesai: number;
    prioritas: ReturnType<typeof normalizeAssignment> | ReturnType<typeof normalizeManualTask> | null;
  };
}

const assignmentsSummaryCache = new Map<string, AssignmentsSummaryCacheEntry>();
const ASSIGNMENTS_SUMMARY_CACHE_TTL_MS = 60 * 1000;

export function clearAssignmentsSummaryCache(identifier?: string): void {
  if (identifier) {
    assignmentsSummaryCache.delete(identifier.trim());
  } else {
    assignmentsSummaryCache.clear();
  }
}

export async function getAssignmentsSummary(req: Request, res: Response): Promise<void> {
  try {
    const identifier = ((req.query.email || req.query.nrp) as string).trim();
    const isRefresh = req.query.refresh === 'true';

    if (!isRefresh) {
      const cached = assignmentsSummaryCache.get(identifier);
      if (cached && Date.now() - cached.timestamp < ASSIGNMENTS_SUMMARY_CACHE_TTL_MS) {
        logger.debug({ identifier }, 'Returning cached assignments summary');
        res.status(200).json({
          status: 'success',
          message: 'Assignments summary retrieved successfully (cached).',
          data: cached.data,
        });
        return;
      }
    }

    const { accessToken, credentialId } = await getAccessTokenForStudent(identifier);
    const config = await fetchEtholConfig(accessToken);

    const rawCourses = await fetchCourses(accessToken, config.tahun_aktif, config.semester_aktif);

    const courseResults = rawCourses && rawCourses.length > 0
      ? await fetchAllCoursesAssignments(accessToken, rawCourses)
      : [];

    const manualTasks = await fetchUserManualTasks(identifier, credentialId);

    let total = 0;
    let selesai = 0;
    let belumSelesai = 0;
    const pendingTasks: (ReturnType<typeof normalizeAssignment> | ReturnType<typeof normalizeManualTask>)[] = [];

    for (const cr of courseResults) {
      for (const raw of cr.assignments) {
        total += 1;
        const norm = normalizeAssignment(raw, cr.course);
        if (norm.isSubmitted) {
          selesai += 1;
        } else {
          belumSelesai += 1;
          pendingTasks.push(norm);
        }
      }
    }

    for (const mt of manualTasks) {
      total += 1;
      const norm = normalizeManualTask(mt);
      if (norm.isSubmitted) {
        selesai += 1;
      } else {
        belumSelesai += 1;
        pendingTasks.push(norm);
      }
    }

    pendingTasks.sort((a, b) => {
      if (!a.deadlineRaw) return 1;
      if (!b.deadlineRaw) return -1;
      return a.deadlineRaw.localeCompare(b.deadlineRaw);
    });

    const prioritas = pendingTasks.length > 0 ? pendingTasks[0] : null;

    logger.info(
      { identifier, total, belumSelesai, selesai, hasPrioritas: Boolean(prioritas) },
      'Assignments summary retrieved successfully'
    );

    const resultData = {
      total,
      belumSelesai,
      selesai,
      prioritas,
    };

    assignmentsSummaryCache.set(identifier, {
      timestamp: Date.now(),
      data: resultData,
    });

    res.status(200).json({
      status: 'success',
      message: 'Assignments summary retrieved successfully.',
      data: resultData,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to retrieve assignments summary.';
    logger.error({ err: error }, 'Failed to get assignments summary');

    const statusCode = message.includes('No linked ETHOL account found') ? 404 : 500;

    res.status(statusCode).json({
      status: 'error',
      message,
      data: null,
    });
  }
}

export async function getAllAssignments(req: Request, res: Response): Promise<void> {
  try {
    const identifier = ((req.query.email || req.query.nrp) as string).trim();
    const courseIdFilter = req.query.courseId ? Number(req.query.courseId) : undefined;

    const { accessToken, credentialId } = await getAccessTokenForStudent(identifier);
    const config = await fetchEtholConfig(accessToken);

    let rawCourses = await fetchCourses(accessToken, config.tahun_aktif, config.semester_aktif);

    if (courseIdFilter && rawCourses) {
      rawCourses = rawCourses.filter((c) => c.nomor === courseIdFilter);
    }

    const courseResults = rawCourses && rawCourses.length > 0
      ? await fetchAllCoursesAssignments(accessToken, rawCourses)
      : [];

    const manualTasks = await fetchUserManualTasks(identifier, credentialId);

    let userId: string | null = null;
    if (credentialId) {
      const cred = await prisma.etholCredential.findUnique({
        where: { id: credentialId },
        select: { userId: true },
      });
      userId = cred?.userId || null;
    }
    if (!userId) {
      const u = await prisma.user.findFirst({
        where: {
          OR: [
            { email: identifier },
            { etholCredentials: { some: { etholEmail: identifier } } },
          ],
        },
        select: { id: true },
      });
      userId = u?.id || null;
    }

    const userOverrides = userId
      ? await prisma.taskStatusOverride.findMany({
          where: { userId },
          select: { taskId: true, status: true },
        })
      : [];
    const overridesMap = new Map(userOverrides.map((o) => [o.taskId, o.status]));

    const allNormalized: (ReturnType<typeof normalizeAssignment> | ReturnType<typeof normalizeManualTask>)[] = [];
    let todoCount = 0;
    let doneCount = 0;
    let inProgressCount = 0;

    for (const cr of courseResults) {
      for (const raw of cr.assignments) {
        const norm = normalizeAssignment(raw, cr.course);
        if (norm.isSubmitted) {
          norm.status = 'done';
          doneCount += 1;
        } else {
          const overrideStatus = overridesMap.get(norm.id);
          if (overrideStatus === 'inProgress') {
            norm.status = 'inProgress';
            inProgressCount += 1;
          } else {
            todoCount += 1;
          }
        }
        allNormalized.push(norm);
      }
    }

    for (const mt of manualTasks) {
      const norm = normalizeManualTask(mt);
      allNormalized.push(norm);
      if (norm.status === 'done') {
        doneCount += 1;
      } else if (norm.status === 'inProgress') {
        inProgressCount += 1;
      } else {
        todoCount += 1;
      }
    }

    allNormalized.sort((a, b) => {
      if (a.isSubmitted !== b.isSubmitted) {
        return a.isSubmitted ? 1 : -1;
      }
      if (!a.deadlineRaw) return 1;
      if (!b.deadlineRaw) return -1;
      return a.deadlineRaw.localeCompare(b.deadlineRaw);
    });

    logger.info(
      { identifier, total: allNormalized.length, todoCount, inProgressCount, doneCount },
      'All assignments retrieved successfully'
    );

    res.status(200).json({
      status: 'success',
      message: 'All assignments retrieved successfully.',
      data: {
        total: allNormalized.length,
        counts: {
          todo: todoCount,
          inProgress: inProgressCount,
          done: doneCount,
        },
        assignments: allNormalized,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to retrieve assignments.';
    logger.error({ err: error }, 'Failed to get all assignments');

    const statusCode = message.includes('No linked ETHOL account found') ? 404 : 500;

    res.status(statusCode).json({
      status: 'error',
      message,
      data: null,
    });
  }
}
