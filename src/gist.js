var d3 = require('d3');

var gist = {
    _isJson: function(ex) {
        var n = ex.split('.');
        var extension = n[n.length - 1];
        if (n.length > 1 && extension !== 'geojson') return false;
        return true;
    },

    get: function(id, cb) {
        var self = this;
        var request = d3.xhr('https://api.github.com/gists/' + id, 'application/json');

        request.get(function(err, res) {
            if (err) return cb(err);
            var parsed = JSON.parse(res.response);

            for (var file in parsed.files) {
                if (self._isJson(file)) return cb(parsed.files[file].content);
            }
        });
    },

    save: function(val, cb) {
        var request = d3.xhr('https://api.github.com/gists', 'application/json');
        var geojson = Base64.encodeURI(JSON.stringify(val));
        var requestObject = JSON.stringify({
            description: 'A Gist from MapList',
            public: true,
            files: {
                'list.json': {
                    content: geojson
                }
            }
        });

        request.post(requestObject, cb(err, res));
    }
};

module.exports = gist;
