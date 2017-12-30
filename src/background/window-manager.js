/**
 * This module deals with managing windows within Hexed.
 */
"use strict";

import { app } from 'electron';
// This creates a cyclic dependency. The hexed module will NOT be ready on the
// first pass through. This is OK, because we only need it in event handlers.
import * as hexed from '../main.js';

let windows = [];

// For macOS, if the app is activated with no active windows, open a new
// window. (For Linux and Windows this scenario is effectively impossible.)
app.on('activate', () => {
  if (windows.length === 0) {
    hexed.openNewWindow();
  }
});


/**
 * Adds a window to the list of windows being tracked.
 */
export function addWindow(window) {
  windows.push(window);
  window.on('closed', () => {
    // Remove this window from the windows array
    for (let i = 0; i < windows.length; i++) {
      if (windows[i] === window) {
        windows.splice(i, 1);
        window = null;
      }
    }
  });
}
