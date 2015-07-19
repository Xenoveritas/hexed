/**
 * @module hex-file
 * Module for accessing chunks of a file
 */

var fs = require('fs'),
  util = require('util'),
  events = require('events'),
  LRU = require('lru-cache');

var debuglog = function() { console.log(util.format.apply(util, arguments)); };

/**
 * Size of a "block" - currently set to 4KB.
 */
var BLOCK_SIZE = 4096;

/**
 * A "block". A block is simply a block of the file that gets kept around cached
 * in order to immediately populate the UI with data from the file.
 */
function Block(index, buffer) {
  this.buffer = buffer == null ? new Buffer(BLOCK_SIZE) : buffer;
  /**
   * Actual length of the block. This is nearly always BLOCK_SIZE - the sole
   * exception is the last block of the file, which can (or not, if the file
   * is an exact multiple of blocks) be less.
   */
  this.length = 0;
  /**
   * Whether or not this block is pending.
   */
  this.pending = true;
  this.index = index;
  this._callback = null;
}

Block.prototype = {
  _load: function(index, hf, callback) {
    // If we're already loading, just add the callback to the list.
    if (this._callback !== null) {
      if (typeof this._callback == 'function') {
        var cb = this._callback;
        this._callback = [ cb, callback ];
      } else {
        this._callback.push(callback);
      }
      return;
    }
    this._callback = callback;
    this.pending = true;
    this.index = index;
    // Figure out the offset and length
    var offset = index * BLOCK_SIZE, length = Math.min(BLOCK_SIZE, hf.size - offset);
    fs.read(hf.fd, this.buffer, 0, length, offset, (function(me) {
      return function(err, bytesRead, buffer) {
        var callbacks = me._callback;
        me._callback = null;
        if (err) {
          if (typeof callbacks == 'function') {
            callbacks(err);
          } else {
            callbacks.forEach(function(cb) { cb(err); });
          }
          return;
        }
        if (bytesRead < length) {
          // It looks like the only way this will happen is if we go off the end
          // of the file. TODO: check to make sure that's true.
        }
        console.log("Block " + me.index + " loaded.");
        me.pending = false;
        if (typeof callbacks == 'function') {
          callbacks(null, me);
        } else {
          callbacks.forEach(function(cb) { cb(null, me); });
        }
        return;
      };
    })(this));
  }
};

/**
 * A hex file.
 * @constructor
 * Create a new file. The file is created immediately, but the various file
 * stats are delayed. When the file is completely populated, callback will be
 * invoked.
 */
function HexFile(path, fd, callback) {
  events.EventEmitter.call(this);
  /**
   * The file's path.
   */
  this.path = path;
  /**
   * The file descriptor for the file (used by the fs module).
   */
  this.fd = fd;
  this._blocks = new LRU({max: 128, dispose: function(key, block) {
    // At some point it may make sense to try and reuse buffers. Meh.
  } });
  this._maxReadLength = 128 * BLOCK_SIZE;
  this._blockCount = 0;
  // We maintain a linked list of blocks in most recent to least recent order.
  // This list is used to reclaim blocks if we go over the maximum number of
  // blocks we cache for ready access.
  this._newestBlock = null;
  this._oldestBlock = null;
  this.maxBlock = 0;
  var me = this;
  // And now grab the stats (such as file size)
  fs.fstat(fd, function(err, stats) {
    if (err) {
      callback(err);
    }
    me.stats = stats;
    me.size = stats.size;
    me.maxBlock = Math.ceil(me.size / BLOCK_SIZE);
    callback(null, me);
  });
}

util.inherits(HexFile, events.EventEmitter);

HexFile.prototype.close = function(callback) {
  fs.close(this.fd, callback);
};

/**
 * Gets a block if one exists.
 */
HexFile.prototype._getBlock = function(index) {
  return this._blocks.get(index);
};

/**
 * Asynchronously reads a part of the file. The part requested will be cached
 * for fast access through {@link #readCached}.
 * <p>
 * The buffer given to the callback is a "short lived" buffer and the data can
 * only be assumed valid until another method is invoked on this hex file. If
 * you need to persist the data for a long period of time, you'll need to copy
 * it. (Buffer.copy makes that easy.)
 */
HexFile.prototype.read = function(offset, length, callback) {
  if (length > this._maxReadLength) {
    // TODO: Allow this?
    throw Error("Request to read more than the cache is willing to store (" + length + " requested, max allowed is " + this._maxReadLength + ")");
  }
  // First, the easy version.
  var res = this.readCached(offset, length);
  if (res) {
    // See, that was easy
    callback(null, res);
    return this;
  } else {
    // Otherwise just use ensureCached to load the missing data.
    var me = this;
    this.ensureCached(offset, length, function(err) {
      if (err) {
        callback(err);
      } else {
        // Now that the blocks are loaded, redo the read so we use the cached
        // data.
        me.read(offset, length, callback);
      }
    });
    return this;
  }
};

/**
 * Ensure that a given section of the file is cached. The callback will be
 * invoked when the blocks are loaded, but it will not be given any data. If all
 * the blocks covered are loaded, the callback will simply be called
 * immediately.
 */
HexFile.prototype.ensureCached = function(offset, length, callback) {
  var firstIndex = Math.floor(offset / BLOCK_SIZE),
    lastIndex = Math.floor((offset + length) / BLOCK_SIZE),
    needed = 0, handler = function(err) {
      needed--;
      if (err != null || needed == 0) {
        callback(err);
      }
    };
  // TODO: Increase cache size in this case? I'm not sure what the "correct"
  // behavior is.
  if (lastIndex - firstIndex >= this._blocks.max)
    throw new Error('Attempting to ensure more cached blocks (' + (lastIndex - firstIndex + 1) + ') than cache size (' + this._blocks.max + ')');
  debuglog('Ensure cached [%s:%d] => [%d,%d]', offset.toString(16), length, firstIndex, lastIndex);
  for (var i = firstIndex; i <= lastIndex; i++) {
    var block = this._getBlock(i);
    if (!block) {
      // If no block, create it.
      block = new Block(i);
      this._blocks.set(i, block);
    }
    if (block.pending) {
      // If the block is pending, tell the block to load.
      needed++;
      block._load(i, this, handler);
    }
  }
  if (needed == 0) {
    // Immediately invoke the callback.
    callback(null);
  }
};

/**
 * Reads a given chunk from the cache if it's cached. This will always return
 * immediately and will never start a read. It's used if you want the data
 * fast (well, fast, assuming no swapping shenanigans from the OS).
 * <p>
 * Assuming that data is returned, note that it's a "short lived" buffer and the
 * data can only be assumed valid until another method is invoked on this hex
 * file. If you need to persist the data for a long period of time, you'll need
 * to copy it. (Buffer.copy makes that easy.)
 * <p>
 * If you request a set of the file past the end (or beginning)
 */
HexFile.prototype.readCached = function(offset, length) {
  if (offset + length > this.size) {
    length = this.size - offset;
  }
  if (!(length > 0) || !(offset >= 0)) {
    // No data to read, so just return an empty buffer.
    return new Buffer(0);
  }
  var firstIndex = Math.floor(offset / BLOCK_SIZE),
    lastIndex = Math.floor((offset + length) / BLOCK_SIZE);
  if (firstIndex === lastIndex) {
    // This is the easiest case.
    var block = this._getBlock(firstIndex);
    if (!block || block.pending) {
      return null;
    }
    var blockOffset = offset % BLOCK_SIZE;
    return block.buffer.slice(blockOffset, blockOffset + length);
  }
  // Grab all the blocks we need.
  var blocks = [];
  // Check to see if all these blocks are loaded.
  for (var i = firstIndex; i <= lastIndex; i++) {
    var block = this._getBlock(i);
    if (!block || block.pending) {
      debuglog('Cache miss for [0x%s:%d] => %d', offset.toString(16), length, i);
      return null;
    }
    blocks.push(block);
  }
  // We have all the blocks we need. Create a buffer and copy the data into
  // it.
  var buffer = new Buffer(length), bufOffset = 0,
    blockOffset = offset % BLOCK_SIZE, last = blocks.length - 1;
  // First copy the data from the first block
  blocks[0].buffer.copy(buffer, 0, blockOffset);
  bufOffset = BLOCK_SIZE - blockOffset;
  // Copy the middle blocks if there are any
  for (var i = 1; i < last; i++) {
    blocks[i].buffer.copy(buffer, bufOffset);
    bufOffset += BLOCK_SIZE;
  }
  // Copy whatever is left out of the last block.
  blocks[last].buffer.copy(buffer, bufOffset, 0, length - bufOffset);
  // And return.
  return buffer;
};

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
