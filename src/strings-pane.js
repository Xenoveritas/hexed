/**
 * Module for finding strings in a file and showing them in a pane.
 */

var Scroller = require('./scroller');

/**
 * Scroller for showing the strings.
 */
function StringsScroller(container) {
  // Initialize our variables BEFORE calling the super constructor
  this._offsets = [];
  this._strings = [];
  Scroller.call(this, container);
  container.style.position = 'absolute';
  this.setTotalLines(0);
}

StringsScroller.prototype = Object.create(Scroller.prototype);

StringsScroller.prototype.createLineContent = function(line) {
  line.className = 'line';
  line.innerHTML = '\u00A0';
};

StringsScroller.prototype.setLineContent = function(line, lineNumber) {
  line.innerText = lineNumber < this._strings.length ?
    '0x' + this._offsets[lineNumber].toString(16).toUpperCase() + ': ' + this._strings[lineNumber] :
    '\u00A0';
  return true;
};

StringsScroller.prototype._addString = function(offset, str) {
  this._offsets.push(offset);
  this._strings.push(str);
  this.setTotalLines(this._strings.length);
}

function StringsPane(pane, file) {
  pane.title = 'Strings - ' + file.filename;
  this.pane = pane;
  this.file = file;
  var div = document.createElement('div');
  div.className = 'strings';
  this.scroller = new StringsScroller(div);
  pane.contents.appendChild(div);
  this.file.scan((function(strings) {
    var previous = null, start = -1;
    return function(err, buffer, offset) {
      console.log('Scan: ' + buffer.length + ' bytes @' + offset);
      // Find strings within the buffer
      for (var i = 0; i < buffer.length; i++) {
        if (start < 0) {
          // See if we're starting a string
          if (buffer[i] >= 32 && buffer[i] <= 127) {
            start = i;
          }
        } else if (buffer[i] < 32 || buffer[i] > 127) {
          if (i - start >= 4) {
            // Long enough, go ahead and add it
            strings._addString(offset + start, buffer.toString('utf8', start, i));
          }
          start = -1;
        }
      }
    };
  })(this.scroller));
}

StringsPane.prototype = {

};

module.exports = StringsPane;
