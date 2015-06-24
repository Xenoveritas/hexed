/**
 * This module defines how to deal with the file pane HTML. It creates a virtual
 * scroll bar (much like Atom does itself) because actually creating HTML for
 * every single line of bytes would - well, not work.
 */

var Scrollbar = require('./scrollbar');

function FileUI(id, file) {
  var container = document.createElement('div');
  this._container = container;
  this._container.className = 'hex-file';
  this._container.setAttribute('id', id);
  document.getElementById('main-tab-contents').appendChild(container);
  this._contents = document.createElement('div');
  this._contents.className = 'contents';
  this._gutter = document.createElement('div');
  this._gutter.className = 'gutter';
  this._hex = document.createElement('div');
  this._hex.className = 'hex';
  this._decoded = document.createElement('div');
  this._decoded.className = 'decode';
  this._contents.appendChild(this._gutter);
  this._contents.appendChild(this._hex);
  this._contents.appendChild(this._decoded);
  this._scrollBar = new Scrollbar(this._contents);
  this._scrollBar.setTotal(Math.ceil(file.size / 16));
  this._container.appendChild(this._contents);
  this._container.appendChild(this._statusBar = document.createElement('div'))
  this._statusBar.className = 'status-bar';
  this._loadingIndicator = document.createElement('div');
  this._loadingIndicator.className = 'loading';
  this._loadingIndicator.innerText = file.path + ' (' + file.size + ' bytes)';
  this._statusBar.appendChild(this._loadingIndicator);
  this._lines = [];
  // We need a dummy line to measure line metrics. This line must always be
  // "visible" so we can measure it and needs the same "size" as real lines so
  // we can calculate the number of visible lines but otherwise shouldn't be
  // actually visible.
  this._dummyLine = this._createLine();
  this._dummyLine.setToDummy(Math.floor(file.size / 16));
  this._hex.setAttribute("tabindex", "0");
  this._decoded.setAttribute("tabindex", "0");
  var keydown = (function(me) { return function(event) { me._onKeyDown(event); }; })(this);
  this._hex.addEventListener('keydown', keydown, false);
  this._decoded.addEventListener('keydown', keydown, false);
  var me = this;
  window.addEventListener('resize', function() {
    me.resized();
  }, false);
  this.file = file;
  this._lastLine = Math.ceil(file.size / 16);
  // And now fire a resized that will create all visible lines and load them
  this.resized();
}

/**
 * A single line in the file UI. Lines are split between three virtual columns,
 * so this file handles dealing with keeping them in sync.
 */
FileUI.Line = function(ui) {
  ui._gutter.appendChild(this._gutterDiv = document.createElement('div'));
  ui._hex.appendChild(this._hexDiv = document.createElement('div'));
  ui._decoded.appendChild(this._decodedDiv = document.createElement('div'));
}

FileUI.Line.prototype = {
  /**
   * Set the line data to be the "dummy" line.
   */
  setToDummy: function(offset) {
    this.setOffset(offset);
    this.setContent([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
    this._gutterDiv.className = 'dummy';
    this._hexDiv.className = 'dummy';
    this._decodedDiv.className = 'dummy';
  },
  setOffset: function(offset) {
    if (arguments.length === 0 || offset === null) {
      // "blank" is a valid request
      this._gutterDiv.innerText = "";
      return;
    }
    this._gutterDiv.innerText = offset.toString(16).toUpperCase();
  },
  setContent: function(bytes) {
    if (arguments.length === 0 || bytes === null) {
      // "blank" is a valid request
      this._hexDiv.innerText = "";
      this._decodedDiv.innerText = "";
      return;
    }
    // bytes should be a slice of a buffer
    var hex = new Array(bytes.length), decoded = new Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) {
      // Not clear if byte is signed or not, so make it unsigned
      var byte = bytes[i] & 0xFF,
        h = byte.toString(16).toUpperCase();
      if (h.length < 2)
        h = "0" + h;
      hex[i] = h;
      decoded[i] = byte < 32 || byte >= 127 ? '.' : String.fromCharCode(byte);
    }
    this._hexDiv.innerText = hex.join(' ');
    this._decodedDiv.innerText = decoded.join('');
  }
};

FileUI.prototype = {
  _createLine: function(line) {
    return new FileUI.Line(this);
  },
  /**
   * Move the start of the displayed information to the given offset.
   */
  _loadFrom: function(offset) {
    // Calculate the block we need to load
    var size = this._visibleLines * 16;
    // TODO (maybe): blank existing lines?
    if (!(this._buffer) || this._buffer.length < size) {
      // Allocate a new buffer
      this._buffer = new Buffer(size);
    }
    var me = this, buffer = this._buffer, visibleLines = this._visibleLines;
    this.file.read(buffer, offset, size, function(error, buffer, totalRead) {
      if (error) {
        console.log("ERROR!");
        console.log(error);
      } else {
        // FIXME: What happens if a resize happens during a load event?
        var bytesPerLine = 16;
        for (var i = 0, curOff = offset, curMax = offset + bytesPerLine, size = me.file.size;
            i < visibleLines; i++, curOff += bytesPerLine, curMax += bytesPerLine) {
          if (curOff <= size) {
            me._lines[i].setOffset(curOff);
            if (curMax >= size)
              curMax = size - 1;
            me._lines[i].setContent(buffer.slice(curOff - offset, curMax - offset));
          } else {
            me._lines[i].setOffset();
            me._lines[i].setContent();
          }
        }
      }
    })
  },
  _onKeyDown: function(event) {
    switch (event.keyIdentifier) {
    case "Up":
      // Move up a line
      this._move(-1);
      break;
    case "Down":
      // Move down a line
      this._move(1);
      break;
    case "PageUp":
      // Move up a page
      this._move(-this._visibleLines + 1);
      break;
    case "PageDown":
      this._move(this._visibleLines - 1);
      break;
    case "Home":
      this._moveTo(0);
      break;
    case "End":
      this._moveTo(Math.floor(this.file.size / 16));
      break;
    }
  },
  /**
   * Move the offset a given number of lines.
   */
  _move: function(delta) {
    var offset = this._scrollBar.getPosition();
    offset += delta;
    if (offset < 0)
      offset = 0;
    if (offset > this._lastLine)
      offset = this._lastLine;
    this._moveTo(offset);
  },
  _moveTo: function(offset) {
    if (typeof offset != 'number' || isNaN(offset)) {
      return;
    }
    this._loadFrom(offset * 16);
    this._scrollBar.setPosition(offset);
  },
  hideLoadingStatus: function() {
    this._loadingIndicator.style.display = 'none';
  },
  setLoadingStatus: function(filename, percent) {
    this._loadingIndicator.innerText = 'Loading ' + filename + '... (' + percent + '%)';
  },
  resized: function() {
    // Check to see what our visible area is
    var w = this._contents.offsetWidth, h = this._contents.offsetHeight;
    var lineHeight = this._dummyLine._hexDiv.offsetHeight;
    var visible = Math.ceil(h / lineHeight);
    var needed = visible - this._lines.length;
    this._visibleLines = visible;
    this._scrollBar.setVisibleArea(visible);
    if (needed > 0) {
      for (; needed > 0; needed--) {
        var line = this._createLine();
        this._lines.push(line);
      }
      // And reload
      this._loadFrom(this._scrollBar.getPosition()*16);
    }
    // TODO (maybe): remove no longer needed lines?
  }
};

module.exports = FileUI;
