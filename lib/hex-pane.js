/**
 * This is a single pane in the editor. It displays some chunk of the file.
 * For now, "some chunk" is "the entire thing". Strictly speaking this is the
 * "main process" half.
 */

// This is used to generate pane IDs.
var id = 0;

function HexPane(window, path) {
  this.window = window;
  this.path = path;
  this.id = 'pane-' + id++;
  console.log("Opening %s in %s", this.path, this.id);
  // Inform the window to open up our UI
  this._send('pane-open', this.id, path);
  // Start loading the path
}

HexPane.prototype = {
  /**
   * Close this pane.
   */
  close: function() {
    this._send('pane-close', this.id);
  },
  _send: function() {
    console.log("Sending: " + JSON.stringify(arguments));
    this.window.window.webContents.send.apply(this.window.window.webContents, arguments);
  }
}

module.exports = HexPane;
