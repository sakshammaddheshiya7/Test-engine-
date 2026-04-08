type RateLimitInput = {
  key: string;
  maxActions: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

function readActionLog(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function writeActionLog(key: string, values: number[]) {
  localStorage.setItem(key, JSON.stringify(values));
}

export function claimRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const storageKey = `rankforge_rate_limit_${input.key}`;
  const rows = readActionLog(storageKey).filter((item) => now - item < input.windowMs);

  if (rows.length >= input.maxActions) {
    const oldestInWindow = rows[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((input.windowMs - (now - oldestInWindow)) / 1000));
    writeActionLog(storageKey, rows);
    return { allowed: false, retryAfterSec };
  }

  rows.push(now);
  writeActionLog(storageKey, rows);
  return { allowed: true, retryAfterSec: 0 };
}
