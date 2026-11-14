import axios from 'axios';
import etholConfig from '../config/ethol.js';
import logger from '../utils/logger.js';
import type {
  EtholCourseItem,
  EtholScheduleItem,
  EtholAssignmentItem,
  EtholAttendanceItem,
} from '../types/ethol.types.js';

function createEtholApiClient(accessToken: string) {
  return axios.create({
    baseURL: etholConfig.baseUrl,
    timeout: 15000,
    headers: {
      'Cookie': `token=${accessToken}`,
    },
  });
}

const HARI_MAP: Record<number, string> = {
  0: 'Senin',
  1: 'Selasa',
  2: 'Rabu',
  3: 'Kamis',
  4: "Jum'at",
  5: 'Sabtu',
  6: 'Minggu',
};

export async function fetchCourses(
  accessToken: string,
  tahun: number,
  semester: number
): Promise<EtholCourseItem[]> {
  const client = createEtholApiClient(accessToken);

  logger.info({ tahun, semester }, 'Fetching student courses from remote academic system');

  const response = await client.get<EtholCourseItem[]>(etholConfig.endpoints.kuliah, {
    params: { tahun, semester },
  });

  if (response.status === 401) {
    throw new Error('ETHOL access token expired during courses fetch');
  }

  logger.info({ count: response.data.length }, 'Student courses fetched successfully');

  return response.data;
}

export async function fetchSchedules(
  accessToken: string,
  courseIds: number[],
  tahun: number,
  semester: number
): Promise<EtholScheduleItem[]> {
  const client = createEtholApiClient(accessToken);

  const payload = {
    kuliahs: courseIds.map((id) => ({ nomor: id, jenisSchema: 4 })),
    tahun,
    semester,
  };

  logger.info({ courseCount: courseIds.length, tahun, semester }, 'Fetching schedules from remote academic system');

  const response = await client.post<EtholScheduleItem[]>(etholConfig.endpoints.jadwal, payload);

  if (response.status === 401) {
    throw new Error('ETHOL access token expired during schedule fetch');
  }

  logger.info({ count: response.data.length }, 'Schedules fetched successfully');

  return response.data;
}

export function filterTodaySchedules(schedules: EtholScheduleItem[]): EtholScheduleItem[] {
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const todayName = HARI_MAP[todayIndex] ?? '';

  return schedules.filter((s) => s.hari === todayName);
}

export async function fetchAssignments(
  accessToken: string,
  courseIds: number[]
): Promise<EtholAssignmentItem[]> {
  const client = createEtholApiClient(accessToken);

  const payload = {
    kuliahs: courseIds.map((id) => ({ nomor: id })),
  };

  logger.info({ courseCount: courseIds.length }, 'Fetching assignments from remote academic system');

  const response = await client.post<EtholAssignmentItem[]>(
    etholConfig.endpoints.tugas,
    payload
  );

  if (response.status === 401) {
    throw new Error('ETHOL access token expired during assignment fetch');
  }

  logger.info({ count: response.data.length }, 'Assignments fetched successfully');

  return response.data;
}

export function filterPendingAssignments(
  assignments: EtholAssignmentItem[]
): EtholAssignmentItem[] {
  return assignments.filter((a) => a.submission_time === null || a.submission_time === undefined);
}

export async function fetchActiveAttendance(
  accessToken: string,
  courseId: number
): Promise<EtholAttendanceItem | null> {
  const client = createEtholApiClient(accessToken);

  logger.debug({ courseId }, 'Checking active attendance session');

  const response = await client.get<unknown>(etholConfig.endpoints.presensiAktif, {
    params: { kuliah: courseId, jenis_schema: 4 },
  });

  if (response.status === 401) {
    throw new Error('ETHOL access token expired during attendance check');
  }

  if (!response.data) {
    return null;
  }

  if (Array.isArray(response.data)) {
    if (response.data.length === 0) {
      return null;
    }
    return response.data[0] as EtholAttendanceItem;
  }

  return response.data as EtholAttendanceItem;
}
