/**
 * @module
 * System for dealing with a view that reuses DOM elements to scroll content.
 */
"use strict";

// Internal flag indicating if we should use OS X keyboard shortcuts
// (specifically Command-Up and Command-Down for Home and End).
const USE_OSX_SHORTCUTS = process.platform === 'darwin';
const Scrollbar = require('./scrollbar');

/**
 * A Scroller that scrolls contents in the given DOM element. The default
 * implementation isn't that useful, you should override the
 * {@link #createLineContent} and {@link #setLineContent} methods to generate
 * useful content.
 */
class Scroller {
  /**
   * Create a new Scroller within the given container.
   */
  constructor(container) {
    /**
     * The containing element as defined on creation.
     */
    this.container = container;
    // Set up some CSS
    this.container.className += ' scroller';
    this.container.style.position = 'relative';
    this.container.style.overflowY = 'visible';
    this.container.setAttribute('tabindex', '0');
    // Add a container to hold the various lines.
    this._lineContainer = document.createElement('div');
    this.container.appendChild(this._lineContainer);
    this._scrollBar = new Scrollbar(this.container);

    /**
     * The height of a single line. All lines must be the same height. By default
     * the height of a line is calculated at creation.
     */
    this.lineHeight = 0;
    /**
     * The total number of lines in the document. Set using {@link #setTotalLines}.
     * The default is 1000.
     */
    this.totalLines = 1000;
    /**
     * The total height of the document.
     */
    this.documentHeight = 0;
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
     * The last time a load was attempted, used to prevent multiple calls to reset
     * line contents from spamming the load.
     */
    this._lastLoadTime = new Date().getTime() - 1000;
    /**
     * Load timeout function. Simply invokes _load.
     */
    this._loadTimeoutFunction = () => {
      // Clear the timeout.
      this._loadTimeout = false;
      this.loadLines(this.getFirstLine(), this.getVisibleLines());
    };
    this._resizeListener = () => this.onresize();
    window.addEventListener('resize', this._resizeListener, false);
    // Add wheel scroll events
    this._wheelListener = (event) => {
      // We want the wheel delta to deal with smooth scrolling. Note that this
      // is probably Chrome-specific. Who cares.
      this.scrollBy(-event.wheelDeltaY);
      event.preventDefault();
    };
    this.container.addEventListener('mousewheel', this._wheelListener, false);
    // Add key listeners
    this._keyListener = (event) => {
      if (this.onkeydown(event) === true)
        return;
      // We only care about keyboard keys when modifier aren't down ... mostly.
      if (event.altKey || event.ctrlKey || event.shiftKey)
        return;
      if (event.metaKey) {
        if (USE_OSX_SHORTCUTS) {
          // We have two meta key combinations we allow in this case:
          if (event.key == 'ArrowUp') {
            this.scrollTo(0);
            event.preventDefault();
          } else if (event.key == 'ArrowDown') {
            this.scrollTo(this.documentHeight);
            event.preventDefault();
          }
        }
        return;
      }
      console.log(event);
      switch (event.key) {
        case 'ArrowUp':
          if (event.metaKey && USE_OSX_SHORTCUTS) {
            this.scrollTo(0);
          } else {
            this.scrollByLines(-1);
          }
          break;
        case 'ArrowDown':
          if (event.metaKey && USE_OSX_SHORTCUTS) {
            this.scrollTo(this.documentHeight);
          } else {
            this.scrollByLines(1);
          }
          break;
        case 'PageUp':
          this.scrollByPages(-1);
          break;
        case 'PageDown':
          this.scrollByPages(1);
          break;
        case 'Home':
          this.scrollTo(0);
          break;
        case 'End':
          this.scrollTo(this.documentHeight);
          break;
        default:
          // Just return and let the default do whatever
          return;
      }
      event.preventDefault();
    };
    this.container.addEventListener('keydown', this._keyListener, false);
    // We still need to generate lines for the available space, but we need to
    // defer that until the document is ready and actually laid out if it
    // currently isn't.
    if (container.offsetHeight == 0) {
      let handler = ((attempts) => {
        var attempts = 0, handler = () => {
          if (container.offsetHeight === 0) {
            // Still not ready, wait another 100ms.
            attempts++;
            if (attempts > 10) {
              console.log("More than 10 attempts, giving up.");
            } else {
              setTimeout(handler, 100);
            }
          } else {
            // Ready, generate lines
            this.onresize();
          }
        }
        return handler;
      })(0);
      // Basically we want to defer this to "immediately".
      setTimeout(handler, 10);
    } else {
      // Otherwise generate lines immediately.
      this.onresize();
    }
  }

  /**
   * Gets the DOM object for a given line, assuming it's currently visible. If
   * it isn't, this returns <code>null</code>.
   */
  getLine(lineNumber) {
    var firstLine = this.getFirstLine();
    if (lineNumber < firstLine)
      return null;
    var lastLine = firstLine + this.getVisibleLines();
    if (lineNumber > lastLine)
      return null;
    return this._lines[lineNumber - firstLine];
  }

  /**
   * Update a single line. Basically this is just
   * <code>setLineContent(getLine(lineNumber), lineNumber)</code> with checks to
   * see if the line is visible.
   */
  updateLine(lineNumber) {
    var line = this.getLine(lineNumber);
    if (line != null)
      this.setLineContent(line, lineNumber);
  }

  /**
   * Update mutliple lines.
   */
  updateLines(start, end) {
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
  }
  getFirstLine() {
    return Math.floor(this._verticalOffset / this.lineHeight);
  }
  getVisibleLines() {
    return Math.ceil(this.container.offsetHeight / this.lineHeight) + 1;
  }
  setTotalLines(lines) {
    // Changing the total lines might require us to redraw, if the last line is
    // currently visible.
    var needsRedraw = this.getVisibleLines() + this.getFirstLine() <= this.totalLines;
    this.totalLines = lines;
    this.documentHeight = this.lineHeight * this.totalLines;
    if (needsRedraw) {
      this.resetLineContents();
    }
  }
  /**
   * Remove all event listeners and destroy all current DOM elements.
   */
  destroy() {
    window.removeEventListener('resize', this._resizeListener, false);
    this.container.removeEventListener('mousewheel', this._wheelListener, false);
    this.container.removeEventListener('keydown', this._keyListener, false);
    this._lines.forEach(l => l.parentNode.removeChild(l));
  }
  /**
   * Scroll by a given delta. Positive values scroll down, negative values
   * scroll up.
   */
  scrollBy(delta) {
    if (delta == 0) {
      return;
    }
    this.scrollTo(this._verticalOffset + delta);
  }
  scrollByLines(delta) {
    this.scrollBy(this.lineHeight * delta);
  }
  scrollByPages(delta) {
    // A page is simply the height - one line.
    var page = this.container.offsetHeight - this.lineHeight;
    if (page < this.lineHeight)
      page = this.lineHeight;
    this.scrollBy(page * delta);
  }
  getLinesPerPage() {
    return Math.max(1, Math.floor(this.container.offsetHeight / this.lineHeight) - 1);
  }
  /**
   * Scroll directly a specific virtual y. The y will be clamped to the size of
   * the virtual document.
   */
  scrollTo(y) {
    if (typeof y != 'number' || isNaN(y)) {
      // Ignore attempts to scroll to things that aren't numbers.
      return;
    }
    // Clamp y. Note that it's possible for our maximum height to be negative if
    // the document doesn't fit, so limit by the height first...
    let height = this.container.offsetHeight,
      maxHeight = this.documentHeight - height;
    if (y > maxHeight)
      y = maxHeight;
    // And then limit to 0.
    if (y < 0)
      y = 0;
    this._verticalOffset = y;
    // Now that we know where we are, figure out what we need to do.
    let offset = this._verticalOffset % this.lineHeight;
    this._lineContainer.style.WebkitTransform = 'translateY(' + (-offset) + 'px)';
    // TODO: We may be able to reuse lines more effectively but I'm lazy so just
    // redo all the content.
    let firstLine = this.getFirstLine();
    if (firstLine != this._lastFirstLine) {
      // We've actually moved, so redo the content.
      this._populateLines(firstLine, this.getVisibleLines(), false);
      this._lastFirstLine = firstLine;
    }
    this._scrollBar.position = y;
    // And inform
    this.onscrolled(y, firstLine, height, firstLine + this.getVisibleLines());
  }
  /**
   * Scroll so that a given line is visible at the top of the page. If the line
   * requested is such that there are not enough lines below it to bring the
   * line to the top of the page, the document will be scrolled such that the
   * last line is visible.
   */
  scrollToLine(line) {
    this.scrollTo(this.lineHeight * line);
  }
  scrollLineIntoView(line) {
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
  }
  /**
   * Internal method that creates a line and inserts it into the DOM.
   */
  _createLine() {
    let line = this.createLine();
    line.style.position = 'absolute';
    this._lines.push(line);
    this._lineContainer.appendChild(line);
  }
  /**
   * Generate a new DOM object for a line. The default method creates a &lt;div&gt;
   * and calls {@link #createLineContent}.
   */
  createLine() {
    var line = document.createElement('div');
    this.createLineContent(line);
    return line;
  }
  /**
   * Generates content for a new line. The default method simply inserts a
   * single non-breaking space to ensure that the created line will have a
   * height.
   */
  createLineContent(line) {
    line.innerHTML = '\u00A0';
  }
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
  setLineContent(line, lineNumber) {
    line.innerHTML = 'Line #' + lineNumber;
    return true;
  }
  /**
   * Receive notification that the view has been scrolled by some method. This
   * is invoked internally to let implementations know when the view has
   * scrolled and by default does nothing. It will be called after any calls to
   * generate new line content.
   */
  onscrolled(y, firstLine, height, lastLine) {
  }
  /**
   * Allows an underlying scroller to hook into the default keyboard handling
   * the scroller provides. This method should return <code>true</code> if it
   * explicitly handled the event. Otherwise default handling will be provided.
   */
  onkeydown(event) {
    return false;
  }
  /**
   * Receive notification that the container has resized, which means that some
   * previously visible lines may no longer be visible or that new lines may
   * need to be created.
   */
  onresize() {
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
    let neededLines = this.getVisibleLines();
    if (this._lines.length < neededLines) {
      // Create the missing lines
      for (let i = neededLines - this._lines.length; i > 0; i--) {
        this._createLine();
      }
    }
    // Regardless, we need to do a layout.
    this._layout(neededLines);
  }
  /**
   * Call a function for each line. The function will be called with the
   * signature function(line, lineNumber).
   */
  forEachLine(f) {
    var firstLine = this.getFirstLine(),
      visibleLines = this.getVisibleLines();
    for (var i = 0; i < visibleLines; i++) {
      f(this._lines[i], i + firstLine);
    }
  }
  /**
   * Re-calls {@link #setLineContent} on all currently visible lines.
   * <p>
   * If the lines aren't loaded yet, this can either do the brief delay for
   * lines to load (as if scrolling) or it can be told to immediately trigger a
   * load.
   */
  resetLineContents(loadImmediately) {
    this._populateLines(this.getFirstLine(), this.getVisibleLines(), loadImmediately);
  }
  /**
   * Lays out current lines.
   */
  _layout(visibleLines) {
    // First figure out what our virtual first line is
    var firstLine = Math.floor(this._verticalOffset / this.lineHeight);
    // Now layout out each line.
    for (let i = 0; i < visibleLines; i++) {
      let l = this._lines[i];
      l.style.top = (i * this.lineHeight) + 'px';
    }
    // Populate lines, loading immediately rather than delaying for scrolling.
    // Resizes won't "skip past" lines so it's OK to start loading as soon as
    // new content is visible rather than waiting to see if the user skips past
    // it.
    this._populateLines(firstLine, visibleLines, true);
    // Also update our scrollbar.
    this._scrollBar.visibleArea = this.container.offsetHeight;
    this._scrollBar.total = this.lineHeight * this.totalLines;
  }
  /**
   * Populates lines. This deals with checking if the lines are all loaded.
   * Lines will be lazily loaded only after a portion of the document has been
   * visible for at least 0.1 seconds.
   */
  _populateLines(firstLine, visibleLines, loadImmediately) {
    var allReady = true;
    for (var i = 0; i < visibleLines; i++) {
      if (this.setLineContent(this._lines[i], i + firstLine) === false)
        allReady = false;
    }
    if (!allReady) {
      if (loadImmediately) {
        var now = new Date().getTime();
        if (now - this._lastLoadTime >= 100) {
          this._lastLoadTime = now;
          // OK, go ahead with the immediate load
          if (this._loadTimeout !== false) {
            // This is possible if something triggers a forced load after we
            // set a timeout, so clear it in this instance.
            clearTimeout(this._loadTimeout);
            this._loadTimeout = false;
          }
          this.loadLines(firstLine, visibleLines);
          return;
        }
      }
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
  }
  /**
   * Loads lines. The default implementation does nothing. This is called if
   * setLineContent returns false.
   */
  loadLines(firstLine, visibleLines) {
  }
};

/**
* The absolute minimum line height we allow.
*/
Scroller.MINIMUM_LINE_HEIGHT = 8;

module.exports = Scroller;
