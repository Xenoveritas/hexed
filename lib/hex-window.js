/**
 * @module hex-window
 * Basic hexed window. Can contain multiple panes (well, WILL be able to) that
 * display the window.
 */

var BrowserWindow = require('browser-window');  // Module to create native browser window.
var dialog = require('dialog');
var HexPane = require('./hex-pane');

function HexedWindow() {
  this.window = new BrowserWindow({width: 800, height: 600});
  this.window.loadUrl('file://' + __dirname + '/../html/hex-window.html');
  this.window.hexed = this;
  this._loaded = false;
  this._pendingMessages = [];
  this.window.webContents.on('did-finish-load', (function(me) {
    return function() {
      me.window.emit('ready');
    };
  })(this));
}

HexedWindow.prototype = {
  on: function(event, handler) {
    // Pass through to the window
    this.window.on(event, handler);
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
