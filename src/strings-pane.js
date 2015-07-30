/**
 * Module for finding strings in a file and showing them in a pane.
 * <p>
 * The goal is to eventually move this into a "plugin" that provides the
 * functionality.
 */

var Scroller = require('./scroller'),
  strings = require('./strings');

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
  if (pane.active)
    div.focus();
  pane.on('should-focus', (function(element) {
    return function() { element.focus(); };
  })(div));
  strings.scan(file, (function(scroller) {
    return function(err, str, offset, encoding) {
      scroller._addString(offset, str);
    };
  })(this.scroller));
}

StringsPane.prototype = {

};

module.exports = StringsPane;
