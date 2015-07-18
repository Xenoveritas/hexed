/**
 * @module
 * System for dealing with a view that reuses DOM elements to scroll content.
 */

/**
 * @constructor
 * Create a new Scroller that scrolls contents in the given DOM element. The
 * default implementation isn't that useful, you should override the
 * {@link #createLineContent} and {@link #setLineContent} methods to generate
 * useful content.
 */
function Scroller(container) {
  /**
   * The containing element as defined on creation.
   */
  this.container = container;
  // Set up some CSS
  this.container.style.position = 'relative';
  this.container.style.overflowY = 'visible';
  this.container.setAttribute('tabindex', '0');
  /**
   * Our internal buffer of lines. I'm not sure if this should be an array or
   * just a linked list with extra lines dumped off the end.
   */
  this._lines = [];
  /**
   * Line elements get reused.
   */
  this._lineOffset = 0;
  /**
   * Current vertical scrolling offset.
   */
  this._verticalOffset = 0;
  this._resizeListener = (function(me) { return function() { me.onresize(); }; })(this);
  window.addEventListener('resize', this._resizeListener, false);
  // Add wheel scroll events
  this._wheelListener = (function(me) {
    return function(event) {
      // We want the wheel delta to deal with smooth scrolling. Note that this
      // is probably Chrome-specific. Who cares.
      me.scrollBy(event.wheelDeltaY);
      event.preventDefault();
    }
  })(this);
  this.container.addEventListener('mousewheel', this._wheelListener, false);
  // Add key listeners
  this._keyListener = (function(me) { return function(event) {
    switch (event.keyIdentifier) {
      case 'Up':
        me.scrollByLines(-1);
        break;
      case 'Down':
        me.scrollByLines(1);
        break;
      case 'PageUp':
        me.scrollByPages(-1);
        break;
      case 'PageDown':
        me.scrollByPages(1);
        break;
      case 'Home':
        me.scrollTo(0);
        break;
      case 'End':
        me.scrollTo(me.documentHeight);
        break;
      default:
        //console.log(event.keyIdentifier);
        // Just return and let the default do whatever
        return;
    }
    event.preventDefault();
  }; })(this);
  this.container.addEventListener('keydown', this._keyListener, false);
  // We still need to generate lines for the available space, but we need to
  // defer that until the document is ready and actually laid out if it
  // currently isn't.
  if (container.offsetHeight == 0) {
    var handler = (function(me) {
      var attempts = 0, handler = function() {
        if (container.offsetHeight == 0) {
          // Still not ready, wait another 100ms.
          attempts++;
          if (attempts > 10) {
            console.log("More than 10 attempts, giving up.");
          } else {
            setTimeout(handler, 100);
          }
        } else {
          // Ready, generate lines
          me.onresize();
        }
      }
      return handler;
    })(this);
    // Basically we want to defer this to "immediately".
    setTimeout(handler, 10);
  } else {
    // Otherwise generate lines immediately.
    this.onresize();
  }
}

/**
 * The absolute minimum line height we allow.
 */
Scroller.MINIMUM_LINE_HEIGHT = 8;

Scroller.prototype = {
  /**
   * The height of a single line. All lines must be the same height. By default
   * the height of a line is calculated at creation.
   */
  lineHeight: 0,
  /**
   * The total number of lines in the document. Set using {@link #setTotalLines}.
   * The default is 1000.
   */
  totalLines: 1000,
  /**
   * The total height of the document.
   */
  documentHeight: 0,
  _lastFirstLine: -1,
  setTotalLines: function(lines) {
    this.totalLines = lines;
    this.documentHeight = this.lineHeight * this.totalLines;
  },
  /**
   * Remove all event listeners and destroy all current DOM elements.
   */
  destroy: function() {
    window.removeEventListener('resize', this._resizeListener, false);
    this.container.removeEventListener('mousewheel', this._wheelListener, false);
    this.container.removeEventListener('keydown', this._keyListener, false);
    this._lines.forEach(function(l) {
      l.parentNode.removeChild(l);
    });
  },
  /**
   * Scroll by a given delta. Positive values scroll down, negative values
   * scroll up.
   */
  scrollBy: function(delta) {
    if (delta == 0) {
      return;
    }
    this.scrollTo(this._verticalOffset + delta);
  },
  scrollByLines: function(delta) {
    this.scrollBy(this.lineHeight * delta);
  },
  scrollByPages: function(delta) {
    // A page is simply the height - one line.
    var page = this.container.offsetHeight - this.lineHeight;
    if (page < this.lineHeight)
      page = this.lineHeight;
    this.scrollBy(page * delta);
  },
  /**
   * Scroll directly a specific virtual y. The y will be clamped to the size of
   * the virtual document.
   */
  scrollTo: function(y) {
    // Clamp y. Note that it's possible for our maximum height to be negative if
    // the document doesn't fit, so limit by the height first...
    var maxHeight = this.documentHeight - this.container.offsetHeight;
    if (y > maxHeight)
      y = maxHeight;
    // And then limit to 0.
    if (y < 0)
      y = 0;
    this._verticalOffset = y;
    // Now that we know where we are, figure out what we need to do.
    var offset = this._verticalOffset % this.lineHeight;
    this.container.style.WebkitTransform = 'translateY(' + (-offset) + 'px)';
    // TODO: We may be able to reuse lines more effectively but I'm lazy so just
    // redo all the content.
    var firstLine = Math.floor(this._verticalOffset / this.lineHeight);
    if (firstLine != this._lastFirstLine) {
      var lines = this._lines.length;
      for (var i = 0; i < lines; i++) {
        this.setLineContent(this._lines[i], i + firstLine);
      }
      this._lastFirstLine = firstLine;
    }
  },
  /**
   * Internal method that creates a line and inserts it into the DOM.
   */
  _createLine: function() {
    var line = this.createLine();
    line.style.position = 'absolute';
    this._lines.push(line);
    this.container.appendChild(line);
  },
  /**
   * Generate a new DOM object for a line. The default method creates a &lt;div&gt;
   * and calls {@link #createLineContent}.
   */
  createLine: function() {
    var line = document.createElement('div');
    this.createLineContent(line);
    return line;
  },
  /**
   * Generates content for a new line. The default method simply inserts a
   * single non-breaking space to ensure that the created line will have a
   * height.
   */
  createLineContent: function(line) {
    line.innerHTML = '\u00A0';
  },
  /**
   * Sets a lines content. By default this simply sets the line's content to be
   * "Line #" + lineNumber. This should be overwritten to properly fill a line's
   * content.
   */
  setLineContent: function(line, lineNumber) {
    line.innerHTML = 'Line #' + lineNumber;
  },
  /**
   * Receive notification that the container has resized, which means that some
   * previously visible lines may no longer be visible or that new lines may
   * need to be created.
   */
  onresize: function() {
    // See what our current size is
    var w = this.container.offsetWidth, h = this.container.offsetHeight;
    if (w <= 0 || h <= 0) {
      // If we aren't visible there's nothing to do so don't do anything.
      return;
    }
    if (this.lineHeight < Scroller.MINIMUM_LINE_HEIGHT) {
      // See if we have a line to measure.
      if (this._lines.length == 0) {
        // If we don't, we need to create one.
        this._createLine();
      }
      this.lineHeight = Math.max(Scroller.MINIMUM_LINE_HEIGHT, this._lines[0].offsetHeight);
      this.documentHeight = this.lineHeight * this.totalLines;
    }
    // See if we need to generate lines.
    var neededLines = Math.ceil(h / this.lineHeight);
    if (this._lines.length < neededLines) {
      console.log("Require " + neededLines + ", have " + this._lines.length);
      // Create the missing lines
      for (var i = neededLines - this._lines.length; i > 0; i--) {
        this._createLine();
      }
    }
    // Regardless, we need to do a layout.
    this._layout(neededLines);
  },
  /**
   * Lays out current lines.
   */
  _layout: function(visibleLines) {
    // First figure out what our virtual first line is
    var firstLine = Math.floor(this._verticalOffset / this.lineHeight);
    // Now layout out each line.
    for (var i = 0; i < visibleLines; i++) {
      var l = this._lines[i];
      l.style.top = (i * this.lineHeight) + 'px';
      this.setLineContent(l, i + firstLine);
    }
  }
};

module.exports = Scroller;
