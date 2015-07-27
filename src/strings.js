/**
 * Utility module for scanning through a file and finding strings.
 */


// Reporting errors is optional because the standard use case is to chain
// multiple scanners together to create a single scanner using multiple
// encodings.

function is_ascii(byte) {
  return byte >= 32 && byte <= 127;
}

/**
 * Simplest scanner: looks for ASCII characters.
 */
function createASCIIScanner(callback, minLength, reportErrors) {
  var previous = null;
  if (arguments.length < 3)
    reportErrors == true;
  if (arguments.length < 2)
    minLength = 4;
  return function(err, buffer, offset) {
    if (err) {
      if (reportErrors)
        callback(err);
      return;
    }
    var i = 0, start = -1;
    if (previous != null) {
      // If we've already found something, we need to continue looking for
      // characters.
      for (; i < buffer.length; i++) {
        if (!is_ascii(buffer[i])) {
          // End of the string.
          if (i > 0 && (previous.length + i) > minLength) {
            // Append whatever else we got and send it
            callback(null, previous + buffer.toString('utf8', 0, i), offset - previous.length, 'ascii');
          }
          // Regardless, blank the previous
          previous = null;
          break;
        }
      }
    }
    for (; i < buffer.length; i++) {
      if (start < 0) {
        // See if we're starting a string
        if (is_ascii(buffer[i])) {
          // Mark the start
          start = i;
        }
      } else if (!is_ascii(buffer[i])) {
        if (i - start >= 4) {
          // Long enough, go ahead and send if
          callback(null, buffer.toString('utf8', start, i), offset + start, 'ascii');
        }
        // Regardless, blank start
        start = -1;
      }
    }
    // If we've hit the end and have a partial, save it
    if (start >= 0) {
      previous = buffer.toString('utf8', start, buffer.length);
    }
  }
}

/**
 * Scan through a {@link module:hexfile.HexFile} looking for strings, calling
 * the callback when it discovers them.
 * @param {module:hexfile.HexFile} file the file to scan
 * @param {function(error, string, offset, encoding)} callback a callback that receives strings
 */
exports.scan = function(file, callback, options) {
  // Options is more for documentation than anything else and doesn't do
  // anything. Eventually this method will act as a "fork" for multiple scanners.
  var ascii = createASCIIScanner(callback);
  file.scan(function(err, buffer, offset) {
    ascii(err, buffer, offset);
    return true;
  });
}
