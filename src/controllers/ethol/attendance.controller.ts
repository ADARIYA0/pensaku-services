import type { Request, Response } from 'express';
import prisma from '../../config/prisma.js';
import { getAccessTokenForStudent, fetchEtholConfig } from '../../services/etholAuth.service.js';
import { fetchCourses, fetchActiveAttendance } from '../../services/etholSync.service.js';
import logger from '../../utils/logger.js';

interface AttendanceCacheEntry {
  timestamp: number;
  data: {
    hasActiveAttendance: boolean;
    activeSessions: unknown[];
  };
}

const attendanceCache = new Map<string, AttendanceCacheEntry>();
const ATTENDANCE_CACHE_TTL_MS = 60 * 1000;

export async function checkAttendance(req: Request, res: Response): Promise<void> {
  try {
    const identifier = ((req.query.email || req.query.nrp) as string).trim();
    const reqCourseId = req.query.courseId ? Number(req.query.courseId) : undefined;
    const isRefresh = req.query.refresh === 'true';
    const cacheKey = `${identifier}_${reqCourseId || 'all'}`;

    if (!isRefresh) {
      const cached = attendanceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ATTENDANCE_CACHE_TTL_MS) {
        logger.debug({ identifier, reqCourseId }, 'Returning cached attendance result');
        res.status(200).json({
          status: 'success',
          message: cached.data.hasActiveAttendance
            ? `${cached.data.activeSessions.length} active attendance session(s) found (cached).`
            : 'No active attendance session currently open (cached).',
          data: cached.data,
        });
        return;
      }
    }

    const { accessToken, credentialId } = await getAccessTokenForStudent(identifier);

    if (reqCourseId && !isNaN(reqCourseId)) {
      const attendance = await fetchActiveAttendance(accessToken, reqCourseId);
      const data = {
        hasActiveAttendance: attendance !== null,
        activeSessions: attendance ? [{ courseId: reqCourseId, attendance }] : [],
      };
      attendanceCache.set(cacheKey, { timestamp: Date.now(), data });

      res.status(200).json({
        status: 'success',
        message: attendance ? 'Active attendance session found.' : 'No active attendance session.',
        data,
      });
      return;
    }

    let courses = await prisma.course.findMany({
      where: { credentialId },
      select: { etholNomor: true, nama: true, dosen: true, kodeKelas: true },
    });

    if (courses.length === 0) {
      const etholConfig = await fetchEtholConfig(accessToken);
      const rawCourses = await fetchCourses(
        accessToken,
        etholConfig.tahun_aktif,
        etholConfig.semester_aktif
      );
      courses = rawCourses.map((c) => ({
        etholNomor: c.nomor,
        nama: c.matakuliah.nama,
        dosen: c.dosen
          ? `${c.gelar_dpn ? c.gelar_dpn + ' ' : ''}${c.dosen}${c.gelar_blk ? ', ' + c.gelar_blk : ''}`
          : null,
        kodeKelas: c.kode_kelas ?? null,
      }));
    }

    const attendanceChecks = await Promise.all(
      courses.map(async (course) => {
        const attendance = await fetchActiveAttendance(accessToken, course.etholNomor);
        return {
          courseId: course.etholNomor,
          courseName: course.nama,
          dosen: course.dosen,
          kodeKelas: course.kodeKelas,
          attendance,
        };
      })
    );

    const activeSessions = attendanceChecks.filter((c) => c.attendance !== null);
    const data = {
      hasActiveAttendance: activeSessions.length > 0,
      activeSessions,
    };

    attendanceCache.set(cacheKey, { timestamp: Date.now(), data });

    res.status(200).json({
      status: 'success',
      message:
        activeSessions.length > 0
          ? `${activeSessions.length} active attendance session(s) found.`
          : 'No active attendance session currently open.',
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';

    logger.error({ err: error }, 'Failed to check attendance');

    res.status(500).json({
      status: 'error',
      message,
      data: null,
    });
  }
}
