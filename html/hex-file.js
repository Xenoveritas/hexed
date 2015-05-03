/**
 * @module hex-file
 * Module for accessing chunks of a file
 */

var fs = require('fs');

/**
 * Size of a "chunk" - currently set to 4KB.
 */
var CHUNK_SIZE = 4096;

/**
 * A hex file.
 */
function HexFile(path, fd, callback) {
  this.path = path;
  this.fd = fd;
  var me = this;
  // And now grab the stats (such as file size)
  fs.fstat(fd, function(err, stats) {
    if (err) {
      callback(err);
    }
    me.stats = stats;
    me.size = stats.size;
    callback(null, me);
  });
}

HexFile.prototype = {
  close: function(callback) {
    fs.close(this.fd, callback);
  },
  readChunk: function(index, callback) {
    var start = index * CHUNK_SIZE;
    if (start >= this.size) {
      callback(new Error("Chunk " + index + " is past the end of file"));
      return;
    }
    var end = start + CHUNK_SIZE;
    if (end >= this.size)
      end = this.size - 1;
    var buffer = new Buffer(end - start);
    this.read(buffer, start, callback);
  },
  /**
   * Reads a chunk of the file.
   */
  read: function(buffer, offset, callback) {
    var me = this;
    fs.read(this.fd, buffer, 0, buffer.length, offset, function(err, bytesRead, buffer) {
      if (err)
        return err;
      if (bytesRead < buffer.length) {
        // Can this happen?
        console.log(" *** DID NOT FULLY READ ***");
      }
      callback(null, buffer);
    });
  }
}

exports.CHUNK_SIZE = CHUNK_SIZE;

exports.open = function(path, callback) {
  fs.open(path, 'r', function(err, fd) {
    if (err) {
      callback(err);
    } else {
      new HexFile(path, fd, callback);
    }
  });
}
exports.HexFile = HexFile;
