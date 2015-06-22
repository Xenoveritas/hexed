var hexfile = require('./hex-file');

// Limit the maximum size file we'll load to 4MB.
var MAX_SAFE_INDEX = 1024;

function FilePane(id, filename) {
  var container = document.createElement('div');
  this._container = container;
  this._container.className = 'hex-file';
  document.getElementById('main-tab-contents').appendChild(container);
  this._hexContents = document.createElement('div');
  this._hexContents.className = 'contents';
  this._container.appendChild(this._hexContents);
  this._container.appendChild(this._statusBar = document.createElement('div'))
  this._statusBar.className = 'status-bar';
  this._loadingIndicator = document.createElement('div');
  this._loadingIndicator.className = 'loading';
  this._loadingIndicator.appendChild(document.createTextNode('Loading ' + filename + '...'));
  container.appendChild(this._loadingIndicator);
  var me = this;
  hexfile.open(filename, function(err, file) {
    if (err) {
      window.alert("Error.");
      console.log(err);
    } else {
      me.file = file;
      me._init();
    }
  });
}

FilePane.prototype = {
  /**
   * Init the pane once the file is open.
   */
  _init: function() {
    this.loadChunk(0);
  },
  /**
   * Formats a single byte. Basically convert a byte into two upper-case hex
   * characters.
   */
  _formatByte: function(byte) {
    var s = byte.toString(16).toUpperCase();
    return s.length == 1 ? "0" + s : s;
  },
  /**
   * Translates a byte into a "decoded" form. At some point this is probably
   * going to be updated to do UTF-8 decoding (because that makes more sense
   * these days) but for now it only does ASCII values. Any character that's
   * out of range is returned as '.'. (This may be changed to be null in the
   * future so it can be rendered differently in the output.)
   */
  _decodeByte: function(byte) {
    if (byte < 32) {
      return '.';
    } else if (byte < 128) {
      return String.fromCharCode(byte);
    } else {
      return '.';
    }
  },
  _appendChunk: function(index, chunk) {
    // TODO: Only load visible chunks. (No need to load the entire file into
    // memory.)
    if (this._loadingIndicator) {
      // Remove the loading indicator
      this._loadingIndicator.remove();
      this._loadingIndicator = null;
    }
    if (!this._gutterDiv) {
      // Create the various components of the view that haven't been generated
      // yet.
      this._gutterDiv = document.createElement('div');
      this._gutterDiv.className = 'gutter';
      this._hexDiv = document.createElement('div');
      this._hexDiv.className = 'hex';
      this._decodeDiv = document.createElement('div');
      this._decodeDiv.className = 'decode';
      this._hexContents.appendChild(this._gutterDiv);
      this._hexContents.appendChild(this._hexDiv);
      this._hexContents.appendChild(this._decodeDiv);
    }
    var offset = index * hexfile.CHUNK_SIZE, line, hex, decoded, linenum;
    for (var i = 0; i < chunk.length;) {
      line = document.createElement('div');
      line.className = 'offset-number';
      line.innerText = (offset + i).toString(16).toUpperCase();
      this._gutterDiv.appendChild(line);
      hex = '';
      decoded = '';
      for (var j = 0; i < chunk.length && j < 16; i++, j++) {
        hex += this._formatByte(chunk[i]) + " ";
        decoded += this._decodeByte(chunk[i]);
      }
      line = document.createElement('div');
      line.className = 'line';
      line.innerText = hex;
      this._hexDiv.appendChild(line);
      line = document.createElement('div');
      line.className = 'line';
      line.innerText = decoded;
      this._decodeDiv.appendChild(line);
    }
  },
  /**
   * Load the given chunk. Files are organized into chunks of CHUNK_SIZE as far
   * as we're concerned.
   */
  loadChunk: function(index) {
    this._statusBar.innerText = 'Size: ' + this.file.size + ' (loading: ' + (((index * hexfile.CHUNK_SIZE) / this.file.size) * 100).toFixed(1) + '%)';
    if (index > MAX_SAFE_INDEX) {
      alert("File size is too large, truncating.");
      return;
    }
    var me = this;
    this.file.readChunk(index, function(err, buffer) {
      if (buffer != null) {
        me._appendChunk(index, buffer);
        me.loadChunk(index + 1);
      } else {
        me._statusBar.innerText = 'Size: ' + me.file.size;
      }
    });
  },
  close: function() {
    this._container.remove();
  },
  runJavaScript: function() {
    // Display a modal
  }
};

module.exports = FilePane;
