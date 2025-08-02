interface RateLimitState {
  logCount: number;
  lastLogTime: number;
}

const RATE_LIMIT = 1000; // Maximum logs per second
const RATE_LIMIT_WINDOW = 1000; // 1 second

let state: RateLimitState = {
  logCount: 0,
  lastLogTime: Date.now()
};

/**
 * Rate limiting function
 * @returns {boolean} True if log is allowed, false if rate limit exceeded
 */
export function checkRateLimit(): boolean {
    const now = Date.now();

    if (now - state.lastLogTime >= RATE_LIMIT_WINDOW) {
        state.logCount = 0;
        state.lastLogTime = now;
    }

    if (state.logCount < RATE_LIMIT) {
        state.logCount++;
        return true;
    }

    // Rate limit exceeded
    return false;
}

export function resetRateLimit(now: number = Date.now()) {
    state = {
        logCount: 0,
        lastLogTime: now
    };
}
