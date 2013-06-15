module.exports = url = function(hash, cb) {
    var gist = /^[0-9+\/]/;
    var parts = hash.split('/');

    // :gist
    if (parts.length === 1 && gist.test(parts[0])) return cb('anonymous', parts);

    // :user
    if (parts.length === 1) return cb('profile', parts);

    // :user/:gist
    if (parts.length === 2 && gist.test(parts[1])) return cb('user', parts);

    return cb('unknown', parts);
};
