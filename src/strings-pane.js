/**
 * Module for finding strings in a file and showing them in a pane.
 * <p>
 * The goal is to eventually move this into a "plugin" that provides the
 * functionality.
 */

const Scroller = require('./scroller'),
  strings = require('./strings');

/**
 * Scroller for showing the strings.
 */
class StringsScroller extends Scroller {
  constructor(container) {
    super(container);
    this._offsets = [];
    this._strings = [];
    container.style.position = 'absolute';
    this.setTotalLines(0);
  }

  createLineContent(line) {
    line.className = 'line';
    line.innerHTML = '\u00A0';
  }

  setLineContent(line, lineNumber) {
    line.innerText = lineNumber < this._strings.length ?
      '0x' + this._offsets[lineNumber].toString(16).toUpperCase() + ': ' + this._strings[lineNumber] :
      '\u00A0';
    return true;
  }

  _addString(offset, str) {
    this._offsets.push(offset);
    this._strings.push(str);
    this.setTotalLines(this._strings.length);
  }
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
