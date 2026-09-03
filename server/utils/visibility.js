/**
 * The Mongo match every public listing (and the pre-render batch) spreads in. Wraps
 * created before the flag existed have no value at all and stay public, so the test is
 * "not false" rather than "true".
 */
function publicMatch() {
    return { isPublic: { $ne: false } };
}

module.exports = { publicMatch };
