// Initialization
// --------------------------------------
var _ = require('underscore');
var d3 = require('d3');
var base64 = require('js-base64').Base64;
var icons = require('./src/icons.js');
var geojson = require('./src/markers.geojson');
var url = require('./src/url.js');
var templates = require('./src/templates.js');
var gist = require('./src/gist.js');
var cookie = require('./src/cookie.js');
var intent = require('./src/intent.js');
var oauth = require('./oauth.json');

// Some setup
var set;
var id;
var hex = '#5a8cd2';
var marker;
var m = document.getElementById('maplist');
var state = document.getElementById('save');
var application = d3.select('#application');
var authenticated;
var user;
var gistId;

// Initialize the map
var map = mapbox.map(m, mapbox.layer().id(geojson.layer));
map.getLayerAt(0).named('base');

// Listen to changes in the hash
window.onhashchange = function() { route(); };

if (window.location.hash) {
    route();
} else if (hasSession()) { // Check if a sessionStorage exists
    stashApply();
} else {
    init();
}

function route() {
    if (window.location.hash) {
        // Empty the contents
        d3.select('.share-link').remove();
        application.html('');

        state.innerHTML = 'Loading';
        state.className = 'loading off';

        // Returns the type of path we are working with.
        url(window.location.hash.slice(1), function(type, parts) {
            if (type === 'unknown') return init();
            user = parts[0];
            if (type === 'profile') {
                gist.gists(parts, function(err, res) {
                    if (err) {
                        state.innerHTML = 'Failed to Load Profile';
                        state.className = 'error';
                        console.error(err);
                        init();
                    } else {
                        map.centerzoom({
                            lat: geojson.location.lat,
                            lon: geojson.location.lon }, geojson.location.zoom);

                        // If no maplists were returned
                        if (!res.length) {
                            state.innerHTML = user + ' Has no MapList\'s yet. Back?';
                            state.className = 'back';

                            d3.select('back').on('click', function() {
                                d3.event.stopPropagation();
                                d3.event.preventDefault();
                                window.location.hash = '';
                            });
                        } else {
                            state.innerHTML = 'Loaded';
                            state.className = 'loaded off';

                            application
                                .append('div')
                                .attr('id', 'profile')
                                .classed('profile col12 pad2', true)
                                .append('h1')
                                .html('MapList\'s by ' + user);

                            d3.select('#profile')
                                .append('ul')
                                    .attr('id', 'items')
                                    .classed('items', true);

                            var writeable = (cookie.get('maplist-username') === user) ? true : false;

                            _(res).each(function(item) {
                                var date = new Date(item.updated_at);
                                var d = date.getDate();
                                var m = date.getMonth();
                                var y = date.getFullYear();

                                d3.select('#items')
                                    .append('li')
                                    .classed('col3', true)
                                    .attr('id', 'gist-' + item.id)
                                    .html(templates.list({
                                        title: item.description,
                                        gist: item.id,
                                        date: d + '-' + m + '-' + y,
                                        writeable: writeable,
                                        url: user + '/' + item.id
                                    }))
                                    .select('.icon-rubbish')
                                        .on('click', function() {
                                            var self = this;
                                            d3.event.stopPropagation();
                                            d3.event.preventDefault();

                                            var id = this.id.replace('gist-', '');
                                            if (confirm('Are you sure you want to delete this file?')) {
                                                state.innerHTML = 'Working';
                                                gist.deleteGist(id, function(err, res) {
                                                    if (err) {
                                                        state.innerHTML = 'Failed to delete gist. Try Again?';
                                                        state.className = 'error';
                                                    } else {
                                                        state.innerHTML = 'Deleted!';
                                                        d3.select('#' + self.id).remove();
                                                    }
                                                });
                                            }
                                        });
                            });
                        }
                    }
                });
            } else {
                if (type === 'user') user = parts[0];
                gistId = (type === 'user') ? parts[1] : parts[0];

                gist.get(type, parts, function(err, res) {
                    if (err) {
                        state.innerHTML = 'Failed to load gist';
                        state.className = 'error';
                        console.error(err);
                        init();
                    } else {
                        geojson = res;
                        state.innerHTML = 'Loaded';
                        state.className = 'loaded off';

                        init();
                        renderKnown();
                    }
                });
            }
        });
    }
}

// Check if user is authenticated on GitHub
if (authenticate()) {
    gist.authenticate(function(err, res) {
        if (err) return console.error(err);
        cookie.set('maplist-username', res.login);

        d3.select('#state')
            .append('li')
            .html(templates.logout({
                username: cookie.get('maplist-username')
            }));

        // Manage Logout
        d3.select('.logout').on('click', function() {
            d3.event.stopPropagation();
            d3.event.preventDefault();

            cookie.unset('maplist-username');
            cookie.unset('maplist-token');
            window.location.reload();
        });
    });
} else {
    d3.select('#state')
        .append('li')
        .html(templates.login({
            client: oauth.clientId
        }));
}

function authenticate() {
    if (cookie.get('maplist-token')) return true;
    var match = window.location.href.match(/\?code=([a-z0-9]*)/);

    // Handle Code
    if (match) {
        d3.json(oauth.gatekeeperUrl + '/authenticate/' + match[1], function(err, res) {
            if (err) return console.error(err);

            cookie.set('maplist-token', res.token);
            authenticated = true;

            // Adjust URL
            var regex = new RegExp('\\?code=' + match[1]);
            window.location.href = window.location.href.replace(regex, '');

        return true;
      });
    } else {
        return false;
    }
}

// Initialization
// --------------------------------------
function init() {

    map.removeLayer('base')
    map.addLayer(mapbox.layer().id(geojson.layer));
    map.getLayerAt(0).named('base');

    application
        .append('div')
        .attr('id', 'console')
        .classed('console col5', true);

    d3.select('#console')
        .html('')
        .append('div')
        .classed('maker', true)
        .html(templates.maker())
            .insert('div', '.add')
            .classed('introduction pad2', true)
            .html(templates.introduction({
                title: geojson.title,
                description: geojson.description
            }))
            .selectAll('textarea')
                .call(function(el) {
                    el.style('height', function() {
                        return this.scrollHeight + 'px';
                    });

                    updateIntroduction(el);
                })
                .on('cut', resize)
                .on('paste', resize)
                .on('drop', resize);

    d3.select('#markers')
        .on('scroll', function() {
            if (this.scrollTop > 0) {
                d3.select('.add').classed('shadow', true);
            } else {
                d3.select('.add').classed('shadow', false);
            }
        });

    // Adding Markers
    // --------------------------------------
    d3.select('.add').on('click', function() {
        if (!set) {
            d3.event.stopPropagation();
            d3.event.preventDefault();

            this.className += ' on';
            set = true;

            d3.select(map.parent)
                .on('mousedown', function() {
                    intent(map, function(pos) {
                        addMarker(pos);
                    });
                })
                .on('touchstart', function() {
                    intent(map, function(pos) {
                        addMarker(pos);
                    });
                });
        }
    });

    map.centerzoom({
        lat: geojson.location.lat,
        lon: geojson.location.lon }, geojson.location.zoom);
}

function addMarker(pos) {
    if (set) {
        var l = map.pointLocation(pos);
        id = 'id-' + Math.random().toString(36).substring(7);

        geojson.features.unshift({
            'geometry': {
                'type': 'Point',
                'coordinates': [l.lon, l.lat]
            },
            'properties': {
                'id': id,
                'marker-color': hex,
                'title': '',
                'description': '',
                'marker-zoom': map.zoom()
            }
        });

        renderMarkers(function() {
            // Center the map on where it was selected.
            map.ease.location({
                lat: l.lat,
                lon: l.lon
            }).zoom(map.zoom()).optimal();

            // Show tooltip
            _(marker.markers()).each(function(m, i) {
                if (m.data.properties.id === id) {
                    marker.markers()[i].showTooltip();
                }
            });

            // Stash contents in session storage
            stash();
            markerAdded();
        });
    }
}

function renderMarkers(cb) {
    // Remove the previous marker
    // TODO add new objects to the existing markers layer
    // rather than re-creating the entire layer each time.
    if (typeof marker === 'object') marker.destroy();

    // Create and add marker layer
    marker = mapbox.markers.layer().features(geojson.features).factory(function(f) {
        var el = mapbox.markers.simplestyle_factory(f);

        MM.addEvent(el, 'click', function() {
            d3.select('#' + f.properties.id)
                .select('input')
                .node()
                .focus();
        });

        return el;
    });

    map.addLayer(marker);
    mapbox.markers.interaction(marker);
    set = false;

    if (cb) cb();
}

function markerAdded() {
    d3.select('.add').classed('on', null);

    d3.select('#markers')
        .insert('li', 'li:first-child')
        .classed('clearfix pad2', true)
        .attr('id', id)
        .html(templates.marker({
            hex: hex
        })).select('input').node().focus();

    markerInteraction(id);
}

function markerInteraction(id) {
    d3.select('#' + id).select('.icon-rubbish')
        .attr('data-parent', id)
        .call(removeMarker);

    d3.select('#' + id).select('.color-grid').call(function(el) {
        populateColors(el, id);
    });

    d3.select('#' + id).select('input')
        .attr('data-id', id)
        .call(function(el) {
            markerContentChange(el, 'title');
        });

    d3.select('#' + id).select('textarea')
        .on('change', resize)
        .on('cut', resize)
        .on('paste', resize)
        .on('drop', resize)
        .on('keydown', resize)
        .attr('data-id', id)
        .call(function(el) {
            markerContentChange(el, 'description');
        });
}

function markerContentChange(el, type) {
    var id = el.attr('data-id');

    el
        .on('focus', function() {
            _(marker.markers()).each(function(m, i) {
                if (m.data.properties && m.data.properties.id === id) {
                    var zoom = marker.markers()[i].data.properties['marker-zoom'] || map.zoom();

                    // Center the map to the point.
                    map.ease.location({
                        lat: marker.markers()[i].location.lat,
                        lon: marker.markers()[i].location.lon
                    }).zoom(zoom).optimal(1.5);

                    marker.markers()[i].showTooltip();
                }
            });
        })
        .on('keyup', function() {
            var value = el.property('value');

            _(geojson.features).each(function(f) {
                if (f.properties.id && f.properties.id === id) {
                   f.properties[type] = value;
                }
            });

            _(marker.markers()).each(function(m, i) {
                if (m.data.properties && m.data.properties.id === id) {
                    marker.markers()[i].showTooltip();
                }
            });

            stash();
        });
}

function populateColors(el, id) {
    _(icons.colors).each(function(v) {
        el
            .append('li')
            .html(templates.colors({
                markerId: id,
                hex: v
            }))
            .select('.swatch')
              .call(markerColor);
    });
}

function markerColor(el) {
    el.on('click', function() {
        d3.event.stopPropagation();
        d3.event.preventDefault();

        var color = this.getAttribute('title');
        var markerId = this.getAttribute('data-marker');

        // Run through the array of markers, if an id matches one,
        _(geojson.features).each(function(f) {
            if (f.properties.id === markerId) {
               f.properties['marker-color'] = color;
            }
        });

        d3.select('#' + markerId).select('.icon-marker')
            .style('color', color);

        renderMarkers(function() {
            // Stash contents in session storage
            stash();
        });
    });
}

// Remove Markers
// --------------------------------------
function removeMarker(el) {
    var marker = el.attr('data-parent');

    el.on('click', function() {
        d3.event.stopPropagation();
        d3.event.preventDefault();

        d3.select('#' + marker).remove();
        // Iterate over the geojson object an remove
        // the marker entry with the associated id.
        geojson.features = _(geojson.features).filter(function(f) {
            return f.properties.id !== marker;
        });

        renderMarkers(function() {
            // Stash contents in session storage
            stash();
        });
    });
}

// Aesthetics
// --------------------------------------
function resize() {
    var el = this;
    _.defer(function() {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    });
}

function updateIntroduction(el, type) {
    el
        .on('keyup', function() {
            var value = this.value;
            geojson[this.id] = value;
            resize.call(this);
            stash();
        });
}

function stash() {
    if (!window.sessionStorage) return false;
    var store = window.sessionStorage;

    state.innerHTML = 'Save';
    state.className = 'save';

    d3.selectAll('.share-link').remove();

    // Remove a previous entry
    if (store.session) store.removeItem('session');

    setCoordinates();
    store.setItem('session', Base64.encodeURI(JSON.stringify(geojson)));
}

function hasSession() {
    if (!window.sessionStorage) return false;
    var store = window.sessionStorage;
    var session = store.getItem('session');
    return session ? true : false;
}

function stashApply() {
    if (!window.sessionStorage) return false;
    var store = window.sessionStorage;
    var session = store.getItem('session');

    if (session) {
        var decode = window.atob(session);
        geojson = JSON.parse(decode);

        init();
        renderKnown();
    }
}

function renderKnown() {
    // Render any known features
    _(geojson.features).each(function(f) {
        var id = f.properties.id;

        d3.select('#markers')
            .insert('li', '.markers')
            .classed('clearfix pad2', true)
            .attr('id', id)
            .html(templates.markerCached({
                title: f.properties.title,
                description: f.properties.description,
                hex: f.properties['marker-color']
            }));

        renderMarkers();
        markerInteraction(id);

        // Resize textareas to account for saved content in them
        d3.select('#' + id).select('textarea')
            .style('height', function() {
                return this.scrollHeight + 'px';
            });
    });
}

function setCoordinates() {
    var pos = map.getCenter();
    geojson.location = {
        lon: pos.lon.toFixed(8),
        lat: pos.lat.toFixed(8),
        zoom: map.zoom().toFixed()
    };
}

d3.select('#save').on('click', function() {
    var self = this;
    d3.event.stopPropagation();
    d3.event.preventDefault();

    // Update the location object with the current coordinates
    setCoordinates();
    this.innerHTML = 'Saving';
    this.className = 'off saving';

    gist.save(geojson, {user: user, gist: gistId}, function(err, res) {
        if (err) {
            self.innerHTML = 'Error';
            self.className = 'error';
            console.error(err);
        } else {
            var link = res.id;
            var url = window.location.protocol + '//' + window.location.host + window.location.pathname;

            // If this a registered user saved this list:
            if (res.user) link = res.user.login + '/' + res.id;

            var shareLink = '<input id="link" type="text" value="' +
                url + '#' + link + '">';

            window.location.hash = link;
            self.innerHTML = 'Share link';
            self.className = 'saved off';

            d3.select('.state')
                .insert('li', 'li:last-child')
                .html(shareLink)
                .node().setAttribute('class', 'share-link');

            d3.select('#link').node().select();

            d3.select('#link')
                .on('click', function() {
                    this.select();
                });
        }
    });
});

// Layer Switching
d3.select('.layers').selectAll('a').on('click', function() {
    d3.event.stopPropagation();
    d3.event.preventDefault();

    var layerId = this.getAttribute('data-layer');

    map.removeLayer(geojson.layer);

    // Stack our new layer followed by our marker(s)
    map.addLayer(mapbox.layer().id(layerId));

    if (marker) map.addLayer(marker);
    geojson.layer = layerId;

    d3.select('.layers').selectAll('a').classed('active', null);
    this.className += ' active';

    // Stash contents in session storage
    stash();
});

// Add an active class to the element
// where geojson.layer matches
d3.select('.layers').selectAll('a')
    .classed('active', function() {
        if (this.getAttribute('data-layer') === geojson.layer) {
            return true;
        }
    });

// Find me link
d3.select('#findme').on('click', function() {
    d3.event.stopPropagation();
    d3.event.preventDefault();
    if (navigator.geolocation) getLocation();
});

function getLocation() {
    navigator.geolocation.getCurrentPosition(function(pos) {
        map.centerzoom({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude }, 18);

        geojson.location = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            zoom: 18
        };

        stash();
    });
}
