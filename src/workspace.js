/**
 * Module for dealing with the generic workspace.
 */

const EventEmitter = require('events'),
  FilePane = require('./file-pane'),
  AboutPane = require('./about-pane'),
  hexfile = require('./hexfile'),
  debuglog = require('./debuglog').debuglog('workspace');

/**
 * The Workspace. The Workspace is divided into two main parts: "sidebars" which
 * can be next to the main content, and the main content in the middle.
 */
class Workspace {
  constructor() {
    this.dom = document.createElement('hexed-workspace');
    this.dom.setAttribute('tabindex', '-1');
    document.body.appendChild(this.dom);
    // TODO: File tree on left
    Object.defineProperty(this, 'contents', {
      value: new WorkspaceContents(this, this.dom),
      enumerable: true
    });
    this._id = 0;
  }

  get activePane() {
    return this.contents.activePane;
  }
  set activePane(activePane) {
    this.contents.activePane = activePane;
  }
  /**
   * Opens a givne file.
   */
  openFile(filename) {
    return hexfile.open(filename).then((file) => {
      return this._createFilePane(file);
    });
  }
  /**
   * Open multiple files at once. Returns an array of Promises generated from
   * calling {@link #openFile} on each file. Promise.all or Promise.race can
   * be used on the return result to wait for them to complete.
   */
  openFiles(filenames) {
    return filenames.map(filename => this.openFile(filename));
  }
  _createFilePane(file) {
    var pane = this.createPane();
    return new FilePane(pane, file, this);
  }
  /**
   * Creates a new Pane within the workspace. Panes are simply areas where HTML
   * content can be shown. Panes are created immediately.
   */
  createPane(activate) {
    if (arguments.length == 0)
      activate = true;
    var pane = new Workspace.Pane(this, this._id++);
    this.contents._addPane(pane);
    if (activate)
      this.contents.activePane = pane;
    return pane;
  }
  showAbout() {
    if (!this._aboutPane) {
      // Create the about pane
      this._aboutPane = this.createPane();
      new AboutPane(this._aboutPane);
      this._aboutPane.on('closed', () => {
        debuglog('About pane closed.');
        this._aboutPane = null;
      });
    }
    this.activePane = this._aboutPane;
  }
  doMenuCommand(command) {
    if (command == 'close-pane') {
      // A special case that gets handled here.
      var pane = this.activePane;
      if (pane) {
        pane.close();
      }
      return;
    } else if (command == 'about') {
      // One other special case: open about pane.
      this.showAbout();
      return;
    }
    // Pass through to the active pane.
    var pane = this.contents.activePane;
    if (pane)
      pane.doMenuCommand(command);
  }
  _updateTitle() {
    var pane = this.activePane;
    if (pane) {
      document.title = pane.title + ' - Hexed';
    } else {
      document.title = 'Hexed';
    }
  }
};

/**
 * A Pane within the workspace.
 */
class Pane extends EventEmitter {
  constructor(workspace, id) {
    super();
    var title = 'New';
    this.contents = document.createElement('div');
    var tab = this.tab = document.createElement('li'), tabTitle, tabButton;
    tab.addEventListener('click', (event) => {
      this.workspace.activePane = this;
      event.preventDefault();
    }, false);
    tab.appendChild(tabTitle = document.createElement('a'));
    tabTitle.setAttribute('href', '#_pane_' + id);
    tabTitle.className = 'title';
    tabTitle.innerText = title;
    tab.appendChild(tabButton = document.createElement('a'));
    tabTitle.setAttribute('href', '#_close_' + id);
    tabButton.innerHTML = '\u2573';
    tabButton.className = 'close';
    tabButton.addEventListener('click', (event) => {
      event.preventDefault();
      this.close();
      return false;
    });
    this.contents.className = 'pane-contents';
    this.contents.setAttribute('id', '_pane_' + id);
    this.tab.setAttribute('id', '_tab_' + id);
    // Create properties
    Object.defineProperty(this, 'workspace', {
      value: workspace,
      enumerable: true
    });
    Object.defineProperty(this, 'active', {
      get: function() {
        return workspace.activePane === this;
      },
      enumerable: true
    });
    Object.defineProperty(this, 'closed', {
      get: function() {
        return workspace.containsPane(this);
      },
      enumerable: true
    });
    Object.defineProperty(this, 'id', {
      value: id,
      enumerable: true
    });
    Object.defineProperty(this, 'title', {
      get: function() { return title; },
      set: function(value) {
        if (typeof value != 'string')
          value = value.toString();
        title = value;
        tabTitle.innerText = title;
        if (workspace.activePane === this) {
          workspace._updateTitle();
        }
        return title;
      },
      enumerable: true
    });
  }

  _deactivate() {
    this.contents.style.display = 'none';
    this.tab.className = 'tab';
    this.emit('blur');
  }

  _activate() {
    this.contents.style.display = 'block';
    this.tab.className = 'tab active';
    this.focus();
    this.emit('focus');
  }

  /**
   * Indicates that the pane should request keyboard focus. The default emits a
   * 'should-focus' event which can be handled as desired.
   */
  focus() {
    this.emit('should-focus');
  }

  doMenuCommand(command) {
    this.emit('menu', command);
  }

  /**
   * Close this pane.
   */
  close() {
    // Just fob this off to the contents
    let canceled = false;
    let event = {
      cancel: function() { canceled = true; }
    };
    this.emit('closing', event);
    if (canceled)
      return false;
    // Otherwise, allow it to go through
    this.workspace.contents._closePane(this);
    this.emit('closed');
  }
}

Workspace.Pane = Pane;

/**
 * The workspace contents manages the actual tabs.
 */
class WorkspaceContents {
  constructor(workspace, container) {
    this.workspace = workspace;
    this.dom = document.createElement('hexed-workspace-axis');
    this.dom.className = 'vertical';
    this.topContainer = document.createElement('hexed-panel-container');
    this.topContainer.className = 'top';
    this.dom.appendChild(this.topContainer);
    this.panesContainer = document.createElement('hexed-panel-container');
    this.panesContainer.className = 'panes';
    this.dom.appendChild(this.panesContainer);
    this.tabDom = document.createElement('ul');
    this.tabDom.className = 'tabs';
    this.panesContainer.appendChild(this.tabDom);
    this.bottomContainer = document.createElement('hexed-panel-container');
    this.bottomContainer.className = 'bottom';
    this.statusBar = new StatusBar(this.bottomContainer);
    this.dom.appendChild(this.bottomContainer);
    container.appendChild(this.dom);
    // As we currently have no real contents, make a place-holder
    this.placeholder = document.createElement('div');
    this.placeholder.className = 'placeholder';
    this.placeholder.innerHTML = 'Use File, Open... to open a file or drag and drop a file onto this window.';
    this.panesContainer.appendChild(this.placeholder);
    this._activePane = null;
    this._panes = [];
  }

  get activePane() {
    return this._activePane;
  }
  set activePane(activePane) {
    if (activePane === this._activePane) {
      // Just make sure it's focused.
      this._activePane.focus();
      return;
    }
    // Make sure that active pane is one of ours
    if (this._panes.some(function(pane) {
      return pane === activePane;
    })) {
      debuglog('activating %s', activePane.id);
      // Deactivate the currently active pane (if there is one)
      if (this._activePane)
        this._activePane._deactivate();
      this._activePane = activePane;
      this._activePane._activate();
      this.workspace._updateTitle();
    }
  }
  containsPane(pane) {
    return this._panes.some(function(p) {
      return p === pane;
    });
  }
  _addPane(pane) {
    // For now, assume the pane isn't being double-added, as this function is
    // conceptually "private".
    this._panes.push(pane);
    // Kill the placeholder if it's visible.
    this.placeholder.style.display = 'none';
    // Add the tab
    this.tabDom.appendChild(pane.tab);
    // And the pane.
    this.panesContainer.appendChild(pane.contents);
  }
  _closePane(pane) {
    // Find the pane
    var i;
    for (i = 0; i < this._panes.length; i++) {
      if (this._panes[i] === pane) {
        // Found it. Remove it from our DOM
        this.tabDom.removeChild(pane.tab);
        this.panesContainer.removeChild(pane.contents);
        // And splice it out of the array
        this._panes.splice(i, 1);
        break;
      }
    }
    if (this._panes.length == 0) {
      // If we've killed all our tabs, restore the placeholder.
      this.placeholder.style.display = 'block';
    } else {
      if (i >= this._panes.length)
        i = this._panes.length - 1;
      // Activate the new tab
      this.activePane = this._panes[i];
    }
  }
  goToPane(index) {
    if (index >= 0 && index < this._panes.length)
      this.activePane = this._panes[index];
  }
  goForwardPanes(count) {
  }
}

class StatusBar {
  constructor(container) {
    this.dom = document.createElement('status-bar');
    container.appendChild(this.dom);
  }
}

exports.Workspace = Workspace;
exports.WorkspaceContents = WorkspaceContents;
exports.StatusBar = StatusBar;
