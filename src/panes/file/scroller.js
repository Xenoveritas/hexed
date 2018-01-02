/**
 * Implementation of the hex file display.
 */
"use strict";

import Scroller from '../../scroller.js';

const USE_OSX_SHORTCUTS = process.platform === 'darwin',
  htmlEscapes = { '<': '&lt;', '>': '&gt;', '&': '&amp;' };

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

/**
 * Find the offset to a given child node in characters.
 */
function _findOffset(node, needle) {
  let result = 0;
  for (let child of node.childNodes) {
    if (child === needle) {
      // Done
      return result;
    }
    if (child.nodeType === 1 /* ELEMENT_NODE */) {
      result += _findOffset(child, needle);
    } else if (child.nodeType === 3 /* TEXT_NODE */) {
      result += child.length;
    }
  }
  // We may never find the node being looked for, but should still return the
  // number of characters passed along the way.
  return result;
}

/**
 * Gets the offset of a range within a given parent node.
 */
function findCharacterOffset(parent, clientX, clientY) {
  let range = document.caretRangeFromPoint(clientX, clientY);
  // Make sure the clicked node belongs to the parent.
  let node = range.startContainer;
  while (node.parentNode !== null) {
    if (node.parentNode === parent) {
      break;
    } else if (node.parentNode === null) {
      return null;
    }
    node = node.parentNode;
  }
  return _findOffset(parent, node) + range.startOffset;
}

export default class HexedScroller extends Scroller {
  constructor(container, file) {
    super(container);
    this.file = file;
    this._widthsCalculated = false;
    // This may eventually become a proper property with write support.
    this.bytesPerLine = 16;
    // Figure out how many lines there are at 16 bytes per line
    this.setTotalLines(Math.ceil(file.size / this.bytesPerLine));
    // Create the cursor property.
    // Cursor starts as null so we can do this.cursor = 0 to initialize it
    this._cursor = null;
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
    // Try and force the line widths if necessary.
    this._calculateWidths();
  }

  get cursor() {
    return this._cursor;
  }
  set cursor(value) {
    value = this._clampOffset(value);
    // Note: at present file.size isn't a valid offset since that's one past
    // the end of the file and we don't do editing. With editing it is
    // because it means "append."
    if (value == this.file.size)
      value--;
    if (value != null && value !== this._cursor) {
      // At this point we need to update the DOM to mark the new cursor
      // location.
      let oldLine = Math.floor(this._cursor / this.bytesPerLine),
        newLine = Math.floor(value / this.bytesPerLine);
      let oldCursor = this._cursor;
      this._cursor = value;
      if (oldLine != newLine) {
        this.updateLine(oldLine);
      }
      this.updateLine(newLine);
      // Make sure that line is visible
      this.scrollLineIntoView(newLine);
      this.emit('cursor-changed', oldCursor, this._cursor);
    }
    return this._cursor;
  }

  // We need to override a few specific items.
  createLineContent(line) {
    // Set the CSS class name
    line.className = 'line';
    if (!this._lineTemplate) {
      this._lineTemplate = document.getElementById('hex-file-line-template');
    }
    line.append(document.importNode(this._lineTemplate.content, true));
    let gutter = line.querySelector('.gutter');
    let data = line.querySelector('.data');
    let decoded = line.querySelector('.decoded');
    line._gutter = gutter;
    line._data = data;
    line._decoded = decoded;
    if (this._widthsCalculated) {
      gutter.style.width = this._gutterWidth;
      data.style.width = this._dataWidth;
    }
    gutter.addEventListener('click', (event) => this._clickLine(event, line));
    data.addEventListener('click', (event) => {
      // Need to figure out where within this data span the click is.
      let offset = findCharacterOffset(data, event.clientX, event.clientY);
      // The +0.5 is to split the difference in the spaces between characters.
      this.cursor = line._offset + Math.floor((offset / 3) + 0.5);
    });
    decoded.addEventListener('click', (event) => {
      let offset = findCharacterOffset(decoded, event.clientX, event.clientY);
      this.cursor = line._offset + offset;
    });
  }

  _calculateWidths() {
    // If we don't have the widths calculated yet, we need to figure out what they
    // should be.
    if (!this._widthsCalculated) {
      this._widthsCalculated = true;
      let temp = document.createElement('hex-file'),
        line = this.createLine();
      temp.style.position = 'absolute';
      document.body.appendChild(temp);
      temp.appendChild(line);
      // Calculate the width of the largest offset.
      line._gutter.innerHTML = Math.floor(this.file.size / 16).toString(16) + '0';
      this._gutterWidth = window.getComputedStyle(line._gutter).width;
      this._dataWidth = window.getComputedStyle(line._data).width;
      temp.removeChild(line);
      document.body.removeChild(temp);
      // And reset any lines that missed this
      this.forEachLine(line => {
        line._gutter.style.width = this._gutterWidth;
        line._data.style.width = this._dataWidth;
      });
    }
  }

  setLineContent(line, lineNumber) {
    let offset = lineNumber * 16;
    line.className = 'line ' + ((lineNumber & 1 === 1) ? 'even' : 'odd');
    line._offset = offset;
    if ((!this.file) || offset > this.file.size) {
      // Nothing here.
      line.className += ' empty';
      line._gutter.innerHTML = '\u00A0';
      line._data.innerHTML = '\u00A0';
      line._decoded.innerHTML = '\u00A0';
      return true;
    } else {
      line._gutter.innerHTML = offset.toString(16).toUpperCase();
      // See if we can grab the line right now.
      let data = this.file.readCached(offset, 16);
      if (data == null) {
        // FIXME: The cursor can be in unloaded data. I really don't like how the
        // cursor is currently implemented.
        // We have no data, so just show that.
        line.className += ' loading';
        line._data.innerHTML = '?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ??';
        line._decoded.innerHTML = '????????????????';
        return false;
      } else {
        let cursor = this.cursor;
        // bytes should be a slice of a buffer
        let hex = new Array(data.length), decoded = new Array(data.length);
        for (let i = 0; i < data.length; i++) {
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
      return this.file.size;
    return offset;
  }

  /**
   * Receive notification that the gutter was clicked on for a given line.
   * Currently this does nothing.
   */
  _clickLine(event, line) {
  }
}
