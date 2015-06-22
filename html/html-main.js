/**
 * This file controls the majority of the HTML side of the application.
 * Conceptually this file should be a single object but since the module is
 * unique per window I'm not sure that matters.
 */

var FileUI = require('./file-pane-ui');
var hexfile = require('./hexfile');

var ipc = require('ipc');
var path = require('path');

var activePane = null;

ipc.on('pane-open', function(id, filename) {
  // Currently we don't support tabs so opening a new pane really means "replace
  // the existing one"
  if (activePane) {
    activePane.close();
  }
  hexfile.open(filename, function(err, file) {
    if (err) {
      // TODO: Show error
      console.log(err);
    } else {
      activePane = new FileUI(id, file);
      document.title = path.basename(filename) + ' - Hexed';
    }
  });
});

ipc.on('menu', function(menu) {
  if (activePane == null)
    return;
  if (menu == 'run-javascript') {
    activePane.showJavaScriptPane();
  }
});
