interface FailedAttemptRecord {
  count: number;
  lockedUntil: number | null;
  firstFailedAt: number;
}

const ATTEMPTS = new Map<string, FailedAttemptRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const WINDOW_DURATION_MS = 15 * 60 * 1000;

function normalizeKey(identifier: string): string {
  return identifier.trim().toLowerCase();
}

export function checkLockout(identifier: string): { isLocked: boolean; remainingSeconds?: number } {
  const key = normalizeKey(identifier);
  const record = ATTEMPTS.get(key);
  if (!record) {
    return { isLocked: false };
  }

  const now = Date.now();

  if (record.lockedUntil) {
    if (now < record.lockedUntil) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds };
    }
    ATTEMPTS.delete(key);
    return { isLocked: false };
  }

  if (now - record.firstFailedAt > WINDOW_DURATION_MS) {
    ATTEMPTS.delete(key);
    return { isLocked: false };
  }

  return { isLocked: false };
}

export function recordFailedLoginAttempt(identifier: string): { isNowLocked: boolean; attemptsLeft: number } {
  const key = normalizeKey(identifier);
  const now = Date.now();
  let record = ATTEMPTS.get(key);

  if (!record || now - record.firstFailedAt > WINDOW_DURATION_MS) {
    record = { count: 1, lockedUntil: null, firstFailedAt: now };
    ATTEMPTS.set(key, record);
    return { isNowLocked: false, attemptsLeft: MAX_FAILED_ATTEMPTS - 1 };
  }

  record.count += 1;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return { isNowLocked: true, attemptsLeft: 0 };
  }

  return { isNowLocked: false, attemptsLeft: MAX_FAILED_ATTEMPTS - record.count };
}

export function clearFailedLoginAttempts(identifier: string): void {
  const key = normalizeKey(identifier);
  ATTEMPTS.delete(key);
}

export const checkNrpLockout = checkLockout;

export default {
  checkLockout,
  checkNrpLockout,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
};
