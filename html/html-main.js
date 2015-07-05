/**
 * This file controls the majority of the HTML side of the application.
 * Conceptually this file should be a single object but since the module is
 * unique per window I'm not sure that matters.
 */

var FileUI = require('./file-pane-ui');
var hexfile = require('./hexfile');

var ipc = require('ipc');
var path = require('path');

var windowId = null;

var activePane = null;

var contents = document.getElementById('main-tab-contents');
contents.addEventListener('dragenter', function(event) {
  // Check to see if the event is a file
  if (event.dataTransfer.files.length == 1) {
    event.dataTransfer.effectAllowed = 'move';
  } else {
    event.dataTransfer.effectAllowed = 'none';
  }
}, false);
contents.addEventListener('dragover', function(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  return false;
});
contents.addEventListener('drop', function(event) {
  console.log("Drop");
  console.log(event);
  if (event.dataTransfer.files.length > 0) {
    // We actually want to notify our parent controller of this drop
    var files = [];
    for (var i = 0; i < event.dataTransfer.files.length; i++) {
      files.push(event.dataTransfer.files[i].path);
    }
    ipc.send('file-dropped', windowId, files);
  }
}, false);

ipc.on('set-id', function(id) {
  console.log("Got id: " + id);
  windowId = id;
});

ipc.on('pane-open', function(id, filename) {
  // Kill the "no open file" bit if present
  document.getElementById('main-tab-no-contents').style.display = 'none';
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
  if (menu == 'jump') {
    // Ask for an address
    activePane.showJumpDialog();
  }
  if (menu == 'run-javascript') {
    activePane.showJavaScriptPane();
  }
});
