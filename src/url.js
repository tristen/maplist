var url = function(hash, cb) {
    var gist = /^[0-9+\/]/;
    var parts = hash.split('/');

    // :gist
    if (gist.test(parts[0])) return cb('anonymous', parts);

    // :user/:gist
    if (parts.length === 2 && gist.test(parts[1])) return cb('user', parts);
};

module.exports = url;
