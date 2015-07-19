/**
 * Module for dealing with the generic workspace.
 */

var FileUI = require('./file-ui');
var hexfile = require('./hexfile');

function Workspace() {
  this.dom = document.createElement('hexed-workspace');
  this.dom.setAttribute('tabindex', '-1');
  document.body.appendChild(this.dom);
  // TODO: File tree on left
  this.contents = new WorkspaceContents(this, this.dom);
}

Workspace.prototype = {
  _id: 0,
  /**
   * Opens a givne file.
   */
  openFile: function(filename, callback) {
    // TODO: If the file is already open, bring that to the front.
    // Callback isn't required, if it isn't given, make it a no-op.
    if (!callback) {
      callback = function() { };
    }
    var me = this;
    hexfile.open(filename, function(err, file) {
      if (err) {
        // TODO: Show error
        console.log(err);
        callback(err);
      } else {
        me.contents._createTab(file, me._id++);
        callback(null, err);
      }
    });
  }
};

function WorkspaceContents(workspace, container) {
  this.workspace = workspace;
  this.dom = document.createElement('hexed-workspace-axis');
  this.dom.className = 'vertical';
  this.tabContainer = document.createElement('hexed-panel-container');
  this.tabContainer.className = 'top';
  this.dom.appendChild(this.tabContainer);
  this.tabDom = document.createElement('ul');
  this.tabContainer.appendChild(this.tabDom);
  this.panesContainer = document.createElement('hexed-panel-container');
  this.panesContainer.className = 'panes';
  this.dom.appendChild(this.panesContainer);
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
  this._currentFile = null;
}

WorkspaceContents.prototype = {
  /**
   * Opens a new file tab using the given file object.
   */
  _createTab: function(file, id) {
    // Hide the placeholder.
    this.placeholder.style.display = 'none';
    // At present we don't really do tabs, so destroy the current one.
    if (this._currentFile) {
      this._currentFile.close();
    }
    // Create the UI.
    var tab = new FileUI(id, file, this, this.panesContainer);
    this._currentFile = tab;
  }
}

function StatusBar(container) {
  this.dom = document.createElement('status-bar');
  container.appendChild(this.dom);
}

exports.Workspace = Workspace;
exports.WorkspaceContents = WorkspaceContents;
exports.StatusBar = StatusBar;
