var d3 = require('d3');
var cookie = require('./cookie.js');
var oauth = require('.././oauth.json');

var gist = {
    _isJson: function(ex) {
        var n = ex.split('.');
        var extension = n[n.length - 1];
        if (n.length > 1 && extension !== 'json') return false;
        return true;
    },

    authenticate: function(cb) {
        var request = d3.xhr(oauth.api + '/user', 'application/x-www-form-urlencoded');
        request.header('Authorization', 'token ' + cookie.get('maplist-token'));

        request.get(function(err, res) {
            if (err) return cb(err);
            return cb(null, JSON.parse(res.response));
        });
    },

    authorization: function(request) {
        var user = cookie.get('maplist-username');
        var token = cookie.get('maplist-token');
        if (user && token) request.header('Authorization', 'token ' + token);
        return request;
    },

    get: function(type, parts, cb) {
        var self = this;
        var request = d3.xhr(oauth.api + '/gists/' + parts[0], 'application/json');

        if (type === 'user') {
            request = d3.xhr(oauth.api + '/gists/' + parts[1], 'application/json');
        }

        request.get(function(err, res) {
            if (err) return cb(err);
            var parsed = JSON.parse(res.response);

            for (var file in parsed.files) {
                if (self._isJson(file)) return cb(err, JSON.parse(parsed.files[file].content));
            }
        });
    },

    save: function(val, options, cb) {
        var self = this;
        var request;
        var geojson = JSON.stringify(val, null, 4);

        function createGist() {
            request = d3.xhr(oauth.api + '/gists', 'application/json');
            self.authorization(request);

            // Create a new Gist, anonymous or not.
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
                if (err) return cb(err);
                return cb(null, JSON.parse(res.response));
            });
        }

        if (options.user === cookie.get('maplist-username')) {
            request = d3.xhr(oauth.api + '/gists/' + options.gist, 'application/json');
            this.authorization(request);

            // Update a users gist
            var requestObject = JSON.stringify({
                'files': {
                    'maplist.json': {
                        'content': geojson
                    }
                }
            });

            request.send('PATCH', requestObject, function(err, res) {
                if (err) return createGist();
                return cb(null, JSON.parse(res.response));
            });

        } else {
            createGist();
        }
    }
};

module.exports = gist;
