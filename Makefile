# See the README for installation instructions.
UGLIFY = node_modules/.bin/uglifyjs
BROWSERIFY = node_modules/.bin/browserify

all: \
	$(shell npm install && mkdir -p dist) \
	dist/maplist.js \
	dist/maplist.min.js

clean:
	rm -f dist/*

LIBS = \
	src/mapbox.js

APPLICATION = \
	oauth.json \
	src/url.js \
	src/templates.js \
	src/gist.js \
	src/icons.js \
	src/cookie.js \
	src/intent.js \
	src/markers.geojson \
	app.js

dist/maplist.js: $(APPLICATION) $(LIBS)
	cat $(LIBS) > dist/maplist.js
	$(BROWSERIFY) app.js >> dist/maplist.js

dist/maplist.min.js: dist/maplist.js
	$(UGLIFY) dist/maplist.js > dist/maplist.min.js

.PHONY: clean
