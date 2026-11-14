interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function getCachedEtholAccessToken(identifier: string): string | null {
  const key = normalizeKey(identifier);
  const cached = tokenCache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    tokenCache.delete(key);
    return null;
  }

  return cached.accessToken;
}

/**
 * @param identifier NRP or Email
 * @param accessToken JWT token
 * @param ttlMs cache duration (default 14 mins)
 */
export function setCachedEtholAccessToken(
  identifier: string,
  accessToken: string,
  ttlMs: number = 14 * 60 * 1000
): void {
  const key = normalizeKey(identifier);
  tokenCache.set(key, {
    accessToken,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateCachedEtholAccessToken(identifier: string): void {
  const key = normalizeKey(identifier);
  tokenCache.delete(key);
}

export default {
  getCachedEtholAccessToken,
  setCachedEtholAccessToken,
  invalidateCachedEtholAccessToken,
};
