import 'dotenv/config';

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[ETHOL Config]: Required environment variable '${key}' is missing. Please define it in your .env file.`
    );
  }
  return value;
}

export const etholConfig = {
  baseUrl: getRequiredEnv('ETHOL_BASE_URL'),
  casLoginUrl: getRequiredEnv('CAS_LOGIN_URL'),
  casCallbackUrl: getRequiredEnv('CAS_CALLBACK_URL'),
  casOrigin: getRequiredEnv('CAS_ORIGIN'),
  endpoints: {
    casLogin: getRequiredEnv('ETHOL_ENDPOINT_CAS_LOGIN'),
    casCallback: getRequiredEnv('ETHOL_ENDPOINT_CAS_CALLBACK'),
    validasiToken: getRequiredEnv('ETHOL_ENDPOINT_VALIDASI_TOKEN'),
    config: getRequiredEnv('ETHOL_ENDPOINT_CONFIG'),
    refresh: getRequiredEnv('ETHOL_ENDPOINT_REFRESH'),
    kuliah: getRequiredEnv('ETHOL_ENDPOINT_KULIAH'),
    jadwal: getRequiredEnv('ETHOL_ENDPOINT_JADWAL'),
    tugas: getRequiredEnv('ETHOL_ENDPOINT_TUGAS'),
    presensiAktif: getRequiredEnv('ETHOL_ENDPOINT_PRESENSI_AKTIF'),
  },
};

export default etholConfig;
