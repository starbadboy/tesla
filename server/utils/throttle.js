/**
 * Fixed-window counter per key, in memory. Returns an `allow(key)` function that says
 * whether this request may proceed and counts it if so. Stale keys are swept on each call
 * and the map is capped, so a flood of fresh keys costs bounded memory and CPU.
 * ponytail: per-process only; a shared store is needed if the server ever runs more than one instance.
 */
function createThrottle({ limit, windowMs, maxKeys = 5000, now = Date.now }) {
    const hits = new Map(); // key -> { count, windowStart }, in insertion order

    function allow(key) {
        const at = now();
        for (const [k, entry] of hits) {
            if (at - entry.windowStart >= windowMs) hits.delete(k);
        }
        // Oldest first: Map iterates in insertion order.
        while (hits.size >= maxKeys) hits.delete(hits.keys().next().value);

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
