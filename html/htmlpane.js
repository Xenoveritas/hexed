var hexfile = require('./hex-file');

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
  _appendChunk: function(index, chunk) {
    if (this._loadingIndicator) {
      // Remove the loading indicator
      this._loadingIndicator.parentNode.removeChild(this._loadingIndicator);
      this._loadingIndicator = null;
    }
    var div = document.createElement('div');
    div.className = 'chunk';
    this._container.appendChild(div);
    var offset = index * hexfile.CHUNK_SIZE, line, html, linenum;
    for (var i = 0; i < chunk.length;) {
      line = document.createElement('div');
      line.className = 'bytes';
      html = '<span class="linenum">' + (offset + i).toString(16).toUpperCase() + '</span>';
      for (var j = 0; i < chunk.length && j < 16; i++, j++) {
        html += this._formatByte(chunk[i]) + " ";
      }
      line.innerHTML = html;
      div.appendChild(line);
    }
  },
  /**
   * Load the given chunk. Files are assumed to be in chunks.
   */
  loadChunk: function(index) {
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
