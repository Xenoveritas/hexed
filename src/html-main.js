/**
 * This module is the main "controller" for the HTML side of hexed. It maintains
 * the window and the various open tabs inside it.
 */

var ipc = require('ipc');
var path = require('path');

var windowId = null;

// Can process.platform ever contain things like spaces? I dunno. Just replace
// any whitespace with '-' anyway.
document.body.className = 'platform-' + process.platform.replace(/\s/, '-');

// Add drag and drop handlers so you can drop a file on the window and it will
// open in it
var contents = document.body;
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
    ipc.send('files-dropped', windowId, files);
  }
}, false);

// Build our core UI.

var Workspace = require('./workspace').Workspace;

var workspace = new Workspace();

// Set up IPC.
ipc.on('set-id', function(id) {
  windowId = id;
});

ipc.on('open-files', function(filenames) {
  workspace.openFiles(filenames);
});

ipc.on('menu', function(command) {
  // For the most part menu things should be passed straight through to the
  // workspace to decide how it wants to deal with them.
  workspace.doMenuCommand(command);
});

exports.workspace = workspace;
