/**
 * Module for dealing with the generic workspace.
 */

import Pane from './pane.js';

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
          // Add tabs for any added children...
          for (let added of mutation.addedNodes) {
            this._addTab(added);
          }
          // Activate the last tab...
          if (mutation.addedNodes.length > 0) {
            this.activePane = mutation.addedNodes[mutation.addedNodes.length-1];
          }
          for (let removed of mutation.removedNodes) {
            this._removeTab(removed);
          }
          if (mutation.removedNodes.length > 0) {
            // If nodes were removed, it's possible that there is no remaining
            // active node. First see if we can find a selected tab.
            if (this._doctabs) {
              let selectedTab = this._doctabs.querySelector("x-doctab[selected]");
              if (selectedTab) {
                let pane = this.querySelector('#' + selectedTab.value);
                if (pane) {
                  this.activePane = pane;
                  return;
                }
              }
            }
            // If we've fallen to here, we don't have a selected tab.
            if (this.children.length === 0) {
              this._placeholder.style.display = 'block';
            } else {
              this.activePane = this.children[0];
            }
          }
        }
      }
    });
    this._observer.observe(this, { childList: true });
    this._tabs = new Map();
    this._tabSelectListener = (event) => {
      // The event doesn't tell us *which* tab is selected, just that *a* tab
      // is selected. Grab the first selected tab, and use that.
      let tab = this._doctabs.querySelector('x-doctab[selected]');
      if (tab) {
        let pane = this.querySelector('#' + tab.value);
        if (pane) {
          this.activePane = pane;
        }
      }
    };
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
    for (let child of this.children) {
      if (child.style.display == '') {
        return child;
      }
    }
    return null;
  }

  set activePane(value) {
    let found = false;
    for (let child of this.childNodes) {
      if (child === value) {
        child.style.display = '';
        // Find the associated tab and select it
        let tab = this._tabs.get(value.getAttribute('id'));
        if (tab) {
          tab.selected = true;
        }
        found = true;
      } else {
        if (child.style.display !== 'none') {
          // Let this child know that it is about to be hidden.
          child.dispatchEvent(new CustomEvent("deactivated"));
        }
        child.style.display = 'none';
        let tab = this._tabs.get(child.getAttribute('id'));
        if (tab) {
          tab.selected = false;
        }
      }
    }
    this._placeholder.style.display = found ? 'none' : '';
    if (found) {
      // If we found it, inform it that we're activating it.
      value.dispatchEvent(new CustomEvent("activated"));
    }
  }

  addPane(pane) {
    if (pane instanceof Pane) {
      pane.workspace = this;
    }
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
    if (doctabs === this._doctabs)
      return;
    // Undo anything we've done.
    if (this._doctabs) {
      this._doctabs.removeEventListener('select', this._tabSelectListener);
    }
    if (doctabs === null) {
      this._doctabs = null;
    } else if (typeof doctabs.openTab === 'function') {
      this._doctabs = doctabs;
      // TODO: Populate it with tabs as necessary
      this._doctabs.addEventListener('select', this._tabSelectListener);
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
      tab.addEventListener('close', (event) => {
        // TODO: Forward this to the pane, because the pane may decline to
        // allow its tab be closed.
        let pane = this.querySelector('#' + tab.value);
        if (pane) {
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

  _tabTitleChanged(pane) {
    let id = pane.getAttribute('id');
    if (id) {
      let tab = this._tabs.get(id);
      if (tab) {
        let label = tab.querySelector('x-label');
        if (label)
          label.innerText = this._getTitleForNode(pane);
      }
    }
  }
}
window.customElements.define('hexed-workspace', HexedWorkspace);
