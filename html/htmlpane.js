var hexfile = require('./hex-file');

// Limit the maximum size file we'll load to 4MB.
var MAX_SAFE_INDEX = 1024;

function FilePane(id, filename) {
  var container = document.createElement('div');
  this._container = container;
  this._container.className = 'hex-file';
  document.getElementById('master-container').appendChild(container);
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
      this._container.appendChild(this._gutterDiv);
      this._container.appendChild(this._hexDiv);
      this._container.appendChild(this._decodeDiv);
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
    if (index > MAX_SAFE_INDEX) {
      alert("File size is too large, truncating.");
      return;
    }
    var me = this;
    this.file.readChunk(index, function(err, buffer) {
      if (buffer != null) {
        me._appendChunk(index, buffer);
        me.loadChunk(index + 1);
      }
    });
  }
};

var ipc = require('ipc');

ipc.on('pane-open', function(id, filename) {
  // Currently we don't support tabs so opening a new pane really means "replace
  // the existing one"
  new FilePane(id, filename);
});
