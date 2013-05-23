// Initialization
// --------------------------------------
var _ = require('underscore');
var d3 = require('d3');
var intent = require('hoverintent');
var icons = require('./src/icons.js');
var map = mapbox.map('map', mapbox.layer().id('tristen.map-ixqro653'));
    map.zoom(3);

// Compile templates into an object
var templates = {};
d3.selectAll('script[data-template]').each(function() {
    var el = d3.select(this);
    templates[el.attr('data-template')] = _(el.html()).template();
});

// Some setup
var point;
var set;
var _d; // Down Event
var tol = 4; // Touch Tolerance
var _downLock = false;
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
    // the user is dragging the map. Store this event so that we // can compare it to the up event.
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
    if (!set) {
        var l = map.pointLocation(pos);

        // Create and add marker layer
        point = mapbox.markers.layer().features([{
            'geometry': {
                'type': 'Point',
                'coordinates': [l.lon, l.lat]
            },
            'properties': {
                'marker-size': 'large',
                'marker-color': '#f0a'
            }
        }]).factory(function(f) {
            var mark = document.createElement('div');
                mark.className = 'marker';

            var img = document.createElement('img');
                img.className = 'marker-point';
                img.setAttribute('src', f.properties.image);

            mark.appendChild(img);

            var close = document.createElement('a');
                close.className = 'close';
                close.setAttribute('title', 'Remove Marker');
                close.setAttribute('href', '#close');

            mark.appendChild(close);

            // center the map on where it was selected.
            map.ease.location({
                lat: l.lat,
                lon: l.lon
            }).zoom(map.zoom()).optimal();

            return mark;
        });

        map.addLayer(point);
        set = true;
    }
}

d3.select(map.parent).on('mousedown', onDown);
d3.select(map.parent).on('touchstart', onDown);

// Adding Markers
// --------------------------------------
d3.select('.add').on('click', function() {
    d3.event.stopPropagation();
    d3.event.preventDefault();
    var id = 'id-' + Math.random().toString(36).substring(7);

    d3.select('#markers')
        .append('li')
        .classed('pad21h ' + id, true)
        .html(templates.marker())
        .select('.icon-rubbish')
            .attr('data-parent', id)
            .call(removeMarker);

    d3.select(id).select('#maki-icon').call(populateIcons);
    d3.select(id).select('#color-grid').call(populateColors);
});

function populateIcons(el) {}
function populateColors(el) {
    _(icons.colors).each(function(v) {
        el
            .append('li')
            .html(templates.colors({
                hex: v
            }))
    });
}

// Remove Markers
// --------------------------------------
function removeMarker(el) {
    el.on('click', function() {
        d3.select('.' + el.attr('data-parent')).remove();
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

