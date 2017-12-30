/**
 * This module provides a mechanism for registering panes that can be created
 * via URIs.
 */
"use strict";

let paneFactories = new Map();

export function addPaneFactory(urlPrefix, factory) {
  if (typeof factory !== 'function')
    throw new Error(`Invalid factory ${factory}`);
  paneFactories.set(urlPrefix, factory);
}

export function createPane(url, hexed) {
  if (typeof url !== 'string') {
    throw new Error(`Invalid URL type ${typeof url}`);
  }
  let index = url.indexOf(':');
  if (index < 0) {
    throw new Error(`No ":" in URL ${url}`);
  }
  let prefix = url.substring(0, index);
  let factory = paneFactories.get(prefix);
  if (factory) {
    return factory(url, hexed);
  } else {
    throw new Error(`Unable to handle URL type ${prefix} (in "${url}")`);
  }
}
