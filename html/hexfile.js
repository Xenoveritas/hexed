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
}

Block.prototype = {
  _load: function(index, hf, callback) {
    this.pending = true;
    this.index = index;
    // Figure out the offset and length
    var offset = index * BLOCK_SIZE, length = Math.min(BLOCK_SIZE, hf.size - offset);
    fs.read(hf.fd, this.buffer, 0, length, offset, (function(me) {
      return function(err, bytesRead, buffer) {
        if (err) {
          return callback(err);
        }
        if (bytesRead < length) {
          // It looks like the only way this will happen is if we go off the end
          // of the file. TODO: check to make sure that's true.
        }
        console.log("Block " + me.index + " loaded.");
        me.pending = false;
        return callback(null, me);
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
 * Gets the cached block if it exists, or triggers a load if it doesn't.
 */
HexFile.prototype._loadBlock = function(index, callback) {
  var block = this._blocks.get(index);
  if (block) {
    callback(null, block);
    return block;
  }
  // Otherwise we need to generate a new block.
  block = new Block(index);
  this._blocks.set(index, block);
  // And trigger a load for this block
  block._load(index, this, callback);
  return block;
}

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
  // First, the easy version.
  var res = this.readCached(offset, length);
  if (res) {
    // See, that was easy
    callback(null, res);
    return this;
  } else {
    // Otherwise we need to plan for the reads.
    var index = Math.floor(offset / BLOCK_SIZE);
    debuglog("Need to read block %d", index);
    // FIXME: Need to deal with reads that span blocks. Thankfully this.readCached
    // has already rejected such reads at this point in time.
    // FIXME: Also need to deal with "ludicrous" reads - reads that attempt to
    // read more than our cache will willingly hold. (In these cases, we should
    // just do the read directly and not bother caching any of it.)
    this._loadBlock(index, (function(me, offset, length) {
      return function(err, block) {
        if (err) {
          callback(err);
          return;
        }
        var blockOffset = offset % BLOCK_SIZE;
        callback(null, block.buffer.slice(blockOffset, blockOffset + length));
      }
    })(this, offset, length));
    return this;
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
 */
HexFile.prototype.readCached = function(offset, length) {
  if (offset >= this.size)
    throw Error("Attempt to read past end of file (file is " + this.size + "bytes, offset was " + offset + ")");
  if (offset + length > this.size) {
    length = this.size - offset;
  }
  var index = Math.floor(offset / BLOCK_SIZE);
  var blockOffset = offset % BLOCK_SIZE;
  if (blockOffset + length > BLOCK_SIZE)
    throw Error("Oops: can't read " + length + " bytes at " + offset + " - this spans blocks (FIXME)");
  // TODO: Allow reads that span multiple blocks. (The present design prevents
  // such a thing from happening - the lines always break at block boundaries.)
  var block = this._getBlock(index);
  if (!block || block.pending) {
    debuglog('Cache miss for [0x%s:%d] => %d', offset.toString(16), length, index);
    return null;
  } else {
    debuglog('Cache hit for [0x%s:%d] => %d', offset.toString(16), length, index);
    return block.buffer.slice(blockOffset, blockOffset + length);
  }
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
