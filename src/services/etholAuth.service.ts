import axios, { type AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import prisma from '../config/prisma.js';
import { decrypt } from '../utils/encryption.js';
import {
  getCachedEtholAccessToken,
  setCachedEtholAccessToken,
  invalidateCachedEtholAccessToken,
} from '../utils/tokenCache.js';
import etholConfig from '../config/ethol.js';
import logger from '../utils/logger.js';
import type { CasLoginResult, EtholConfig, EtholTokenValidation } from '../types/ethol.types.js';

function createSessionClient(): { client: AxiosInstance; jar: CookieJar } {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      timeout: 15000,
      maxRedirects: 0,
      validateStatus: (status) => status < 400 || status === 302,
      jar,
      withCredentials: true,
    })
  );
  return { client, jar };
}

function extractCookieValue(setCookieHeaders: string[], cookieName: string): string | null {
  for (const header of setCookieHeaders) {
    if (header.startsWith(`${cookieName}=`)) {
      const value = header.split(';')[0]?.split('=').slice(1).join('=');
      if (value) return value;
    }
  }
  return null;
}

export async function validateEtholToken(accessToken: string): Promise<EtholTokenValidation> {
  const { client, jar } = createSessionClient();
  const targetUrl = new URL(etholConfig.baseUrl);
  await jar.setCookie(`token=${accessToken}; Domain=${targetUrl.hostname}; Path=/`, etholConfig.baseUrl);

  logger.debug('Validating ETHOL access token with remote service');

  const response = await client.get<EtholTokenValidation>(
    `${etholConfig.baseUrl}${etholConfig.endpoints.validasiToken}`,
    {
      headers: {
        'Cookie': `token=${accessToken}`,
      },
      validateStatus: (status) => status < 500,
    }
  );

  if (response.status === 401 || response.status === 403) {
    logger.warn('ETHOL access token is invalid or expired during validation');
    throw new Error('ETHOL access token is invalid or expired.');
  }

  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to validate ETHOL token: status ${response.status}`);
  }

  logger.debug({ nrp: response.data.nipnrp }, 'ETHOL token validated successfully');
  return response.data;
}

export async function fetchEtholConfig(accessToken: string): Promise<EtholConfig> {
  const { client, jar } = createSessionClient();
  const targetUrl = new URL(etholConfig.baseUrl);
  await jar.setCookie(`token=${accessToken}; Domain=${targetUrl.hostname}; Path=/`, etholConfig.baseUrl);

  logger.debug('Fetching academic configuration from ETHOL');

  const response = await client.get<EtholConfig>(
    `${etholConfig.baseUrl}${etholConfig.endpoints.config}`,
    {
      headers: {
        'Cookie': `token=${accessToken}`,
      },
      validateStatus: (status) => status < 500,
    }
  );

  if (response.status === 401 || response.status === 403) {
    logger.warn('ETHOL access token is invalid or expired while fetching config');
    throw new Error('ETHOL access token is invalid or expired.');
  }

  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to fetch ETHOL config: status ${response.status}`);
  }

  logger.debug(
    { tahun: response.data.tahun_aktif, semester: response.data.semester_aktif },
    'ETHOL academic config fetched successfully'
  );

  return response.data;
}

export async function loginViaEtholCas(username: string, password: string): Promise<CasLoginResult> {
  const { client } = createSessionClient();
  const casLoginUrlWithService = `${etholConfig.casLoginUrl}?service=${encodeURIComponent(etholConfig.casCallbackUrl)}`;

  logger.info({ username }, 'Starting ETHOL CAS login flow');

  const casPageResponse = await client.get(casLoginUrlWithService);
  const $ = cheerio.load(casPageResponse.data as string);

  const lt = $('input[name="lt"]').val() as string | undefined;
  const eventId = $('input[name="_eventId"]').val() as string | undefined;

  if (!lt) {
    throw new Error('Failed to extract CAS login ticket (lt) from login page');
  }

  logger.debug({ username }, 'CAS login page loaded, login ticket extracted');

  const formData = new URLSearchParams({
    username: username,
    password: password,
    lt: lt,
    _eventId: eventId || 'submit',
    submit: 'LOGIN',
  });

  const loginResponse = await client.post(casLoginUrlWithService, formData.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': etholConfig.casOrigin,
      'Referer': casLoginUrlWithService,
    },
  });

  if (loginResponse.status !== 302) {
    logger.warn({ username, status: loginResponse.status }, 'CAS login failed — invalid credentials');
    throw new Error('Invalid PENS credentials. CAS login did not redirect.');
  }

  const casRedirectLocation = loginResponse.headers['location'] as string | undefined;
  if (!casRedirectLocation) {
    logger.warn({ username }, 'CAS login did not return a redirect location');
    throw new Error('Unexpected CAS response: Missing redirect location after login.');
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(casRedirectLocation, etholConfig.baseUrl);
  } catch (err) {
    logger.warn({ username, casRedirectLocation, err }, 'Invalid CAS redirect URL format');
    throw new Error('Invalid CAS redirect URL format.');
  }

  const expectedOrigin = new URL(etholConfig.baseUrl).origin;
  if (redirectUrl.origin !== expectedOrigin) {
    logger.error(
      { username, attemptedOrigin: redirectUrl.origin, expectedOrigin },
      'Security alert: Untrusted CAS redirect origin detected (Anti-Open Redirect blocked)'
    );
    throw new Error('Untrusted redirect origin after CAS login.');
  }

  if (redirectUrl.pathname !== etholConfig.endpoints.casCallback) {
    logger.error(
      { username, attemptedPath: redirectUrl.pathname, expectedPath: etholConfig.endpoints.casCallback },
      'Security alert: Invalid callback path after CAS login'
    );
    throw new Error('Invalid callback path after CAS login.');
  }

  logger.debug({ username }, 'CAS login successful, following callback redirect');

  const callbackResponse = await client.get(casRedirectLocation, {
    headers: {
      'Referer': `${etholConfig.casOrigin}/`,
    },
  });

  const setCookieHeaders: string[] = [];
  const rawSetCookie = callbackResponse.headers['set-cookie'];
  if (Array.isArray(rawSetCookie)) {
    setCookieHeaders.push(...rawSetCookie);
  } else if (typeof rawSetCookie === 'string') {
    setCookieHeaders.push(rawSetCookie);
  }

  const accessToken = extractCookieValue(setCookieHeaders, 'token');
  const refreshToken = extractCookieValue(setCookieHeaders, 'refresh_token');

  if (!accessToken || !refreshToken) {
    throw new Error('Failed to capture tokens from ETHOL cas-callback response');
  }

  const validation = await validateEtholToken(accessToken);

  const result: CasLoginResult = {
    accessToken,
    refreshToken,
    nomor: validation.nomor,
    nipnrp: validation.nipnrp,
    nama: validation.nama,
  };

  logger.info({ username, nrp: result.nipnrp, nama: result.nama }, 'ETHOL CAS login flow completed successfully and token validated');

  return result;
}

export async function refreshEtholAccessToken(refreshToken: string): Promise<string> {
  const { client, jar } = createSessionClient();
  const targetUrl = new URL(etholConfig.baseUrl);

  await jar.setCookie(
    `refresh_token=${refreshToken}; Domain=${targetUrl.hostname}; Path=/; HttpOnly; SameSite=Lax`,
    etholConfig.baseUrl
  );

  logger.debug('Attempting ETHOL access token refresh');

  const response = await client.post(
    `${etholConfig.baseUrl}${etholConfig.endpoints.refresh}`,
    {},
    {
      validateStatus: (status) => status < 500,
    }
  );

  if (response.status === 401 || response.status === 403) {
    logger.warn('ETHOL refresh token expired or invalid');
    throw new Error('ETHOL refresh token expired. User must re-link their account.');
  }

  const setCookieHeaders: string[] = [];
  const rawSetCookie = response.headers['set-cookie'];
  if (Array.isArray(rawSetCookie)) {
    setCookieHeaders.push(...rawSetCookie);
  } else if (typeof rawSetCookie === 'string') {
    setCookieHeaders.push(rawSetCookie);
  }

  const newAccessToken = extractCookieValue(setCookieHeaders, 'token');

  if (!newAccessToken) {
    throw new Error('Failed to obtain new access token from ETHOL refresh');
  }

  logger.debug('ETHOL access token refreshed successfully');

  return newAccessToken;
}

export async function getAccessTokenForStudent(
  identifier: string
): Promise<{ accessToken: string; credentialId: string; nrp: string; email?: string | null }> {
  const cachedToken = getCachedEtholAccessToken(identifier);
  if (cachedToken) {
    const credential = await prisma.etholCredential.findFirst({
      where: {
        OR: [
          { etholNrp: identifier },
          { etholEmail: identifier },
        ],
      },
      select: { id: true, etholNrp: true, etholEmail: true, refreshTokenExpiresAt: true },
    });

    if (!credential) {
      invalidateCachedEtholAccessToken(identifier);
      throw new Error('No linked ETHOL account found. Please link your account first.');
    }

    if (new Date() > credential.refreshTokenExpiresAt) {
      invalidateCachedEtholAccessToken(identifier);
      if (credential.etholEmail) invalidateCachedEtholAccessToken(credential.etholEmail);
      invalidateCachedEtholAccessToken(credential.etholNrp);
      throw new Error('ETHOL refresh token has expired. Please re-link your account.');
    }

    return {
      accessToken: cachedToken,
      credentialId: credential.id,
      nrp: credential.etholNrp,
      email: credential.etholEmail,
    };
  }

  const credential = await prisma.etholCredential.findFirst({
    where: {
      OR: [
        { etholNrp: identifier },
        { etholEmail: identifier },
      ],
    },
  });

  if (!credential) {
    throw new Error('No linked ETHOL account found. Please link your account first.');
  }

  if (new Date() > credential.refreshTokenExpiresAt) {
    throw new Error('ETHOL refresh token has expired. Please re-link your account.');
  }

  const refreshToken = decrypt(
    credential.encryptedRefreshToken,
    credential.refreshTokenIv,
    credential.refreshTokenTag
  );

  const accessToken = await refreshEtholAccessToken(refreshToken);
  setCachedEtholAccessToken(credential.etholNrp, accessToken);
  if (credential.etholEmail) {
    setCachedEtholAccessToken(credential.etholEmail, accessToken);
  }

  return {
    accessToken,
    credentialId: credential.id,
    nrp: credential.etholNrp,
    email: credential.etholEmail,
  };
}

export const getAccessTokenForNrp = getAccessTokenForStudent;
