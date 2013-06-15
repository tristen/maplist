var d3 = require('d3');
var _ = require('underscore');
var templates = {};

d3.selectAll('script[data-template]').each(function() {
    var el = d3.select(this);
    templates[el.attr('data-template')] = _(el.html()).template();
});

module.exports = templates;
