/**
 * Fixed-window counter per key, in memory. Returns an `allow(key)` function that says
 * whether this request may proceed and counts it if so. Stale keys are swept on each call.
 * The map is capped and fails closed: when it is full of live keys, unknown keys are refused
 * rather than evicting a tracked one, so a flood of throwaway keys can never reset a real
 * key's window. Legitimate newcomers see "try again later" until entries age out.
 * ponytail: per-process only; a shared store is needed if the server ever runs more than one instance.
 */
function createThrottle({ limit, windowMs, maxKeys = 5000, now = Date.now }) {
    const hits = new Map(); // key -> { count, windowStart }, in insertion order

    function allow(key) {
        const at = now();
        for (const [k, entry] of hits) {
            if (at - entry.windowStart >= windowMs) hits.delete(k);
        }
        const entry = hits.get(key);
        if (entry) {
            if (entry.count >= limit) return false;
            entry.count += 1;
            return true;
        }
        if (hits.size >= maxKeys) return false;
        hits.set(key, { count: 1, windowStart: at });
        return true;
    }

    allow.size = () => hits.size;
    return allow;
}

module.exports = { createThrottle };
