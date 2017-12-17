const less = require('less'),
  fs = require('fs'),
  path = require('path'),
  debuglog = require('./debuglog').debuglog('load-styles');

// TODO: At some point, the generated files should probably be cached and we
// should load them that way. Actually I guess ultimately all that stuff should
// happen during startup, maybe.

function loadSheet(filename, callback) {
  if (arguments.length < 2 || callback == null) {
    callback = function() { };
  }
  debuglog("read %s", filename);
  fs.readFile(filename, { encoding: 'utf8' }, (err, src) => {
    if (err) {
      debuglog("error reading %s: %j", filename, err);
      return callback(err);
    } else {
      less.render(src, { filename: filename }).then(function(result) {
        // Append a new stylesheet to the result
        var style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.appendChild(document.createTextNode(result.css));
        document.head.appendChild(style);
      }, function(err) {
        // FIXME: Arguably this should be sent to console.error, but we're in
        // the browser context, so it can't. This should be a "higher level"
        // error or something.
        console.log("LESS error: " + err);
        callback(err);
      })
    }
  });
}

loadSheet(path.join(path.dirname(module.filename), 'less', 'hexed.less'));
