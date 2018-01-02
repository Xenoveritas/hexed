/**
 * This module is the main "controller" for the HTML side of hexed. It maintains
 * the window and the various open tabs inside it.
 */
"use strict";

import "./less/hexed.less";

import {ipcRenderer} from 'electron';
import 'path';

import './workspace.js';
import AboutPane from './panes/about.js';
import FilePane from './panes/file.js';
import { createPane } from './pane-manager.js';

// Can process.platform ever contain things like spaces? I dunno. Just replace
// any whitespace with '-' anyway.
document.body.className = 'platform-' + process.platform.replace(/\s/, '-');

// Build our core UI.

/**
 * A Hexed window, or more accurately, a single Hexed render process.
 */
class Hexed {
  constructor() {
    this._doctabs = document.querySelector('x-doctabs');
    this._doctabs.addEventListener('open', (event) => {
      // Trigger an open file event
      ipcRenderer.send('open-file');
      event.preventDefault();
    });
    this._workspace = document.querySelector('hexed-workspace');

    // Receive events.
    // This event is received from the Open... menu item.
    ipcRenderer.on('open-files', (event, filenames) => {
      this.openFiles(filenames);
    });

    // This event is received from generic menu items that trigger an action
    // but otherwise have no variables.
    ipcRenderer.on('menu', (event, command) => {
      this.doMenuCommand(command);
    });
    // Before the page is unloaded, do one last save session
    window.addEventListener('beforeunload', (event) => {
      this._saveSession();
    });
    this._restoreSession();
  }

  addPane(pane) {
    this._workspace.addPane(pane);
    this._saveSession();
  }

  get activePane() {
    let pane = this._workspace.activePane;
    return pane ? pane.pane : null;
  }

  /**
   * Opens a given file.
   */
  openFile(filename) {
    let pane = new FilePane(filename);
    this.addPane(pane);
    return pane.openFile();
  }

  /**
   * Open multiple files at once. Returns an array of Promises generated from
   * calling {@link #openFile} on each file. Promise.all or Promise.race can
   * be used on the return result to wait for them to complete.
   */
  openFiles(filenames) {
    return filenames.map(filename => this.openFile(filename));
  }

  showAbout() {
    if (!this._aboutPane) {
      // Create the about pane
      this._aboutPane = new AboutPane();
      this._aboutPane.on('closed', () => {
        debuglog('About pane closed.');
        this._aboutPane = null;
      });
    }
    this.addPane(this._aboutPane);
  }

  doMenuCommand(command) {
    if (command == 'close-pane') {
      // A special case that gets handled here.
      let pane = this.activePane;
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
    let pane = this.activePane;
    if (pane)
      pane.executeMenuCommand(command);
  }

  _saveSession() {
    // Go through the open panes and figure out what our session is.
    let session = [];
    for (let child of this._workspace.children) {
      let info = child.pane ? child.pane.getSessionInfo() : null;
      if (info) {
        session.push(info);
      } else {
        console.log(`Warning: will be unable to restore tab (no session info)`);
      }
    }
    sessionStorage.setItem("hexedSession", JSON.stringify(session));
  }

  _restoreSession() {
    let session = sessionStorage.getItem("hexedSession");
    if (session) {
      try {
        session = JSON.parse(session);
      } catch (ex) {
        console.log("Unable to restore session:");
        console.log(ex);
        return;
      }
      for (let info of session) {
        try {
          this._restoreTab(info);
        } catch (ex) {
          console.log(`Unable to restore saved session info ${JSON.stringify(info)}:`);
          console.log(ex);
        }
      }
    }
  }

  _restoreTab(info) {
    if (info === 'AboutPane') {
      // Special, since this is supposed to be a singleton.
      // TODO: Make singletons an actual "thing" as things like "preferences"
      // will also be singletons.
      this.showAbout();
      return;
    }
    let pane = createPane(info, this);
    if (pane) {
      this.addPane(pane);
    } else {
      throw new Error("No pane created.");
    }
  }
};

export const hexed = new Hexed();

// Add drag and drop handlers so you can drop a file on the window and it will
// open in it
let contents = document.body;

contents.addEventListener('dragenter', (event) => {
  // Check to see if the event is a file
  if (event.dataTransfer.files.length == 1) {
    event.dataTransfer.effectAllowed = 'move';
  } else {
    event.dataTransfer.effectAllowed = 'none';
  }
}, false);

contents.addEventListener('dragover', (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  return false;
});

contents.addEventListener('drop', (event) => {
  if (event.dataTransfer.files.length > 0) {
    let files = [];
    for (let file of event.dataTransfer.files) {
      files.push(file.path);
    }
    hexed.openFiles(files);
  }
}, false);
