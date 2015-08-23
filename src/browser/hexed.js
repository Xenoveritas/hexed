/**
 * @module
 * This is the master startup module for hexed. It controls the core app and
 * looks after the various windows. Right now it doesn't do all that much, but
 * in the future it will deal with loading plugins and any initial start-up
 * stuff that needs to be done.
 */

var app = require('app');  // Module to control application life.
var BrowserWindow = require('browser-window');
var HexedWindow = require('./hex-window');

// Report crashes to our server.
//require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var hexedWindows = [];

// TODO: Register a new "hexed" protocol for loading our resources.

// TODO: Look for plugins.

// TODO: Restore previous session (if any)

/**
 * Adds a window to the list of windows being tracked. Also adds a close
 * listener to remove it when it closes.
 */
function addWindow(window) {
  hexedWindows.push(window);
  window.on('closed', function() {
    // Remove this window from the windows array
    for (var i = 0; i < hexedWindows.length; i++) {
      if (hexedWindows[i] === window) {
        hexedWindows.splice(i, 1);
        window = null;
      }
    }
  });
}

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  if (process.platform != 'darwin') {
    app.quit();
  }
});

function openNewWindow(files) {
  // Create the browser window.
  var newWindow = new HexedWindow();
  addWindow(newWindow);
  newWindow.once('ready', function() {
    if (files && files.length > 0)
      newWindow.open(files);
  });
}

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  var Menu = require('menu');
  // Build our menu
  var menu = require('./hex-menu').createMenu();
  Menu.setApplicationMenu(menu);

  var files = [];
  // FIXME: Is this even remotely correct?
  for (var i = 2; i < process.argv.length; i++) {
    files.push(process.argv[i]);
  }
  openNewWindow(files);
});

exports.openNewWindow = openNewWindow;
