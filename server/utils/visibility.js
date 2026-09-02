const User = require('../models/User');

/**
 * The Mongo match every public listing (and the pre-render batch) spreads in. Wraps
 * created before the flag existed have no value at all and stay public, so the test is
 * "not false" rather than "true".
 */
function publicMatch() {
    return { isPublic: { $ne: false } };
}

/** Keeping a wrap out of the gallery is a purchaser's privilege; one rule for every route. */
async function mayGoPrivate(userId) {
    const user = await User.findById(userId).select('hasPurchased');
    return Boolean(user?.hasPurchased);
}

module.exports = { publicMatch, mayGoPrivate };
