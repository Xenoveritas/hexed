/**
 * This module defines a basic "scrollbar" type thing. It's not a "real"
 * scrollbar: it does no scrolling. It simply provides a UI element that looks
 * like a scrollbar.
 *
 * It is up to the container to properly style the scrollbar.
 */
"use strict";

class Scrollbar {
  constructor(container) {
    this._position = 0;
    this._total = 0;
    this._visibleArea = 100;
    this._scrollArea = document.createElement('div');
    this._scrollArea.className = 'scrollbar';
    container.appendChild(this._scrollArea);
    this._scrollBar = document.createElement('div');
    this._scrollBar.className = 'bar';
    this._scrollBar.style.position = 'relative';
    this._scrollArea.appendChild(this._scrollBar);
    this.update();
  }

  get position() {
    return this._position;
  }

  set position(value) {
    this._position = value;
    this.update();
  }

  get total() {
    return this._total;
  }

  set total(value) {
    this._total = value;
    this.update();
  }

  get visibleArea() {
    return this._visibleArea;
  }

  set visibleArea(value) {
    this._visibleArea = value;
    this.update();
  }

  /**
   * Forces the scroll bar to update its visual representation.
   */
  update() {
    if (this._total == 0 || this._total < this._visibleArea) {
      // No scroll bar visible (either no document size or the entire document
      // is visible).
      this._scrollBar.style.display = 'none';
    } else {
      this._scrollBar.style.display = 'block';
      let barHeight = Math.max(10, (this._visibleArea / this._total) * this._scrollArea.offsetHeight);
      this._scrollBar.style.top = (this._position / (this._total - this._visibleArea)) * (this._scrollArea.offsetHeight - barHeight) + 'px';
      this._scrollBar.style.height = barHeight + 'px';
      //console.log("Visible: " + this.visibleArea + "; Total: " + this.total + " visible / total: " + this.visibleArea / this.total + "; height: " + this._scrollArea.offsetHeight);
    }
  }
}

module.exports = Scrollbar;
