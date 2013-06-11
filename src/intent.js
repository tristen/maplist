var d3 = require('d3');

var _d; // Down Event
var tol = 4; // Touch Tolerance
var _downLock = false;
var _clickTimeout = false;

// Event handler `mousedown` and `touchstart` events
module.exports = onDown = function(cb) {

    // Ignore double-clicks by ignoring clicks within 300ms of each other.
    if (killTimeout()) { return; }

    // Prevent interaction offset calculations happening while
    // the user is dragging the map. Store this event so that we
    // can compare it to the up event.
    _downLock = true;
    _d = new MM.Point(d3.event.clientX, d3.event.clientY);

    if (d3.event.type === 'mousedown') {
        d3.select(document.body)
            .on('click', function() {
                onUp(cb);
            })
            .on('mouseup', function() {
                onUp(cb);
            });

    // Only track Single touches.
    // Double touches will not affect this control
    } else if (d3.event.type === 'touchstart' && d3.event.touches.length === 1) {
        // Touch moves invalidate touches
        d3.select(map.parent)
            .on('touchend', function() {
                onUp(cb);
            })
            .on('touchmove', function() {
                onUp(cb);
            })
            .on('touchcancel', touchCancel);
    }
}

function onUp(cb) {
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
            cb(pos);
        }, 300);
    }
    return onUp;
}

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

