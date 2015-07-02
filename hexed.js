var app = require('app');  // Module to control application life.
var BrowserWindow = require('browser-window');
var HexedWindow = require('./lib/hex-window');

// Report crashes to our server.
//require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var hexedWindows = [];

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  console.log("All windows are closed");
  if (process.platform != 'darwin') {
    console.log("This isn't OS X, quitting");
    app.quit();
  }
});

function openNewWindow(files) {
  // Create the browser window.
  var newWindow = new HexedWindow();
  hexedWindows.push(newWindow);
  newWindow.once('ready', function() {
    // Currently just open "whatever the first one is"
    if (files && files.length > 0)
      newWindow.open(files[0]);
  });

  // Emitted when the window is closed.
  newWindow.on('closed', function() {
    // Remove this window from the windows array
    for (var i = 0; i < hexedWindows.length; i++) {
      if (hexedWindows[i] === newWindow) {
        // FIXME: Actually splice the array
        hexedWindows[i] = null;
        newWindow = null;
      }
    }
  });
}

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  var Menu = require('menu');
  // Build our menu
  var menu = require('./lib/hex-menu').createMenu();
  Menu.setApplicationMenu(menu);

  var files = [];
  // FIXME: Is this even remotely correct?
  for (var i = 2; i < process.argv.length; i++) {
    files.push(process.argv[i]);
  }
  openNewWindow(files);
});

module.exports.openNewWindow = openNewWindow;
