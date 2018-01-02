/**
 * Find popup.
 */
"use strict";

import { BLOCK_SIZE } from '../../hexfile.js';

export default class FindPopup {
  constructor(filepane) {
    this.filepane = filepane;
    let template = document.getElementById('hex-file-find-template');
    let clone = document.importNode(template.content, true);
    this._popup = clone.querySelector('hexed-popup');
    this._input = clone.querySelector('x-input');
    this._button = clone.querySelector('x-button');
    this._button.addEventListener('click', (event) => {
      this.find();
    });
    this._input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.find();
      }
    });
    this._input.addEventListener('change', (event) => {
      this._needle = null;
    });
    filepane.contents.append(clone);
    this._needle = null;
  }

  find() {
    if (!this._needle) {
      this._needle = Buffer.from(this._input.value);
    }
    this.findNext(this._needle);
  }

  findNext() {
    let startOffset = this.filepane.cursor + 1;
    let previous = 0;
    let searchBuffer = Buffer.alloc(BLOCK_SIZE*2);
    let needle = this._needle;
    if (needle.length > BLOCK_SIZE) {
      // Because of the way we join blocks, this currently doesn't work. Not
      // sure how worth it is to implement searches for larger strings anyway.
      throw new Error(`Searches currently cannot be larger than ${BLOCK_SIZE} bytes.`);
    }
    this.filepane.file.scan((error, buffer, offset) => {
      if (buffer === null) {
        // This indicates that the entire file has been read. Do nothing.
        return;
      }
      let searchIn = buffer, searchOffset = offset;
      if (offset < startOffset) {
        // This currently happens because scan works by blocks, so the first
        // block may start early.
        searchIn = buffer = buffer.slice(startOffset - offset);
        searchOffset = startOffset;
      }
      if (previous > 0) {
        // If there are previous bytes (used to search across bytes) simply
        // copy our bytes to the end of those bytes.
        buffer.copy(searchBuffer, previous);
        // Create a slice to avoid searching garbage data at the end of the
        // search buffer
        searchIn = searchBuffer.slice(0, previous + buffer.length);
        searchOffset -= previous;
      }
      let idx = searchIn.indexOf(needle);
      if (idx >= 0) {
        // Found it.
        this.filepane.cursor = searchOffset + idx;
        return false;
      }
      // Otherwise, copy our buffer to the start of the search buffer and resume
      // next block.
      buffer.copy(searchBuffer);
      previous = buffer.length;
    }, startOffset);
  }
  hide() {
    this._popup.hide();
  }
  show() {
    this._popup.show();
    this._input.focus();
  }
}
