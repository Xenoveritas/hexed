/**
 * Module for finding strings in a file and showing them in a pane.
 * <p>
 * The goal is to eventually move this into a "plugin" that provides the
 * functionality.
 */
"use strict";

import Scroller from "../scroller.js";
import strings from "../strings.js";
import Pane from "../pane.js";

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

export class StringsPane extends Pane {
  constructor(file) {
    super();
    this.title = 'Strings - ' + file.filename;
    this.scroller = new StringsScroller(this.contents);
    strings.scan(file, (err, str, offset, encoding) => {
      this.scroller._addString(offset, str);
    });
  }
}

module.exports = StringsPane;
