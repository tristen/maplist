var d3 = require('d3');

var gist = {
    _isJson: function(ex) {
        var n = ex.split('.');
        var extension = n[n.length - 1];
        if (n.length > 1 && extension !== 'json') return false;
        return true;
    },

    api: 'https://api.github.com/gists',

    get: function(id, cb) {
        var self = this;
        var request = d3.xhr(this.api + '/' + id, 'application/json');

        request.get(function(err, res) {
            if (err) return cb(err);
            var parsed = JSON.parse(res.response);

            for (var file in parsed.files) {
                if (self._isJson(file)) return cb(err, JSON.parse(parsed.files[file].content));
            }
        });
    },

    save: function(val, cb) {
        var request = d3.xhr(this.api, 'application/json');
        var geojson = JSON.stringify(val);

        var requestObject = JSON.stringify({
            'description': 'A Gist from MapList',
            'public': true,
            'files': {
                'maplist.json': {
                    'content': geojson
                }
            }
        });

        request.post(requestObject, function(err, res) {
            cb(err, JSON.parse(res.response));
        });
    }
};

module.exports = gist;
