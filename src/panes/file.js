/**
 * This module defines how to deal with the file pane HTML. It creates a virtual
 * scroll bar (much like Atom does itself) because actually creating HTML for
 * every single line of bytes would - well, not work.
 */

const bootbox = require('bootbox'),
  Scroller = require('../scroller'),
  StringsPane = require('../strings-pane'),
  USE_OSX_SHORTCUTS = process.platform === 'darwin',
  htmlEscapes = { '<': '&lt;', '>': '&gt;', '&': '&amp;' };

import {Pane} from '../workspace.js';
import hexfile from '../hexfile.js';

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

class HexedScroller extends Scroller {
  constructor(container, file) {
    super(container);
    container.style.position = 'absolute';
    this.file = file;
    // This may eventually become a proper property with write support.
    this.bytesPerLine = 16;
    // Figure out how many lines there are at 16 bytes per line
    this.setTotalLines(Math.ceil(file.size / this.bytesPerLine));
    this._widthsCalculated = false;
    // Create the cursor property.
    // Cursor starts as null so we can do this.cursor = 0 to initialize it
    let cursor = null;
    Object.defineProperty(this, 'cursor', {
      get: () => {
        return cursor;
      },
      set: (value) => {
        value = this._clampOffset(value);
        // Note: at present file.size isn't a valid offset since that's one past
        // the end of the file and we don't do editing. With editing it is
        // because it means "append."
        if (value == this.file.size)
          value--;
        if (value != null && value !== cursor) {
          // At this point we need to update the DOM to mark the new cursor
          // location.
          var oldLine = Math.floor(cursor / this.bytesPerLine),
            newLine = Math.floor(value / this.bytesPerLine);
          cursor = value;
          if (oldLine != newLine) {
            this.updateLine(oldLine);
          }
          this.updateLine(newLine);
          // Make sure that line is visible
          this.scrollLineIntoView(newLine);
        }
        return cursor;
      },
      enumerable: true
    });
    // Define the selection start/end property.
    var selectionStart = null, selectionEnd = null;
    Object.defineProperty(this, 'selectionStart', {
      get: () => {
        return selectionStart;
      },
      set: (value) => {
        if (value === selectionStart)
          return;
        value = this._clampOffset(value);
        return selectionStart;
      },
      enumerable: true
    });
    Object.defineProperty(this, 'selectionEnd', {
      get: function() {
        return selectionEnd;
      },
      set: function(value) {
        return selectionEnd;
      },
      enumerable: true
    });
    this.cursor = 0;
  }

  // We need to override a few specific items.
  createLineContent(line) {
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
      temp.removeChild(line);
      document.body.removeChild(temp);
    }
    gutter.style.width = this._gutterWidth;
    data.style.width = this._dataWidth;
  }

  setLineContent(line, lineNumber) {
    let offset = lineNumber * 16;
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
        // FIXME: The cursor can be in unloaded data. I really don't like how the
        // cursor is currently implemented.
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
          if (decoded[i] in htmlEscapes) {
            decoded[i] = htmlEscapes[decoded[i]];
          }
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
  }

  loadLines(firstLine, visibleLines) {
    // Trigger a load
    this.file.ensureCached(firstLine * 16, visibleLines * 16,
      (err, buffer) => {
        if (err) {
          // TODO: Display something.
          console.log(err);
        } else {
          // Don't care about the actual data, we just want to display our
          // currently visible lines.
          this.resetLineContents();
        }
      });
  }

  onkeydown(event) {
    if (event.ctrlKey) {
      switch (event.key) {
      case 'Home':
        // Move to the start of the document (but keep our line position).
        this.cursor = this.cursor % this.bytesPerLine;
        break;
      case 'End':
        // Move to the end of the document
        // TODO: (but keep our line position).
        this.cursor = this.file.size;
        break;
      default:
        return false;
      }
      return true;
    }
    if (event.altKey) {
      return true;
    }
    if (event.metaKey) {
      if (USE_OSX_SHORTCUTS) {
        // In this case, the various arrow keys change meaning.
        switch (event.key) {
        case 'ArrowLeft':
          this.cursor -= this.cursor % this.bytesPerLine;
          break;
        case 'ArrowRight':
          this.cursor = this.cursor + (this.bytesPerLine - (this.cursor % this.bytesPerLine) - 1);
          break;
        case 'ArrowUp':
          this.cursor = 0;
          break;
        case 'ArrowDown':
          // Note: currently this will actually be this.file.size-1, but when
          // editing is supported, this will move it to a byte past the last one
          this.cursor = this.file.size;
          break;
        default:
          return false;
        }
        event.preventDefault();
        return true;
      }
    }
    switch (event.key) {
    case 'ArrowLeft':
      this.cursor--;
      break;
    case 'ArrowRight':
      this.cursor++;
      break;
    case 'ArrowUp':
      this.cursor -= this.bytesPerLine;
      break;
    case 'ArrowDown':
      this.cursor += this.bytesPerLine;
      break;
    case 'PageUp':
      this.cursor -= this.bytesPerLine * this.getLinesPerPage();
      break;
    case 'PageDown':
      this.cursor += this.bytesPerLine * this.getLinesPerPage();
      break;
    case 'Home':
      // Move to the start of the line.
      this.cursor -= this.cursor % this.bytesPerLine;
      break;
    case 'End':
      // Move to the end of the line.
      this.cursor += this.bytesPerLine - (this.cursor % this.bytesPerLine) - 1;
      break;
    default:
      return false;
    }
    event.preventDefault();
    return true;
  }

  // Helper function
  _clampOffset(offset) {
    // Ignore NaN or anything that isn't a number.
    if (typeof offset != 'number' || isNaN(offset))
      return null;
    offset = Math.floor(offset);
    if (offset < 0)
      return 0;
    if (offset > this.file.size)
      return offset.file.size;
    return offset;
  }
}

export class FilePane extends Pane {
  constructor(filename) {
    super();
    this.title = 'Opening...';
    this.filename = filename;
    this._openPromise = hexfile.open(filename).then((file) => {
      this.file = file;
      this._init();
    }, (error) => {
      this.contents.innerHTML = '<p class="error"></p>';
      this.contents.childNodes[0].append(error);
    });
    this.contents.innerHTML = '<p class="loading">Loading...</p>';
  }

  _init() {
    this.title = this.file.filename;
    // Generate our UI.
    this._container = document.createElement('div');
    this._container.className = 'hex-file';
    this.contents.innerHTML = '';
    this.contents.appendChild(this._container);
    this.on('menu', command => this.doMenuCommand(command) );
    this._scroller = new HexedScroller(this._container, this.file);
    this.on('should-focus', () => this._container.focus());
    this.on('focus', () => this._scroller.onresize());
    this.on('closed', () => {
        // Cleanup function
        this._scroller.destroy();
        this.file.close();
      });
    if (this.active) {
      // Focus immediately
      this._container.focus();
    }
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

  /**
   * Returns a Promise that resolves when the file is opened and the Pane is
   * ready.
   */
  openFile() {
    return this._openPromise;
  }

  doMenuCommand(command) {
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
  }

  /**
   * Moves the cursor to the given offset. This is almost identical to just
   * setting the cursor property except it accepts strings.
   */
  jumpTo(offset) {
    if (typeof offset == 'string') {
      // Parse it using parseInt to allow 0x1F and things to work. This means
      // dumb things like 0apple will work, but whatever.
      offset = parseInt(offset);
    }
    if (offset >= 0 && offset <= this.file.size) {
      this._scroller.cursor = offset;
    }
  }

  /**
   * This is likely going to be moved up a level.
   */
  showJumpTo() {
    bootbox.prompt("Jump to address", (result) => this.jumpTo(result));
  }

  showStrings() {
    if (!this._stringsPane) {
      // Create the strings pane
      var pane = this.workspace.createPane();
      pane.on('closed', (function(me) {
        return function() { me._stringsPane = null; }
      })(this));
      this._stringsPane = new StringsPane(pane, this.file);
    }
    this.workspace.activePane = this._stringsPane;
  }
}

module.exports = FilePane;
