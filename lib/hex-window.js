/**
 * @module hex-window
 * Basic hexed window. Can contain multiple panes (well, WILL be able to) that
 * display the window.
 */

var BrowserWindow = require('browser-window'),  // Module to create native browser window.
  dialog = require('dialog'),
  HexPane = require('./hex-pane'),
  ipc = require('ipc');

/**
 * Internal ID for windows. Just keeps on counting up.
 */
var id = 0;

/**
 * Map of IDs to windows.
 */
var hexedWindows = {};

ipc.on('file-dropped', function(event, winId, files) {
  var win = hexedWindows[winId];
  if (win) {
    // TODO: Support multiple files
    win.open(files[0]);
  }
});

function HexedWindow() {
  this.window = new BrowserWindow({width: 800, height: 600});
  this.window.loadUrl('file://' + __dirname + '/../html/hex-window.html');
  this.window.hexed = this;
  this.id = id++;
  hexedWindows[this.id] = this;
  this._loaded = false;
  this._pendingMessages = [];
  this.window.webContents.on('will-navigate', function(event) {
    // Never load up new contents - prevents drag and drop from loading files
    // directly into the webview
    event.preventDefault();
  });
  this.window.webContents.on('did-finish-load', (function(me) {
    return function() {
      me.window.webContents.send('set-id', me.id);
      me.window.emit('ready');
    };
  })(this));
  this.window.on('closed', (function(me) {
    return function(event) {
      // Kill this window entirely as it's no longer valid
      console.log("Window %s closed", me.id);
      delete hexedWindows[me.id];
    };
  })(this));
}

HexedWindow.prototype = {
  _openFile: null,
  /**
   * Dev utility: reload all HTML for the window.
   */
  reload: function() {
    this._pane = null;
    this.window.reloadIgnoringCache();
    if (this._openFile) {
      // Bind a new ready listener
      var me = this;
      this.window.once('ready', function() {
        me.open(me._openFile);
      });
    }
  },
  on: function(event, handler) {
    // Pass through to the window
    this.window.on(event, handler);
  },
  once: function(event, handler) {
    this.window.once(event, handler);
  },
  /**
   * Open a given file.
   * <p>
   * At present a single window can only show one file. This will likely change
   * in the future but you gotta start somewhere.
   */
  open: function(path) {
    if (this._pane) {
      // Technically that takes a callback but we don't really care
      this._pane.close();
    }
    this._openFile = path;
    this._pane = new HexPane(this, path);
  },
  /**
   * Show the open file dialog, allowing the user to open a file.
   */
  showOpenDialog: function() {
    var me = this;
    dialog.showOpenDialog(this.window, {}, function(files) {
      if (files) {
        // At present we only deal with a single file at a time, so just pick
        // the first one, I guess.
        me.open(files[0]);
      }
    });
  },
  showJumpDialog: function() {
    this.window.webContents.send('menu', 'jump');
  },
  runJavaScript: function() {
    this.window.webContents.send('menu', 'run-javascript');
  }
}

module.exports = HexedWindow;
