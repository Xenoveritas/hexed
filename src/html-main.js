/**
 * This module is the main "controller" for the HTML side of hexed. It maintains
 * the window and the various open tabs inside it.
 */
"use strict";

import "./less/hexed.less";

const {ipcRenderer} = require('electron');
const path = require('path');

var windowId = null;

// Can process.platform ever contain things like spaces? I dunno. Just replace
// any whitespace with '-' anyway.
document.body.className = 'platform-' + process.platform.replace(/\s/, '-');

// Add drag and drop handlers so you can drop a file on the window and it will
// open in it
let contents = document.body;
contents.addEventListener('dragenter', (event) => {
  // Check to see if the event is a file
  if (event.dataTransfer.files.length == 1) {
    event.dataTransfer.effectAllowed = 'move';
  } else {
    event.dataTransfer.effectAllowed = 'none';
  }
}, false);
contents.addEventListener('dragover', (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  return false;
});
contents.addEventListener('drop', (event) => {
  if (event.dataTransfer.files.length > 0) {
    // We actually want to notify our parent controller of this drop
    var files = [];
    for (var i = 0; i < event.dataTransfer.files.length; i++) {
      files.push(event.dataTransfer.files[i].path);
    }
    ipcRenderer.send('files-dropped', windowId, files);
  }
}, false);

// Build our core UI.

const Workspace = require('./workspace').Workspace;

let workspace = new Workspace();

// Set up IPC.
ipcRenderer.on('set-id', (event, id) => {
  windowId = id;
});

ipcRenderer.on('open-files', (event, filenames) => {
  workspace.openFiles(filenames);
});

ipcRenderer.on('menu', (event, command) => {
  // For the most part menu things should be passed straight through to the
  // workspace to decide how it wants to deal with them.
  workspace.doMenuCommand(command);
});

exports.workspace = workspace;
