var app = require('app');  // Module to control application life.
var BrowserWindow = require('browser-window');
var HexedWindow = require('./lib/hex-window');

// Report crashes to our server.
//require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  if (process.platform != 'darwin')
    app.quit();
});

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  var Menu = require('menu');
  // Build our menu
  var menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'Ctrl+O',
          click: function() { BrowserWindow.getFocusedWindow().hexed.showOpenDialog(); }
        },
        {
          type: 'separator'
        },
        {
          label: 'Exit',
          click: function() {
            // TODO: Not this
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Ctrl+R',
          click: function() { BrowserWindow.getFocusedWindow().reloadIgnoringCache(); }
        },
        {
          label: 'Toggle DevTools',
          accelerator: 'Ctrl+Alt+I',
          click: function() { BrowserWindow.getFocusedWindow().toggleDevTools(); }
        },
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  // Create the browser window.
  mainWindow = new HexedWindow();
  mainWindow.on('ready', function() {
    console.log("Window is ready!");
    // FIXME: Is this even remotely correct?
    for (var i = 2; i < process.argv.length; i++) {
      mainWindow.open(process.argv[i]);
    }
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});
