import type { Request, Response } from 'express';
import prisma from '../../config/prisma.js';
import { getAccessTokenForStudent, fetchEtholConfig } from '../../services/etholAuth.service.js';
import {
  fetchCourses,
  fetchSchedules,
  filterTodaySchedules,
  fetchAssignments,
  filterPendingAssignments,
} from '../../services/etholSync.service.js';
import logger from '../../utils/logger.js';
import type { SyncDataRequest } from '../../types/ethol.types.js';

export async function syncData(req: Request, res: Response): Promise<void> {
  try {
    const { email, nrp, tahun: reqTahun, semester: reqSemester } = req.body as SyncDataRequest;
    const identifier = (email || nrp)!.trim();

    const { accessToken, credentialId, nrp: studentNrp } = await getAccessTokenForStudent(identifier);

    const etholConfig = await fetchEtholConfig(accessToken);
    const tahun = reqTahun ?? etholConfig.tahun_aktif;
    const semester = reqSemester ?? etholConfig.semester_aktif;

    const rawCourses = await fetchCourses(accessToken, tahun, semester);

    if (rawCourses.length === 0) {
      res.status(200).json({
        status: 'success',
        message: 'No courses found for this academic period.',
        data: {
          academicYear: {
            tahun,
            semester,
            tahunAjaran: etholConfig.tahun_ajaran_aktif,
          },
          courses: [],
          todaySchedules: [],
          allSchedules: [],
          pendingAssignments: [],
        },
      });
      return;
    }

    await Promise.all(
      rawCourses.map((c) => {
        const dosenFormatted = c.dosen
          ? `${c.gelar_dpn ? c.gelar_dpn + ' ' : ''}${c.dosen}${c.gelar_blk ? ', ' + c.gelar_blk : ''}`
          : null;

        return prisma.course.upsert({
          where: {
            etholNomor: c.nomor,
          },
          update: {
            nama: c.matakuliah.nama,
            dosen: dosenFormatted,
            kodeKelas: c.kode_kelas ?? null,
            tahun,
            semester,
            credentialId,
          },
          create: {
            etholNomor: c.nomor,
            nama: c.matakuliah.nama,
            dosen: dosenFormatted,
            kodeKelas: c.kode_kelas ?? null,
            tahun,
            semester,
            credentialId,
          },
        });
      })
    );

    const courseIds = rawCourses.map((c) => c.nomor);

    const [schedules, assignments] = await Promise.all([
      fetchSchedules(accessToken, courseIds, tahun, semester),
      fetchAssignments(accessToken, courseIds),
    ]);

    const todaySchedules = filterTodaySchedules(schedules);
    const pendingAssignments = filterPendingAssignments(assignments);

    const dbCourses = await prisma.course.findMany({
      where: { credentialId },
      select: { id: true, etholNomor: true },
    });
    const courseIdMap = new Map(dbCourses.map((c) => [c.etholNomor, c.id]));
    const dbCourseIds = dbCourses.map((c) => c.id);

    await prisma.schedule.deleteMany({
      where: { courseId: { in: dbCourseIds } },
    });

    const schedulesToInsert = schedules
      .filter((s) => s.kuliah && courseIdMap.has(s.kuliah))
      .map((s) => ({
        hari: String(s.hari),
        jamMulai: String(s.jam_awal || s.jamMulai || ''),
        jamSelesai: String(s.jam_akhir || s.jamSelesai || ''),
        ruang: s.ruang ? String(s.ruang) : null,
        courseId: courseIdMap.get(s.kuliah!)!,
      }));

    if (schedulesToInsert.length > 0) {
      await prisma.schedule.createMany({ data: schedulesToInsert });
    }

    await prisma.assignment.deleteMany({
      where: { courseId: { in: dbCourseIds } },
    });

    const assignmentsToInsert = assignments
      .filter((a) => {
        const cNomor = a.course || a.kuliah_nomor;
        return cNomor && courseIdMap.has(cNomor);
      })
      .map((a) => {
        const cNomor = (a.course || a.kuliah_nomor)!;
        return {
          etholTugasId: a.id || a.nomor || null,
          judul: a.title || a.judul || 'Untitled Assignment',
          deskripsi: a.description || a.deskripsi || null,
          deadline: a.deadline ? new Date(a.deadline) : null,
          submissionTime: a.submission_time ? new Date(a.submission_time) : null,
          courseId: courseIdMap.get(cNomor)!,
        };
      });

    if (assignmentsToInsert.length > 0) {
      await prisma.assignment.createMany({ data: assignmentsToInsert });
    }

    const cleanCourses = rawCourses.map((c) => ({
      nomor: c.nomor,
      nama: c.matakuliah.nama,
      dosen: c.dosen
        ? `${c.gelar_dpn ? c.gelar_dpn + ' ' : ''}${c.dosen}${c.gelar_blk ? ', ' + c.gelar_blk : ''}`
        : undefined,
      kodeKelas: c.kode_kelas,
    }));

    logger.info(
      {
        nrp: studentNrp,
        identifier,
        totalCourses: cleanCourses.length,
        totalSchedules: schedules.length,
        todaySchedules: todaySchedules.length,
        totalAssignments: assignments.length,
        pendingAssignments: pendingAssignments.length,
      },
      'ETHOL data sync completed automatically'
    );

    res.status(200).json({
      status: 'success',
      message: 'ETHOL data synced successfully.',
      data: {
        academicYear: {
          tahun,
          semester,
          tahunAjaran: etholConfig.tahun_ajaran_aktif,
        },
        courses: cleanCourses,
        todaySchedules,
        allSchedules: schedules,
        pendingAssignments,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred during sync.';

    logger.error({ err: error }, 'Failed to sync ETHOL data');

    const statusCode = message.includes('re-link') || message.includes('expired') ? 401 : 500;

    res.status(statusCode).json({
      status: 'error',
      message,
      data: null,
    });
  }
}
