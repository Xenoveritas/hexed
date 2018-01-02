/**
 * This module defines how to deal with the file pane HTML. It creates a virtual
 * scroll bar (much like Atom does itself) because actually creating HTML for
 * every single line of bytes would - well, not work.
 */

"use strict";

import Pane from '../pane.js';
import hexfile from '../hexfile.js';
import StringsPane from './strings.js';

import HexedScroller from './file/scroller.js';
import FindPopup from './file/find.js';
import JumpToPopup from './file/jump.js';

class FileSidebar {
  constructor(pane) {
    this._littleEndian = true;
    this._size = 10;
    this._signed = false;
    this.pane = pane;
    // Need an ID to link some controls up later.
    let id = `${pane.contents.getAttribute('id')}-sidebar`;
    this.pane.contents.append(this._sidebar = document.createElement('hexed-sidebar'));
    this._sidebar.className = 'hex-file-stats';
    let template = document.getElementById('hex-file-stats-template');
    // Clone the template.
    let clone = document.importNode(template.content, true);
    // Can't insert it quite yet because we have to go through and munge IDs.
    for (let node of clone.querySelectorAll('[id]')) {
      node.setAttribute('id', id + '-' + node.getAttribute('id'));
    }
    for (let node of clone.querySelectorAll('[for]')) {
      node.setAttribute('for', id + '-' + node.getAttribute('for'));
    }
    this._sidebar.append(clone);
    this._position = this._sidebar.querySelector('.position');
    this._value8 = this._sidebar.querySelector('.type-int8');
    this._value16 = this._sidebar.querySelector('.type-int16');
    this._value32 = this._sidebar.querySelector('.type-int32');
    // TODO: Figure out a way to deal with 64-bit values despite an apparent
    // cap of 48 bit math in Node
    // this._value64 = this._sidebar.querySelector('.type-int64');
    // this._valueFloat = this._sidebar.querySelector('.type-float');
    // this._valueFloat = this._sidebar.querySelector('.type-double');
    this._sizeSelector = this._sidebar.querySelector('x-select#' + id + '-size');
    this._sizeSelector.value = this._size.toString();
    this._sizeSelector.addEventListener('change', (event) => {
      this._size = parseInt(this._sizeSelector.value);
      this.update();
    });
    this._littleEndianRadios = this._sidebar.querySelector('x-radios#' + id + '-endian');
    this._littleEndianRadios.value = this._littleEndian ? 'little' : 'big';
    this._littleEndianRadios.addEventListener('toggle', (event) => {
      this._littleEndian = this._littleEndianRadios.value === 'little';
      this.update();
    });
    this._signRadios = this._sidebar.querySelector('x-radios#' + id + '-sign');
    this._signRadios.value = this._signed ? 'signed' : 'unsigned';
    this._signRadios.addEventListener('toggle', (event) => {
      this._signed = this._signRadios.value === 'signed';
      this.update();
    });
    this.update();
  }
  update() {
    let offset = this.pane.cursor;
    this._position.innerText = this._formatValue(offset);
    let data = this.pane.file.readCached(offset, 16);
    if (data === null) {
      this._value8.innerText = '??';
      this._value16.innerText = '??';
      this._value32.innerText = '??';
      // this._value64.innerText = '??';
      this.pane.file.ensureCached(offset, 16, () => this.update());
    } else {
      this._value8.innerText = this._formatBufferValue(data, 1);
      this._value16.innerText = this._formatBufferValue(data, 2);
      this._value32.innerText = this._formatBufferValue(data, 4);
      // this._value64.innerText = this._formatValue(data, 8);
    }
  }
  /**
   * @param {Number} value the value to format
   * @param {Number} bytes the number of bytes being displayed
   */
  _formatValue(value, bytes) {
    let result = value.toString(this._size);
    if (this._size === 8) {
      if (result[0] === '-') {
        result = "-0" + result.substring(1);
      } else {
        result = "0" + result;
      }
    } else if (this._size === 16) {
      if (result[0] === '-') {
        result = "-0x" + result.substring(1).padStart(bytes * 2, '0');
      } else {
        result = "0x" + result.padStart(bytes * 2, '0');
      }
    }
    return result;
  }
  _formatBufferValue(buffer, bytes) {
    if (buffer.length < bytes) {
      return '(past end)';
    }
    return this._formatValue(buffer[`read${this._signed ? '' : 'U'}Int${bytes*8
      }${bytes > 1 ? (this._littleEndian ? 'LE' : 'BE') : ''}`](0), bytes);
  }
}

/**
 * Custom element for the hexed-file element. This isn't used for anything in
 * particular ... yet.
 */
class HexFileElement extends HTMLElement {
  constructor() {
    super();
  }
}
window.customElements.define('hex-file', HexFileElement);

export default class FilePane extends Pane {
  constructor(filename) {
    super();
    if (typeof filename === 'object') {
      let cursor = filename.cursor;
      let scrollY = filename.scrollY;
      this.once('init', () => {
        this._scroller.cursor = cursor;
        this._scroller.scrollTo(scrollY);
      });
      filename = filename.filename;
    }
    this.title = 'Opening...';
    this.filename = filename;
    this._sessionInfo = {
      id: 'hexedfile',
      filename: filename
    };
    this._openPromise = hexfile.open(filename).then((file) => {
      this.file = file;
      this._init();
    }, (error) => {
      this.contents.innerHTML = '<p class="error"></p>';
      this.contents.childNodes[0].append(error);
    });
    this.contents.innerHTML = '<p class="loading">Loading...</p>';
  }

  get cursor() {
    return this._scroller ? this._scroller.cursor : null;
  }

  set cursor(value) {
    if (this._scroller) {
      this._scroller.cursor = value;
    }
  }

  getSessionInfo() {
    if (this._scroller) {
      this._sessionInfo.cursor = this._scroller.cursor;
      this._sessionInfo.scrollY = this._scroller.scrollY;
    }
    return this._sessionInfo;
  }

  _init() {
    this.title = this.file.filename;
    // Generate our UI.
    this._container = document.createElement('hex-file');
    this.contents.innerHTML = '';
    this.contents.appendChild(this._container);
    this._scroller = new HexedScroller(this._container, this.file);
    this._sidebar = new FileSidebar(this);
    this.contents.addEventListener("activated", () => {
      this._scroller.onresize();
      this._scroller.focus();
    });
    this._scroller.on('cursor-changed', (oldPos, newPos) => {
      this._sidebar.update();
    });
    this.on('should-focus', () => this._container.focus());
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
    this.emit('init');
  }

  /**
   * Returns a Promise that resolves when the file is opened and the Pane is
   * ready.
   */
  openFile() {
    return this._openPromise;
  }

  executeMenuCommand(command) {
    switch (command) {
    case 'jump-to':
      // Ask for an address
      this.showJumpTo();
      break;
    // None of the following are implemented yet:
    case 'run-javascript':
      break;
    case 'find':
      this.showFind();
      break;
    case 'strings':
      this.showStrings();
      break;
    }
  }

  /**
   * Asks the scroller to take keyboard focus. If the file isn't loaded yet,
   * this does nothing.
   */
  focus() {
    if (this._scroller) {
      this._scroller.focus();
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
      return true;
    } else {
      return false;
    }
  }

  jumpToRelative(offset) {
    this._scroller.cursor += offset;
  }

  showJumpTo() {
    if (!this.file)
      return;
    if (!this._jumpToPopup) {
      this._jumpToPopup = new JumpToPopup(this);
    }
    this._jumpToPopup.show(this._scroller.cursor);
  }

  showFind() {
    if (!this.file)
      return;
    if (!this._findPopup) {
      this._findPopup = new FindPopup(this);
    }
    this._findPopup.show();
  }

  showStrings() {
    if (!this._stringsPane) {
      // Create the strings pane
      this._stringsPane = new StringsPane(this.file);
      this._stringsPane.on('closed', (event) => { this._stringsPane = null; });
    }
    this.workspace.addPane(this._stringsPane);
  }
}

Pane.paneManager.addPaneFactory("hexedfile", (hexed, info) => {
  return new FilePane(info);
});
