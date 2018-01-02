import EventEmitter from 'events';

import * as paneManager from './pane-manager.js';

/**
 * A Pane within the workspace. A Pane is a simple wrapper around a <hex-pane>
 * element.
 */
export default class Pane extends EventEmitter {
  constructor() {
    super();
    this._contents = document.createElement('hexed-pane');
    this._contents.pane = this;
  }

  /**
   * The contents (a {@code <hexed-pane>}) of this pane.
   */
  get contents() {
    return this._contents;
  }

  /**
   * The title.
   */
  get title() {
    return this._contents.tabTitle;
  }

  set title(value) {
    this._contents.tabTitle = value;
  }

  /**
   * Get a SessionInfo for this pane. This information should provide enough
   * information to restore the pane.
   *
   * The return value may either be a simple string (in which case it's the ID
   * of the pane, which can be used to create a new instance of it), or an
   * actual Object, which will be saved as JSON and MUST contain an "id" that
   * indicates the Pane to restore.
   *
   * The same object may be returned on each call.
   *
   * The default inplementation returns the class name as determined by
   * <code>Object.getPrototypeOf(this).constructor.name</code>.
   */
  getSessionInfo() {
    return Object.getPrototypeOf(this).constructor.name;
  }

  /**
   * Determines if this pane can accept the given menu command. The default
   * always returns false.
   */
  isMenuCommandEnabled(command) {
    return false;
  }

  /**
   * Execute a give menu command. The default implementation does nothing.
   */
  executeMenuCommand(command) {
  }
}

Pane.paneManager = paneManager;

class HexedPaneElement extends HTMLElement {
  static get observedAttributes() {
    return ['tab-title', 'active'];
  }

  constructor() {
    super();
  }

  get tabTitle() {
    return this.getAttribute("tab-title");
  }

  set tabTitle(value) {
    this.setAttribute("tab-title", value);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'tab-title':
        let workspace = this.closest('hexed-workspace');
        if (workspace) {
          workspace._tabTitleChanged(this);
        }
        break;
      case 'active':
        break;
    }
  }
}
window.customElements.define('hexed-pane', HexedPaneElement);

class HexedSidebarElement extends HTMLElement {
  constructor() {
    super();
  }
}
window.customElements.define('hexed-sidebar', HexedSidebarElement);

/**
 * Small popup.
 */
class HexedPopupElement extends HTMLElement {
  constructor() {
    super();
  }
  hide() {
    this.style.display = 'none';
  }
  show() {
    this.style.display = 'flex';
  }
}

window.customElements.define('hexed-popup', HexedPopupElement);
