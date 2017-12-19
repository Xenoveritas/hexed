/**
 * Module for dealing with the generic workspace.
 */

import EventEmitter from 'events';

const debuglog = require('./debuglog').debuglog('workspace');

/**
 * A Pane within the workspace. A Pane is a simple wrapper around a <hex-pane>
 * element.
 */
export class Pane extends EventEmitter {
  constructor() {
    super();
    this._contents = document.createElement('hexed-pane');
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
}

let hexedAutoId = 0;
function generateNextID() {
  return hexedAutoId++;
}

/**
 * Custom element for containing the workspace. The workspace is simply an
 * object that deals with having multiple internal elements inside of it.
 */
class HexedWorkspace extends HTMLElement {
  static get observedAttributes() {
    return ['placeholder', 'doctabs'];
  }

  constructor() {
    super();
    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._placeholder = document.createElement('div');
    this._placeholder.setAttribute('style', 'font-size: 200%; padding: 1em; box-sizing: border-box; width: 100%; height: 100%; color: var(--placeholder-color, #808080);');
    this._shadowRoot.append(this._placeholder);
    this._shadowRoot.append(document.createElement('slot'));
    this._observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        if (mutation.type === 'childList') {
          // A child was added. Add tabs for all the children.
          console.log(mutation);
          for (let added of mutation.addedNodes) {
            this._addTab(added);
          }
          if (mutation.addedNodes.length > 0) {
            this.activePane = mutation.addedNodes[mutation.addedNodes.length-1];
          }
          for (let removed of mutation.removedNodes) {
            this._removeTab(removed);
          }
        }
      }
    });
    this._observer.observe(this, { childList: true });
    this._tabs = new Map();
  }

  get placeholder() {
    return this.getAttribute('placeholder');
  }

  set placeholder(value) {
    this.setAttribute('placeholder', value);
  }

  get doctabs() {
    return this.getAttribute('doctabs');
  }

  set doctabs(value) {
    this.setAttribute('doctabs', value);
  }

  /**
   * Gets the currently active pane. Only one child node (should) be visible.
   * This returns the first child that's visible.
   */
  get activePane() {
    for (let child of this.childNodes) {
      if (child.style.display = 'block') {
        return child;
      }
    }
    return null;
  }

  set activePane(value) {
    let found = false;
    for (let child of this.childNodes) {
      if (child === value) {
        child.style.display = 'block';
        found = true;
      } else {
        child.style.display = 'none';
      }
    }
    this._placeholder.style.display = found ? 'none' : 'block';
  }

  addPane(pane) {
    let node = pane instanceof HTMLElement ? pane : pane.contents;
    if (!(node instanceof HTMLElement)) {
      throw new Error("Cannot add " + Object.prototype.toString.call(node) + " as pane");
    }
    // Look through our children and see if this node already exists
    for (let child of this.childNodes) {
      if (child === node) {
        // If we found it, activate it.
        this.activePane = node;
        return;
      }
    }
    // If we didn't find the child, add it and it will automatically activate.
    this.append(node);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'placeholder':
        this._placeholder.innerText = newValue ? newValue : '';
        break;
      case 'doctabs':
        // The doctabs attribute indicates another node, which should be an
        // instance of x-doctabs, that should be made to match our contents.
        this._setDoctabs(newValue ? document.getElementById(newValue) : null);
        break;
    }
  }

  _setDoctabs(doctabs) {
    if (doctabs === null) {
      // Undo anything we've done.
      this._doctabs = null;
    } else if (typeof doctabs.openTab === 'function') {
      this._doctabs = doctabs;
      // Populate it with tabs as necessary
    }
  }

  _getTitleForNode(node) {
    let title = node.getAttribute("tab-title");
    if (!title) {
      title = node.nodeName.toLowerCase().replace(/-/g, " ");
    }
    return title;
  }

  _addTab(node) {
    let id = node.getAttribute('id');
    if (!id) {
      // generate an ID
      id = "-hexed-tab-" + generateNextID();
      node.setAttribute("id", id);
    }
    if (this._doctabs) {
      let tab = document.createElement('x-doctab');
      tab.value = id;
      let title = this._getTitleForNode(node);
      let xTitle = document.createElement('x-label');
      xTitle.append(title);
      tab.append(xTitle);
      tab.addEventListener('closed', (event) => {
        console.log(event);
        // TODO: Forward this to the pane, because the pane may decline to
        // allow its tab be closed.
        let pane = document.getElementById(tab.value);
        if (pane && pane.parentNode === this) {
          // Remove the association before we remove the node, so we don't try
          // and close the tab that is already being closed
          this._tabs.delete(tab.value);
          this.removeChild(pane);
        }
      });
      this._doctabs.openTab(tab);
      this._tabs.set(id, tab);
    }
  }

  _removeTab(node) {
    let id = node.getAttribute('id');
    if (id && this._doctabs) {
      let tab = this._tabs.get(id);
      if (tab) {
        this._doctabs.closeTab(tab);
        this._tabs.delete(id);
      }
    }
  }
}
window.customElements.define('hexed-workspace', HexedWorkspace);

class HexedPane extends HTMLElement {
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
        // TODO: Notify workspace so that the tab can be updated
        break;
      case 'active':
        break;
    }
  }
}
window.customElements.define('hexed-pane', HexedPane);
