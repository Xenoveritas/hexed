/**
 * Inside the browser context, <code>util</code>'s <code>debuglog</code>
 * function doesn't work: it still uses <code>console.log</code>, which is now
 * Chrome's <code>console.log</code> and not the Node.js <code>console.log</code>
 * that it expects. This provides a different function that allows
 * <code>debuglog</code> to work within the browser.
 * <p>
 * FIXME: The flaw with this plan is that it means every line that gets reported
 * in the console is from this file. Oh well.
 * @module debuglog
 */

var util = require('util');

/**
 * Checks to see if a given section is enabled.
 */
function isDebugEnabled(section) {
  var node_debug = process.env['NODE_DEBUG'];
  if (node_debug) {
    // Canonicalize to all upper-case.
    node_debug = node_debug.toUpperCase();
    section = section.toUpperCase();
    // Split the sections.
    var sections = node_debug.split(/\s*,\s*/);
    for (var i = 0; i < sections.length; i++) {
      if (sections[i] == section)
        return true;
    }
  }
  return false;
}

module.exports.isDebugEnabled = isDebugEnabled;

module.exports.debuglog = function(section) {
  if (isDebugEnabled(section)) {
    section = section.toUpperCase();
    return function() {
      console.log(section + ': ' + util.format.apply(util, arguments));
    }
  } else {
    return function() { };
  }
}
