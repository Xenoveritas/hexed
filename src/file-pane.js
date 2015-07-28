/**
 * This module defines how to deal with the file pane HTML. It creates a virtual
 * scroll bar (much like Atom does itself) because actually creating HTML for
 * every single line of bytes would - well, not work.
 */

var bootbox = require('bootbox'),
  Scroller = require('./scroller'),
  StringsPane = require('./strings-pane');

/**
 * Internal function for converting a byte to a human-readable character for
 * display.
 */
function convertByte(byte) {
  if (byte < 32) {
    // TODO: Optionally display the UNICODE display codes for these control
    // codes. Overall this looks terrible in most fonts, so instead:
    return '.';
    //return String.fromCharCode(0x2400 + byte);
  } else if (byte < 127) {
    return String.fromCharCode(byte);
  } else {
    return '.';
  }
}

function HexedScroller(container, file) {
  Scroller.call(this, container);
  container.style.position = 'absolute';
  this.file = file;
  // This may eventually become a proper property with write support.
  this.bytesPerLine = 16;
  // Figure out how many lines there are at 16 bytes per line
  this.setTotalLines(Math.ceil(file.size / this.bytesPerLine));
  this._widthsCalculated = false;
  // Create the cursor property.
  (function(me) {
    // Cursor starts as null so we can do this.cursor = 0 to initialize it
    var cursor = null;
    Object.defineProperty(me, 'cursor', {
      get: function() {
        return cursor;
      },
      set: function(value) {
        value = me._clampOffset(value);
        // Note: at present file.size isn't a valid offset since that's one past
        // the end of the file and we don't do editing. With editing it is
        // because it means "append."
        if (value == me.file.size)
          value--;
        if (value != null && value !== cursor) {
          console.log('Moving cursor to ' + value);
          // At this point we need to update the DOM to mark the new cursor
          // location.
          var oldLine = Math.floor(cursor / me.bytesPerLine),
            newLine = Math.floor(value / me.bytesPerLine);
          cursor = value;
          if (oldLine != newLine) {
            me.updateLine(oldLine);
          }
          me.updateLine(newLine);
        }
        return cursor;
      },
      enumerable: true
    });
  })(this);
  // Define the selection start/end property.
  (function(me) {
    var selectionStart = null, selectionEnd = null;
    Object.defineProperty(me, 'selectionStart', {
      get: function() {
        return selectionStart;
      },
      set: function(value) {
        if (value === selectionStart)
          return;
        value = me._clampOffset(value);
        return selectionStart;
      },
      enumerable: true
    });
    Object.defineProperty(me, 'selectionEnd', {
      get: function() {
        return selectionEnd;
      },
      set: function(value) {
        return selectionEnd;
      },
      enumerable: true
    });
  })(this);
  this.cursor = 0;
}

HexedScroller.prototype = Object.create(Scroller.prototype);

// We need to override a few specific items.

HexedScroller.prototype.createLineContent = function(line) {
  // Set the CSS class name
  line.className = 'line';
  // Each line has three parts - the gutter, the hex data about the line, and
  // finally the decoded text about the line.
  var gutter = document.createElement('span');
  var data = document.createElement('span');
  var decoded = document.createElement('span');
  gutter.className = 'gutter';
  gutter.innerHTML = '0';
  data.className = 'data';
  data.innerHTML = '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00';
  decoded.className = 'decoded';
  decoded.innerHTML = '0000000000000000';
  line.appendChild(gutter);
  line.appendChild(data);
  line.appendChild(decoded);
  line._gutter = gutter;
  line._data = data;
  line._decoded = decoded;
  // If we don't have the widths calculated yet, we need to figure out what they
  // should be.
  if (!this._widthsCalculated) {
    this._widthsCalculated = true;
    var temp = document.createElement('div');
    temp.className = 'hex-file';
    temp.style.position = 'absolute';
    document.body.appendChild(temp);
    temp.appendChild(line);
    // Calculate the width of the largest offset.
    gutter.innerHTML = Math.floor(this.file.size / 16).toString(16) + '0';
    this._gutterWidth = window.getComputedStyle(gutter).width;
    this._dataWidth = window.getComputedStyle(data).width;
    console.log('Gutter width (' + gutter.innerHTML + '): ' + this._gutterWidth);
    console.log('Data width: ' + this._dataWidth);
    temp.removeChild(line);
    document.body.removeChild(temp);
  }
  gutter.style.width = this._gutterWidth;
  data.style.width = this._dataWidth;
};

HexedScroller.prototype.setLineContent = function(line, lineNumber) {
  var offset = lineNumber * 16;
  if (offset > this.file.size) {
    // Nothing here.
    line.className = 'line empty';
    line._gutter.innerHTML = '\u00A0';
    line._data.innerHTML = '\u00A0';
    line._decoded.innerHTML = '\u00A0';
    return true;
  } else {
    line._gutter.innerHTML = offset.toString(16).toUpperCase();
    // See if we can grab the line right now.
    var data = this.file.readCached(offset, 16);
    if (data == null) {
      // We have no data, so just show that.
      line.className = 'line loading';
      line._data.innerHTML = '?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ??';
      line._decoded.innerHTML = '????????????????';
      return false;
    } else {
      var cursor = this.cursor;
      line.className = 'line';
      // bytes should be a slice of a buffer
      var hex = new Array(data.length), decoded = new Array(data.length);
      for (var i = 0; i < data.length; i++) {
        // Not clear if byte is signed or not, so make it unsigned
        var byte = data[i] & 0xFF,
          h = byte.toString(16).toUpperCase();
        if (h.length < 2)
          h = "0" + h;
        hex[i] = h;
        decoded[i] = convertByte(byte);
        // Check to see if the cursor is here
        if (offset + i == cursor) {
          hex[i] = '<span class="cursor">' + h + '</span>';
          decoded[i] = '<span class="cursor">' + decoded[i] + '</span>';
        }
      }
      line._data.innerHTML = hex.join(' ');
      line._decoded.innerHTML = decoded.join('');
      return true;
    }
  }
};

HexedScroller.prototype.loadLines = function(firstLine, visibleLines) {
  console.log("Load " + visibleLines + " lines starting at " + firstLine);
  // Trigger a load
  this.file.ensureCached(firstLine * 16, visibleLines * 16, (function(me) {
    return function(err, buffer) {
      if (err) {
        // TODO: Display something.
        console.log(err);
      } else {
        // Don't care about the actual data, we just want to display our
        // currently visible lines.
        me.resetLineContents();
      }
    }
  })(this));
}

HexedScroller.prototype.onkeydown = function(event) {
  switch (event.keyIdentifier) {
  case 'Left':
    this.cursor--;
    break;
  case 'Right':
    this.cursor++;
    break;
  case 'Up':
    this.cursor -= this.bytesPerLine;
    break;
  case 'Down':
    this.cursor += this.bytesPerLine;
    break;
  default:
    return false;
  }
  event.preventDefault();
  return true;
};

// Helper function
HexedScroller.prototype._clampOffset = function(offset) {
  // Ignore NaN or anything that isn't a number.
  if (typeof offset != 'number' || isNaN(offset))
    return null;
  offset = Math.floor(offset);
  if (offset < 0)
    return 0;
  if (offset > this.file.size)
    return offset.file.size;
  return offset;
};

function FilePane(pane, file, workspace) {
  pane.title = file.filename;
  this.workspace = workspace;
  // Generate our UI.
  this._container = document.createElement('div');
  this._container.className = 'hex-file';
  pane.contents.appendChild(this._container);
  pane.on('menu', (function(me) { return function(command) {
    me.doMenuCommand(command);
  }; })(this));
  this._scroller = new HexedScroller(this._container, file);
  this.file = file;
  // Various properties that delegate to the scroller
  (function(me, scroller) {
    Object.defineProperty(me, 'cursor', {
      get: function() { return scroller.cursor; },
      set: function(value) { return scroller.cursor = value; }
    });
    Object.defineProperty(me, 'selectionStart', {
      get: function() { return scroller.selectionStart; },
      set: function(value) { return scroller.selectionStart = value; }
    });
    Object.defineProperty(me, 'selectionEnd', {
      get: function() { return scroller.selectionEnd; },
      set: function(value) { return scroller.selectionEnd = value; }
    });
  })(this, this._scroller);
  // Keyboard support
  this._container.setAttribute('tabindex', '0');
}

FilePane.prototype = {
  doMenuCommand: function(command) {
    switch (command) {
    case 'jump-to':
      // Ask for an address
      this.showJumpTo();
      break;
    // None of the following are implemented yet:
    case 'run-javascript':
      break;
    case 'find':
      break;
    case 'strings':
      this.showStrings();
      break;
    }
  },
  showJumpTo: function() {
    var me = this;
    bootbox.prompt("Jump to address", function(result) {
      // Convert the string to a number using parseInt so that stuff like
      // 0x1F works
      var addr = parseInt(result);
      if (addr >= 0 && addr < me.file.size) {
        // More to trap NaN than anything else
        me._scroller.scrollToLine(Math.floor(addr/16));
      }
    });
  },
  showFind: function() {
    // does nothing (yet)
  },
  showJavaScriptPane: function() {
    // does nothing (yet)
  },
  showStrings: function() {
    if (!this._stringsPane) {
      // Create the strings pane
      var pane = this.workspace.createPane();
      pane.on('closed', (function(me) {
        return function() { me._stringsPane = null; }
      })(this));
      this._stringsPane = new StringsPane(pane, this.file);
    }
    this.workspace.activePane = this._stringsPane;
  },
  /**
   * Closes this UI (removes the HTML from the DOM and closes the underlying
   * file object).
   */
  close: function() {
    this.destroy();
    this.file.close();
  }
};

module.exports = FilePane;
