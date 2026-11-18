import type { Request, Response } from 'express';
import { getAccessTokenForStudent, fetchEtholConfig } from '../../services/etholAuth.service.js';
import { fetchCourses, fetchSchedules } from '../../services/etholSync.service.js';
import logger from '../../utils/logger.js';
import type { EtholCourseItem } from '../../types/ethol.types.js';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

export async function getTodaySchedule(req: Request, res: Response): Promise<void> {
  try {
    const identifier = ((req.query.email || req.query.nrp) as string).trim();

    const { accessToken } = await getAccessTokenForStudent(identifier);
    const config = await fetchEtholConfig(accessToken);

    const rawCourses = await fetchCourses(accessToken, config.tahun_aktif, config.semester_aktif);
    if (!rawCourses || rawCourses.length === 0) {
      res.status(200).json({
        status: 'success',
        message: 'No courses found for the active semester.',
        data: {
          hari: DAY_NAMES[new Date().getDay()],
          total: 0,
          jadwal: [],
        },
      });
      return;
    }

    const courseMap = new Map<number, EtholCourseItem>();
    const courseIds: number[] = [];
    for (const c of rawCourses) {
      courseMap.set(c.nomor, c);
      courseIds.push(c.nomor);
    }

    const allSchedules = await fetchSchedules(
      accessToken,
      courseIds,
      config.tahun_aktif,
      config.semester_aktif
    );

    const now = new Date();
    const jakartaDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const jsDay = jakartaDate.getDay();
    const defaultNomorHari = jsDay === 0 ? 7 : jsDay;
    const defaultDayName = DAY_NAMES[jsDay];

    const todayNomorHari = req.query.nomorHari ? Number(req.query.nomorHari) : defaultNomorHari;
    const todayName = req.query.hari ? String(req.query.hari) : defaultDayName;

    const todaySchedules = allSchedules.filter((s) => {
      if (s.nomor_hari === todayNomorHari) return true;
      if (s.hari && s.hari.toLowerCase().replace("'", '') === todayName.toLowerCase().replace("'", '')) {
        return true;
      }
      return false;
    });

    const formatLecturer = (c?: EtholCourseItem): string => {
      if (!c || !c.dosen) return 'Dosen Pengampu';
      const front = c.gelar_dpn ? `${c.gelar_dpn} ` : '';
      const back = c.gelar_blk ? `, ${c.gelar_blk}` : '';
      return `${front}${c.dosen}${back}`.trim();
    };

    const jadwalHariIni = todaySchedules
      .map((s) => {
        const c = s.kuliah ? courseMap.get(s.kuliah) : undefined;
        const jamMulai = s.jam_awal || '00:00';
        const jamSelesai = s.jam_akhir || '00:00';
        return {
          kuliahId: s.kuliah ?? 0,
          matakuliah: c?.matakuliah?.nama || 'Mata Kuliah',
          dosen: formatLecturer(c),
          ruang: s.ruang || '-',
          jamMulai,
          jamSelesai,
          waktu: `${jamMulai} - ${jamSelesai}`,
          hari: s.hari || todayName,
          nomorHari: s.nomor_hari ?? todayNomorHari,
        };
      })
      .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));

    logger.info(
      { identifier, count: jadwalHariIni.length, hari: todayName },
      'Today schedule retrieved successfully'
    );

    res.status(200).json({
      status: 'success',
      message: 'Today schedule retrieved successfully.',
      data: {
        hari: todayName,
        total: jadwalHariIni.length,
        jadwal: jadwalHariIni,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to retrieve today schedule.';
    logger.error({ err: error }, 'Failed to get today schedule');

    const statusCode = message.includes('No linked ETHOL account found') ? 404 : 500;

    res.status(statusCode).json({
      status: 'error',
      message,
      data: null,
    });
  }
}
