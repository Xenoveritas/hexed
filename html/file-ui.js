/**
 * This module defines how to deal with the file pane HTML. It creates a virtual
 * scroll bar (much like Atom does itself) because actually creating HTML for
 * every single line of bytes would - well, not work.
 */

var bootbox = require('bootbox'),
  Scroller = require('./scroller');

function convertByte(byte) {
  if (byte < 32) {
    return String.fromCharCode(0x2400 + byte);
  } else if (byte < 128) {
    return String.fromCharCode(byte);
  } else {
    return '.';
  }
}

function HexedScroller(container, file) {
  Scroller.call(this, container);
  container.style.position = 'absolute';
  this.file = file;
  // Figure out how many lines there are at 16 bytes per line
  this.setTotalLines(Math.ceil(file.size / 16));
  this._widthsCalculated = false;
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
      }
      line._data.innerText = hex.join(' ');
      line._decoded.innerText = decoded.join('');
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
        console.log("Line loaded, triggering content reset");
        // Don't care about the actual data, we just want to display our
        // currently visible lines.
        me.resetLineContents();
      }
    }
  })(this));
}

function FileUI(id, file, workspace, container) {
  this.workspace = workspace;
  // Generate our UI.
  this._container = document.createElement('div');
  this._container.className = 'hex-file';
  this._container.setAttribute('id', id);
  container.appendChild(this._container);
  this._scroller = new HexedScroller(this._container, file);
  this.file = file;
}

FileUI.prototype = {
  hideLoadingStatus: function() {
    //this._loadingIndicator.style.display = 'none';
  },
  setLoadingStatus: function(filename, percent) {
    //this._loadingIndicator.innerText = 'Loading ' + filename + '... (' + percent + '%)';
  },
  showJumpTo: function() {
    var me = this;
    bootbox.prompt("Jump to address", function(result) {
      // Convert the string to a number using parseInt so that stuff like
      // 0x1F works
      var addr = parseInt(result);
      if (addr >= 0 && addr < me.file.size) {
        // More to trap NaN than anything else
        me._moveTo(Math.floor(addr/16));
      }
    });
  },
  showFind: function() {
    // does nothing (yet)
  },
  showJavaScriptPane: function() {
    // does nothing (yet)
  },
  /**
   * Closes this UI (removes the HTML from the DOM and closes the underlying
   * file object).
   */
  close: function() {
    this._container.parentNode.removeChild(this._container);
    this.file.close();
  }
};

module.exports = FileUI;
