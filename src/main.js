/**
 * @module
 * This is the master startup module for hexed. It controls the core app and
 * looks after the various windows. Right now it doesn't do all that much, but
 * in the future it will deal with loading plugins and any initial start-up
 * stuff that needs to be done.
 */
"use strict";

import {app, BrowserWindow, Menu} from 'electron';
import HexedWindow from './background/hex-window';

// TODO: Register a new "hexed" protocol for loading our resources.

// TODO: Look for plugins.

// TODO: Restore previous session (if any)

/**
 * Open a new window containing the given files.
 */
export function openNewWindow(files) {
  // Create the browser window.
  let newWindow = new HexedWindow();
  newWindow.once('ready', () => {
    if (files && files.length > 0)
      newWindow.open(files);
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  console.log(`Restore from ${app.getPath('userData')}`);
  // Build our menu
  let menu = require('./background/hex-menu').createMenu();
  Menu.setApplicationMenu(menu);

  var files = [];
  // FIXME: Is this even remotely correct?
  for (var i = 2; i < process.argv.length; i++) {
    files.push(process.argv[i]);
  }
  openNewWindow(files);
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
