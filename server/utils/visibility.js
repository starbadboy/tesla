/**
 * A wrap is public unless it was explicitly kept private. Wraps created before the
 * flag existed have no value at all and stay public, so the test is "not false".
 */
function isPublicDoc(wrap) {
    return wrap.isPublic !== false;
}

/** The Mongo match every public listing (and the pre-render batch) spreads in. */
function publicMatch() {
    return { isPublic: { $ne: false } };
}

module.exports = { isPublicDoc, publicMatch };
