/**
 * This module defines a basic "scrollbar" type thing. It's not a "real"
 * scrollbar: it does no scrolling. It simply provides a UI element that looks
 * like a scrollbar.
 *
 * It is up to the container to properly style the scrollbar.
 */

function Scrollbar(container) {
  this._scrollArea = document.createElement('div');
  this._scrollArea.className = 'scrollbar';
  container.appendChild(this._scrollArea);
  this._scrollBar = document.createElement('div');
  this._scrollBar.className = 'bar';
  this._scrollBar.style.position = 'relative';
  this._scrollArea.appendChild(this._scrollBar);
  this.update();
}

Scrollbar.prototype = {
  position: 0,
  total: 0,
  /**
   * Number of elements currently visible.
   */
  visibleArea: 1,
  getPosition: function() {
    return this.position;
  },
  setPosition: function(position) {
    this.position = position;
    this.update();
  },
  setTotal: function(total) {
    this.total = total;
    this.update();
  },
  setVisibleArea: function(visibleArea) {
    this.visibleArea = visibleArea;
    this.update();
  },
  /**
   * Forces the scroll bar to update its visible position.
   */
  update: function() {
    if (this.total == 0 || this.total < this.visibleArea) {
      // No scroll bar visible (either no document size or the entire document
      // is visible).
      this._scrollBar.style.display = 'none';
    } else {
      this._scrollBar.style.display = 'block';
      var barHeight = Math.max(10, (this.visibleArea / this.total) * this._scrollArea.offsetHeight);
      this._scrollBar.style.top = (this.position / (this.total - this.visibleArea)) * (this._scrollArea.offsetHeight - barHeight) + 'px';
      this._scrollBar.style.height = barHeight + 'px';
      //console.log("Visible: " + this.visibleArea + "; Total: " + this.total + " visible / total: " + this.visibleArea / this.total + "; height: " + this._scrollArea.offsetHeight);
    }
  }
}

module.exports = Scrollbar;
