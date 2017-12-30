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
   * Get the session URI for this pane. Used to know how to restore the pane
   * on reopening (or reloading) the window. The default returns null, which
   * prevents this pane from being restored. Generally each pane should have a
   * "protocol" (text before a colon) and then a pane-specific part.
   *
   * Note that there is no defined mechanism for these URIs. They may be "real"
   * URLs or they may be abstract URNs. They simply indicate how to look up a
   * specific Pane in the PaneManager.
   */
  getSessionURI() {
    return null;
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
