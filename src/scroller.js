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
  /**
   * The last "first line" when scrolling. Used to know when we need to reset
   * line content.
   */
  this._lastFirstLine = -1;
  /**
   * Load timeout while scrolling.
   */
  this._loadTimeout = false;
  /**
   * The first line that triggered the previous timeout.
   */
  this._lastLoadFirstLine = -1;
  /**
   * Load timeout function. Simply invokes _load.
   */
  this._loadTimeoutFunction = (function(me) { return function() {
    // Clear the timeout.
    me._loadTimeout = false;
    me.loadLines(me.getFirstLine(), me.getVisibleLines());
  }; })(this);
  this._resizeListener = (function(me) { return function() { me.onresize(); }; })(this);
  window.addEventListener('resize', this._resizeListener, false);
  // Add wheel scroll events
  this._wheelListener = (function(me) {
    return function(event) {
      // We want the wheel delta to deal with smooth scrolling. Note that this
      // is probably Chrome-specific. Who cares.
      me.scrollBy(-event.wheelDeltaY);
      event.preventDefault();
    }
  })(this);
  this.container.addEventListener('mousewheel', this._wheelListener, false);
  // Add key listeners
  this._keyListener = (function(me) { return function(event) {
    if (me.onkeydown(event) === true)
      return;
    switch (event.keyIdentifier) {
      case 'Up':
        if (event.metaKey && process.platform == 'darwin') {
          me.scrollTo(0);
        } else {
          me.scrollByLines(-1);
        }
        break;
      case 'Down':
        if (event.metaKey && process.platform == 'darwin') {
          me.scrollTo(me.documentHeight);
        } else {
          me.scrollByLines(1);
        }
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
  /**
   * Gets the DOM object for a given line, assuming it's currently visible. If
   * it isn't, this returns <code>null</code>.
   */
  getLine: function(lineNumber) {
    var firstLine = this.getFirstLine();
    if (lineNumber < firstLine)
      return null;
    var lastLine = firstLine + this.getVisibleLines();
    if (lineNumber > lastLine)
      return null;
    return this._lines[lineNumber - firstLine];
  },
  /**
   * Update a single line. Basically this is just
   * <code>setLineContent(getLine(lineNumber), lineNumber)</code> with checks to
   * see if the line is visible.
   */
  updateLine: function(lineNumber) {
    var line = this.getLine(lineNumber);
    if (line != null)
      this.setLineContent(line, lineNumber);
  },
  /**
   * Update mutliple lines.
   */
  updateLines: function(start, end) {
    var first = this.getFirstLine(),
      last = first + this.getVisibleLines();
    // Only bother if we have lines that are visible.
    if (end >= first && start <= last) {
      if (start < first)
        start = first;
      if (end > last)
        end = last;
      for (var i = start; i < end; i++) {
        this.setLineContent(this._lines[i - first], i);
      }
    }
  },
  getFirstLine: function() {
    return Math.floor(this._verticalOffset / this.lineHeight);
  },
  getVisibleLines: function() {
    return Math.ceil(this.container.offsetHeight / this.lineHeight) + 1;
  },
  setTotalLines: function(lines) {
    // Changing the total lines might require us to redraw, if the last line is
    // currently visible.
    var needsRedraw = this.getVisibleLines() + this.getFirstLine() <= this.totalLines;
    this.totalLines = lines;
    this.documentHeight = this.lineHeight * this.totalLines;
    if (needsRedraw) {
      this.resetLineContents();
    }
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
    if (typeof y != 'number' || isNaN(y)) {
      // Ignore attempts to scroll to things that aren't numbers.
      return;
    }
    // Clamp y. Note that it's possible for our maximum height to be negative if
    // the document doesn't fit, so limit by the height first...
    var height = this.container.offsetHeight,
      maxHeight = this.documentHeight - height;
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
    var firstLine = this.getFirstLine();
    if (firstLine != this._lastFirstLine) {
      // We've actually moved, so redo the content.
      this._populateLines(firstLine, this.getVisibleLines());
      this._lastFirstLine = firstLine;
    }
    // And inform
    this.onscrolled(y, firstLine, height, firstLine + this.getVisibleLines());
  },
  /**
   * Scroll so that a given line is visible at the top of the page. If the line
   * requested is such that there are not enough lines below it to bring the
   * line to the top of the page, the document will be scrolled such that the
   * last line is visible.
   */
  scrollToLine: function(line) {
    this.scrollTo(this.lineHeight * line);
  },
  scrollLineIntoView: function(line) {
    var y = this.lineHeight * line;
    if (y < this._verticalOffset) {
      // Simple: scroll to this y
      this.scrollTo(y);
    }
    var height = this.container.offsetHeight;
    // Otherwise, potentially scroll such that the line is the last line visible.
    y = y - height + this.lineHeight;
    if (y > this._verticalOffset)
      this.scrollTo(y);
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
   * content. It is expected that the line content may not be ready, in which
   * case, the line should be set to a "loading" state and {@code false} should
   * be returned. Any other value returned is taken to mean the line is ready.
   * <p>
   * Because the user is free to "flick" through the document, loading should
   * not be attempted for any line displayed through this method. After a
   * scroll is requested where not all lines are ready, a timeout will be set.
   * Only after the scroll has "lingered" on a collection of lines will
   */
  setLineContent: function(line, lineNumber) {
    line.innerHTML = 'Line #' + lineNumber;
    return true;
  },
  /**
   * Receive notification that the view has been scrolled by some method. This
   * is invoked internally to let implementations know when the view has
   * scrolled and by default does nothing. It will be called after any calls to
   * generate new line content.
   */
  onscrolled: function(y, firstLine, height, lastLine) {
  },
  /**
   * Allows an underlying scroller to hook into the default keyboard handling
   * the scroller provides. This method should return <code>true</code> if it
   * explicitly handled the event. Otherwise default handling will be provided.
   */
  onkeydown: function(event) {
    return false;
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
    var neededLines = this.getVisibleLines();
    if (this._lines.length < neededLines) {
      // Create the missing lines
      for (var i = neededLines - this._lines.length; i > 0; i--) {
        this._createLine();
      }
    }
    // Regardless, we need to do a layout.
    this._layout(neededLines);
  },
  /**
   * Call a function for each line. The function will be called with the
   * signature function(line, lineNumber).
   */
  forEachLine: function(f) {
    var firstLine = this.getFirstLine(),
      visibleLines = this.getVisibleLines();
    for (var i = 0; i < visibleLines; i++) {
      f(this._lines[i], i + firstLine);
    }
  },
  /**
   * Recalls {@link #setLineContent} on all currently visible lines. If the
   * lines aren't loaded, this will trigger a load just like if the user was
   * scrolling.
   */
  resetLineContents: function() {
    this._populateLines(this.getFirstLine(), this.getVisibleLines());
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
    }
    // Populate lines
    this._populateLines(firstLine, visibleLines);
  },
  /**
   * Populates lines. This deals with checking if the lines are all loaded.
   * Lines will be lazily loaded only after a portion of the document has been
   * visible for at least 0.1 seconds.
   */
  _populateLines: function(firstLine, visibleLines) {
    var allReady = true;
    for (var i = 0; i < visibleLines; i++) {
      if (this.setLineContent(this._lines[i], i + firstLine) === false)
        allReady = false;
    }
    if (!allReady) {
      // Not all the lines are ready.
      if (this._loadTimeout !== false) {
        // We have a timeout. See if we've moved sufficiently from where we were
        // on that timeout that we should reset the timeout so we're not loading
        // lines that the user has quickly skipped past.
        if (Math.abs(this._lastLoadFirstLine - firstLine) < (visibleLines / 2)) {
          // We haven't moved enough, so just stop.
          return;
        }
        // Clear the current timeout.
        clearTimeout(this._loadTimeout);
      }
      // And now set a new timeout (if we've fallen through).
      this._loadTimeout = setTimeout(this._loadTimeoutFunction, 100);
      this._lastLoadFirstLine = firstLine;
    }
  },
  /**
   * Loads lines. The default implementation does nothing. This is called if
   * setLineContent returns false.
   */
  loadLines: function(firstLine, visibleLines) {
  }
};

module.exports = Scroller;
