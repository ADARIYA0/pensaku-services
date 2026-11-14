import type { Request, Response } from 'express';
import { getAccessTokenForStudent, fetchEtholConfig } from '../../services/etholAuth.service.js';
import { fetchCourses } from '../../services/etholSync.service.js';
import logger from '../../utils/logger.js';

export async function getCourses(req: Request, res: Response): Promise<void> {
  try {
    const identifier = ((req.query.email || req.query.nrp) as string).trim();
    const reqTahun = req.query.tahun ? Number(req.query.tahun) : undefined;
    const reqSemester = req.query.semester ? Number(req.query.semester) : undefined;

    const { accessToken } = await getAccessTokenForStudent(identifier);

    const config = await fetchEtholConfig(accessToken);
    const tahun = reqTahun ?? config.tahun_aktif;
    const semester = reqSemester ?? config.semester_aktif;

    const rawCourses = await fetchCourses(accessToken, tahun, semester);

    const courses = rawCourses.map((c) => ({
      nomor: c.nomor,
      nama: c.matakuliah.nama,
      dosen: c.dosen
        ? `${c.gelar_dpn ? c.gelar_dpn + ' ' : ''}${c.dosen}${c.gelar_blk ? ', ' + c.gelar_blk : ''}`
        : undefined,
      kodeKelas: c.kode_kelas,
      pararel: c.pararel,
    }));

    res.status(200).json({
      status: 'success',
      message: 'Courses retrieved successfully.',
      data: {
        academicYear: {
          tahun,
          semester,
          tahunAjaran: config.tahun_ajaran_aktif,
        },
        total: courses.length,
        courses,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve courses.';
    logger.error({ err: error }, 'Failed to get student courses');
    res.status(500).json({
      status: 'error',
      message,
      data: null,
    });
  }
}
