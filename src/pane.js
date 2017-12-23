import EventEmitter from 'events';

/**
 * A Pane within the workspace. A Pane is a simple wrapper around a <hex-pane>
 * element.
 */
export class Pane extends EventEmitter {
  constructor() {
    super();
    this._contents = document.createElement('hexed-pane');
    this._contents.pane = this;
  }

  get contents() {
    return this._contents;
  }

  get title() {
    return this._contents.tabTitle;
  }

  set title(value) {
    this._contents.tabTitle = value;
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

module.exports = Pane;
