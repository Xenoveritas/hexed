var less = require('less'),
  fs = require('fs'),
  path = require('path');

// TODO: At some point, the generated files should probably be cached and we
// should load them that way. Actually I guess ultimately all that stuff should
// happen during startup, maybe.

function loadSheet(filename, callback) {
  if (arguments.length < 2 || callback == null) {
    callback = function() { };
  }
  console.log("read " + filename);
  fs.readFile(filename, { encoding: 'utf8' }, function(err, src) {
    if (err) {
      console.log("error reading " + filename + ": " + err);
      return callback(err);
    } else {
      less.render(src, { filename: filename }).then(function(result) {
        // Append a new stylesheet to the result
        var style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.appendChild(document.createTextNode(result.css));
        document.head.appendChild(style);
      }, function(err) {
        console.log("LESS error: " + err);
        callback(err);
      })
    }
  });
}

loadSheet(path.join(path.dirname(module.filename), 'less', 'hexed.less'));
