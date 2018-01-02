/**
 * This module provides a mechanism for registering panes that can be created
 * via URIs.
 */
"use strict";

let paneFactories = new Map();

/**
 * Add a factory function to create panes with the given ID. The factory
 * function will receive the SessionInfo object saved in the session when it
 * was saved.
 */
export function addPaneFactory(id, factory) {
  if (arguments.length === 1 && typeof id === 'function') {
    paneFactories.set(id.name, () => { new id(); });
  } else {
    if (typeof factory !== 'function')
      throw new Error(`Invalid factory ${factory}`);
    paneFactories.set(id, factory);
  }
}

export function createPane(info, hexed) {
  let id = info;
  if (typeof info === 'object') {
    id = info.id;
  }
  if (typeof id !== 'string') {
    throw new Error(`Cannot restore ${info} (missing or bad ID).`);
  }
  let factory = paneFactories.get(id);
  if (factory) {
    return factory(hexed, info);
  } else {
    throw new Error(`Unable to restore ${id} (unknown type)`);
  }
}
