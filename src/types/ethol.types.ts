export interface CasLoginResult {
  accessToken: string;
  refreshToken: string;
  nomor: number;
  nipnrp: string;
  nama: string;
}

export interface EtholConfig {
  success: boolean;
  id: string;
  nama_aplikasi: string;
  akronim_nama_aplikasi: string;
  tahun_aktif: number;
  semester_aktif: number;
  tahun_ajaran_aktif: string;
  menit_per_jam: number;
}

export interface EtholTokenValidation {
  nomor: number;
  nipnrp: string;
  nama: string;
  hakAkses: string[];
  iat: number;
  exp: number;
}

export interface EtholCourseItem {
  nomor: number;
  kuliah_asal?: number;
  jenisSchema?: number;
  matakuliah: {
    nomor: number;
    nama: string;
    namaDasar?: string;
    jenisSchemaMk?: number;
  };
  dosen?: string;
  gelar_dpn?: string;
  gelar_blk?: string;
  nip_dosen?: string;
  nomor_dosen?: number;
  kode_kelas?: string;
  pararel?: string;
  [key: string]: unknown;
}

export interface EtholScheduleItem {
  kuliah?: number;
  hari: string;
  jam_awal?: string;
  jam_akhir?: string;
  nomor_hari?: number;
  nomor_ruang?: number;
  ruang?: string;
  matakuliah?: string;
  nomor?: number;
  [key: string]: unknown;
}

export interface EtholAssignmentItem {
  id?: number;
  nomor?: number;
  course?: number;
  kuliah?: number;
  title?: string;
  judul?: string;
  description?: string;
  deskripsi?: string;
  deadline?: string;
  deadline_indonesia?: string;
  created?: string;
  created_indonesia?: string;
  file?: { id: number; path: string }[];
  student_note?: string | null;
  grade?: number | null;
  correction_date?: string | null;
  correction_date_indonesia?: string | null;
  lecturer_note?: string | null;
  submission_file?: string | null;
  submission_time?: string | null;
  submission_time_indonesia?: string | null;
  nomor_tugas_mahasiswa?: number | null;
  nomor_tugas_file_mahasiswa?: number | null;
  tutup?: number;
  jmlMahasiswaMengerjakan?: number;
  jmlMahasiswaDinilai?: number;
  jmlMahasiswa?: number;
  kuliah_nomor?: number;
  [key: string]: unknown;
}

export interface EtholAttendanceItem {
  nomor?: number;
  kuliah?: number;
  [key: string]: unknown;
}

export interface EtholSyncResult {
  academicYear: {
    tahun: number;
    semester: number;
    tahunAjaran: string;
  };
  courses: {
    nomor: number;
    nama: string;
    dosen?: string;
    kodeKelas?: string;
  }[];
  todaySchedules: EtholScheduleItem[];
  allSchedules: EtholScheduleItem[];
  pendingAssignments: EtholAssignmentItem[];
}

export interface LinkAccountRequest {
  email?: string;
  nrp?: string;
  password: string;
}

export interface SyncDataRequest {
  email?: string;
  nrp?: string;
  tahun?: number;
  semester?: number;
}
