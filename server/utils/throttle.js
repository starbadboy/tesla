/**
 * Fixed-window counter per key, in memory. Returns an `allow(key)` function that says
 * whether this request may proceed and counts it if so. Stale keys are dropped on each call.
 * ponytail: per-process only; a shared store is needed if the server ever runs more than one instance.
 */
function createThrottle({ limit, windowMs, now = Date.now }) {
    const hits = new Map(); // key -> { count, windowStart }

    function allow(key) {
        const at = now();
        for (const [k, entry] of hits) {
            if (at - entry.windowStart >= windowMs) hits.delete(k);
        }
        const entry = hits.get(key);
        if (!entry) {
            hits.set(key, { count: 1, windowStart: at });
            return true;
        }
        if (entry.count >= limit) return false;
        entry.count += 1;
        return true;
    }

    allow.size = () => hits.size;
    return allow;
}

module.exports = { createThrottle };
