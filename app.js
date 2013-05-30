// Initialization
// --------------------------------------
var _ = require('underscore');
var d3 = require('d3');
var intent = require('hoverintent');
var base64 = require('js-base64').Base64;
var icons = require('./src/icons.js');
var geojson = require('./src/markers.geojson');
var gist = require('./src/gist.js');

// Compile templates into an object
var templates = {};
d3.selectAll('script[data-template]').each(function() {
    var el = d3.select(this);
    templates[el.attr('data-template')] = _(el.html()).template();
});

// Some setup
var set;
var id;
var map;
var hex = '#5a8cd2';
var marker;
var fromHash;

var _d; // Down Event
var tol = 4; // Touch Tolerance
var _downLock = false;
var _clickTimeout = false;

var m = document.getElementById('map');

// If a hash exists and is an encoded string, parse it.
if (window.location.hash &&
    /^[A-Za-z0-9+\/]{8}/.test(window.location.hash.split('#').pop())) {
    var encoded = window.location.hash.split('#').pop();
    var decode = window.atob(encoded);
    geojson = JSON.parse(decode);

    map = mapbox.map(m, mapbox.layer().id(geojson.layer));

    // Render any known points
    // and list items to the map.
    _.defer(function() {
        renderKnown();
    });
} else if (hasSession()) {
    // Check if a sessionStorage exists
    stashApply();
} else {
    map = mapbox.map(m, mapbox.layer().id(geojson.layer));
}

map.centerzoom({
    lat: geojson.location.lat,
    lon: geojson.location.lon }, geojson.location.zoom);

map.addCallback('panned', function() { stash(); });
map.addCallback('zoomed', function() { stash(); });

function killTimeout() {
    if (_clickTimeout) {
        window.clearTimeout(_clickTimeout);
        _clickTimeout = null;
        return true;
    } else {
        return false;
    }
}

function touchCancel() {
    d3.select(map.parent).on('touchend', null);
    d3.select(map.parent).on('touchmove', null);
    d3.select(map.parent).on('touchcancel', null);
    _downLock = false;
}

// Event handler `mousedown` and `touchstart` events
function onDown() {
    // Ignore double-clicks by ignoring clicks within 300ms of each other.
    if (killTimeout()) { return; }

    // Prevent interaction offset calculations happening while
    // the user is dragging the map. Store this event so that we
    // can compare it to the up event.
    _downLock = true;
    _d = new MM.Point(d3.event.clientX, d3.event.clientY);

    if (d3.event.type === 'mousedown') {
        d3.select(document.body).on('click', onUp);
        d3.select(document.body).on('mouseup', onUp);

    // Only track Single touches.
    // Double touches will not affect this control
    } else if (d3.event.type === 'touchstart' && d3.event.touches.length === 1) {
        // Touch moves invalidate touches
        d3.select(map.parent).on('touchend', onUp);
        d3.select(map.parent).on('touchmove', onUp);
        d3.select(map.parent).on('touchcancel', touchCancel);
    }
}

function onUp() {
    var evt = {};
    var pos = new MM.Point(d3.event.clientX, d3.event.clientY);
    _downLock = false;

    for (var key in d3.event) { evt[key] = d3.event[key]; }

    d3.select(document.body).on('mouseup', null);
    d3.select(map.parent).on('touchend', null);
    d3.select(map.parent).on('touchmove', null);
    d3.select(map.parent).on('touchcancel', null);

    if (Math.round(pos.y / tol) === Math.round(_d.y / tol) &&
        Math.round(pos.x / tol) === Math.round(_d.x / tol)) {
        // Contain the event data in a closure.
        _clickTimeout = window.setTimeout(
        function() {
            _clickTimeout = null;
            addMarker(pos);
        }, 300);
    }
    return onUp;
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
                'title': 'Marker Name',
                'description': 'Description',
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

            document.location.hash = '';
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
            var id = f.properties.id;
            document.location.href = '#' + id;

            d3.select('#' + id).select('input').node().focus();
        });

        return el;
    });

    map.addLayer(marker);
    mapbox.markers.interaction(marker);
    set = false;

    // Stash contents in session storage
    stash();

    if (cb) cb();
}

// Adding Markers
// --------------------------------------
d3.select('.add').on('click', function() {
    if (!set) {
        d3.event.stopPropagation();
        d3.event.preventDefault();

        this.className += ' on';
        set = true;
        d3.select(map.parent).on('mousedown', onDown);
        d3.select(map.parent).on('touchstart', onDown);
    }
});

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
                    }).zoom(zoom).optimal();

                    marker.markers()[i].showTooltip();
                }
            });

            document.location.hash = '';
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
            document.location.hash = '';
        });
    });
}

// Remove Markers
// --------------------------------------
function removeMarker(el) {
    var marker = el.attr('data-parent');

    el.on('click', function() {
        d3.select('#' + marker).remove();
        // Iterate over the geojson object an remove
        // the marker entry with the associated id.
        geojson.features = _(geojson.features).filter(function(f) {
            return f.properties.id !== marker;
        });

        renderMarkers(function() {
            document.location.hash = '';
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

// Initialization
// --------------------------------------
d3.select('#markers')
    .on('scroll', function() {
        if (this.scrollTop > 0) {
            d3.select('.add').classed('shadow', true);
        } else {
            d3.select('.add').classed('shadow', false);
        }
    });

d3.select('.maker')
    .insert('div', '.add')
    .classed('introduction pad2', true)
    .html(templates.introduction({
        title: geojson.title,
        description: geojson.description
    }));

d3.select('#title')
    .call(function(el) {
        updateIntroduction(el, 'title');
    });

d3.select('#description')
    .call(function(el) {
        el.style('height', function() {
            return this.scrollHeight + 'px';
        });

        updateIntroduction(el, 'description');
    })
    .on('cut', resize)
    .on('paste', resize)
    .on('drop', resize)
    .on('keydown', resize);

function updateIntroduction(el, type) {
    el
        .on('keyup', function() {
            var value = el.property('value');
            geojson[type] = value;
            stash();
        });
}

function stash() {
    if (!window.sessionStorage) return false;
    var store = window.sessionStorage;

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

        map = mapbox.map(m, mapbox.layer().id(geojson.layer));

        // Render any known points and list items to the page.
        _.defer(function() {
            renderKnown();
        });
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

d3.select('#permalink').on('click', function() {
    d3.event.stopPropagation();
    d3.event.preventDefault();

    setCoordinates();

    // Update the location object with the current coordinates
    window.location.hash = Base64.encodeURI(JSON.stringify(geojson));
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
        }

        stash();
    });
}
