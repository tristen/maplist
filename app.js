// Initialization
// --------------------------------------
var _ = require('underscore');
var d3 = require('d3');
var intent = require('hoverintent');
var icons = require('./src/icons.js');
var geojson = require('./src/markers.geojson');

var m = document.getElementById('map');
var map = mapbox.map(m, mapbox.layer().id('tristen.map-ixqro653'));
    map.zoom(3);

// Compile templates into an object
var templates = {};
d3.selectAll('script[data-template]').each(function() {
    var el = d3.select(this);
    templates[el.attr('data-template')] = _(el.html()).template();
});

// Some setup
var set;
var id;
var hex;
var _d; // Down Event
var tol = 4; // Touch Tolerance
var _downLock = false;
var marker;
var _clickTimeout = false;

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

        geojson.features.push({
            'geometry': {
                'type': 'Point',
                'coordinates': [l.lon, l.lat]
            },
            'properties': {
                'id': id,
                'marker-color': '#505050'
            }
        });

        renderMarkers(function() {
            // center the map on where it was selected.
            map.ease.location({
                lat: l.lat,
                lon: l.lon
            }).zoom(map.zoom()).optimal();

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
    marker = mapbox.markers.layer();

    for (var i = 0; i < geojson.features.length; i++) {
        marker.add_feature(geojson.features[i]);
    }

    map.addLayer(marker);
    set = false;
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
        m.style.cursor = 'crosshair';

        d3.select(map.parent).on('mousedown', onDown);
        d3.select(map.parent).on('touchstart', onDown);
    }
});

function markerAdded() {
    d3.select('.add').classed('on', null);
    hex = '505050';

    d3.select('#markers')
        .append('li')
        .classed('clearfix pad21h ' + id, true)
        .html(templates.marker({
            hex: hex
        }))
        .select('.icon-rubbish')
            .attr('data-parent', id)
            .call(removeMarker);

    // Replace the list item placed with markerContents
    // d3.select(id).select('#maki-icon').call(populateIcons);
    d3.select('.' + id).select('.color-grid').call(function(el) {
        populateColors(el, id);
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

        var color = this.getAttribute('title').split('#').pop();
        var markerId = this.getAttribute('data-marker');

        // Run through the array of markers, if an id matches one,
        // change the 'properties': { 'marker-color': '#505050'
        _(geojson.features).each(function(f) {
            if (f.properties.id === markerId) {
               f.properties['marker-color'] = color;
            }
        });

        d3.select('.' + markerId).select('.icon-marker')
            .style('color', '#' + color);

        renderMarkers();
    });
}

// Remove Markers
// --------------------------------------
function removeMarker(el) {
    var marker = el.attr('data-parent');

    el.on('click', function() {
        d3.select('.' + marker).remove();
        // Iterate over the geojson object an remove
        // the marker entry with the associated id.
        geojson.features = _(geojson.features).filter(function(f) {
            return f.properties.id !== marker;
        });

        renderMarkers();
    });
}

// Aesthetics
// --------------------------------------
d3.select('#markers')
    .on('scroll', function() {
        if (this.scrollTop > 0) {
            d3.select('.add').classed('shadow', true);
        } else {
            d3.select('.add').classed('shadow', false);
        }
    });

// Auto resize textarea to avoid overflow: scroll
d3.select('textarea')
    .on('change', resize)
    .on('cut', resize)
    .on('paste', resize)
    .on('drop', resize)
    .on('keydown', resize);

function resize() {
    var el = this;
    _.defer(function() {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    });
}
