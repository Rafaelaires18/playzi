type RateLimitConfig = {
    limit: number;
    windowMs: number;
};

type RateBucket = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, RateBucket>();

function nowMs() {
    return Date.now();
}

function cleanupExpired(now: number) {
    for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}

export function checkRateLimit(key: string, config: RateLimitConfig) {
    const now = nowMs();
    if (buckets.size > 5000) cleanupExpired(now);

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
        const resetAt = now + config.windowMs;
        buckets.set(key, { count: 1, resetAt });
        return {
            allowed: true,
            remaining: Math.max(config.limit - 1, 0),
            retryAfterMs: config.windowMs,
        };
    }

    if (existing.count >= config.limit) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterMs: Math.max(existing.resetAt - now, 0),
        };
    }

    existing.count += 1;
    buckets.set(key, existing);
    return {
        allowed: true,
        remaining: Math.max(config.limit - existing.count, 0),
        retryAfterMs: Math.max(existing.resetAt - now, 0),
    };
}
