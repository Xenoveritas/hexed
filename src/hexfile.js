/**
 * @module hex-file
 * Module for accessing chunks of a file
 */
"use strict";

const fs = require('fs'),
  path = require('path'),
  EventEmitter = require('events'),
  LRU = require('lru-cache');

const debuglog = require('./debuglog').debuglog('hexfile');

/**
 * Size of a "block" - currently set to 4KB.
 */
const BLOCK_SIZE = 4096;

/**
 * A "block". A block is simply a block of the file that gets kept around cached
 * in order to immediately populate the UI with data from the file.
 */
class Block {
  constructor(index, buffer) {
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

  _load(index, hf, callback) {
    // If we're already loading, just add the callback to the list.
    if (this._callback !== null) {
      if (typeof this._callback === 'function') {
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
    var offset = index * BLOCK_SIZE;
    this.length = Math.min(BLOCK_SIZE, hf.size - offset);
    fs.read(hf.fd, this.buffer, 0, this.length, offset, (err, bytesRead, buffer) => {
      let callbacks = this._callback;
      this._callback = null;
      if (err) {
        if (typeof callbacks == 'function') {
          callbacks(err);
        } else {
          callbacks.forEach(function(cb) { cb(err); });
        }
        return;
      }
      if (bytesRead < this.length) {
        // It looks like the only way this will happen is if we go off the end
        // of the file. TODO: check to make sure that's true.
      }
      debuglog("Block %d loaded.", this.index);
      this.pending = false;
      if (typeof callbacks === 'function') {
        callbacks(null, this);
      } else {
        callbacks.forEach(cb => cb(null, this));
      }
      return;
    });
  }
}

/**
 * A hex file.
 */
class HexFile extends EventEmitter {
  /**
   * Create a new file. The file is created immediately, but the various file
   * stats are delayed. When the file is completely populated, callback will be
   * invoked.
   */
  constructor(filename, fd, callback) {
    super();
    // Immutable properties:
    /**
     * The file's path.
     */
    Object.defineProperty(this, 'path', {
      value: filename,
      enumerable: true
    });
    Object.defineProperty(this, 'filename', {
      value: path.basename(filename)
    })
    /**
     * The file descriptor for the file (used by the fs module).
     */
    Object.defineProperty(this, 'fd', {
      value: fd,
      enumerable: true
    });
    this._blocks = new LRU({max: 128, dispose: function(key, block) {
      // At some point it may make sense to try and reuse buffers. Meh.
      // (What this is probably going to look like is shoving the last disposed
      // buffer into this and then grabbing it if it exists on building a new
      // block.)
    } });
    this._maxReadLength = 128 * BLOCK_SIZE;
    this.maxBlock = 0;
    // And now grab the stats (such as file size)
    fs.fstat(fd, (err, stats) => {
      if (err) {
        callback(err);
      }
      this.stats = stats;
      this.size = stats.size;
      this.maxBlock = Math.ceil(this.size / BLOCK_SIZE);
      callback(null, this);
    });
  }

  close(callback) {
    fs.close(this.fd, callback);
  }

  /**
   * Gets a block if one exists.
   */
  _getBlock(index) {
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
  read(offset, length, callback) {
    if (length > this._maxReadLength) {
      // TODO: Allow this?
      throw new Error("Request to read more than the cache is willing to store (" + length + " requested, max allowed is " + this._maxReadLength + ")");
    }
    // First, the easy version.
    var res = this.readCached(offset, length);
    if (res) {
      // See, that was easy
      callback(null, res);
      return this;
    } else {
      // Otherwise just use ensureCached to load the missing data.
      this.ensureCached(offset, length, (err) => {
        if (err) {
          callback(err);
        } else {
          // Now that the blocks are loaded, redo the read so we use the cached
          // data.
          this.read(offset, length, callback);
        }
      });
      return this;
    }
  }

  /**
   * Ensure that a given section of the file is cached. The callback will be
   * invoked when the blocks are loaded, but it will not be given any data. If all
   * the blocks covered are loaded, the callback will simply be called
   * immediately.
   */
  ensureCached(offset, length, callback) {
    var firstIndex = Math.floor(offset / BLOCK_SIZE),
      lastIndex = Math.floor((offset + length) / BLOCK_SIZE),
      needed = 0, handler = (err) => {
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
    for (let i = firstIndex; i <= lastIndex; i++) {
      let block = this._getBlock(i);
      if (!block) {
        // If no block, create it.
        // FIXME: This is where we should be reusing buffers.
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
  }

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
   * If you request a set of the file past the end (or beginning), then this will
   * return an empty buffer.
   */
  readCached(offset, length) {
    if (offset + length > this.size) {
      length = this.size - offset;
    }
    if (!(length > 0) || !(offset >= 0)) {
      // No data to read, so just return an empty buffer.
      return Buffer.allocUnsafe(0);
    }
    let firstIndex = Math.floor(offset / BLOCK_SIZE),
      lastIndex = Math.floor((offset + length) / BLOCK_SIZE);
    if (firstIndex === lastIndex) {
      // This is the easiest case.
      let block = this._getBlock(firstIndex);
      if (!block || block.pending) {
        return null;
      }
      let blockOffset = offset % BLOCK_SIZE;
      return block.buffer.slice(blockOffset, blockOffset + length);
    }
    // Grab all the blocks we need.
    let blocks = [];
    // Check to see if all these blocks are loaded.
    for (let i = firstIndex; i <= lastIndex; i++) {
      let block = this._getBlock(i);
      if (!block || block.pending) {
        debuglog('Cache miss for [0x%s:%d] => %d', offset.toString(16), length, i);
        return null;
      }
      blocks.push(block);
    }
    // We have all the blocks we need. Create a buffer and copy the data into
    // it.
    let buffer = Buffer.allocUnsafe(length), bufOffset = 0,
      blockOffset = offset % BLOCK_SIZE, last = blocks.length - 1;
    // First copy the data from the first block
    blocks[0].buffer.copy(buffer, 0, blockOffset);
    bufOffset = BLOCK_SIZE - blockOffset;
    // Copy the middle blocks if there are any
    for (let i = 1; i < last; i++) {
      blocks[i].buffer.copy(buffer, bufOffset);
      bufOffset += BLOCK_SIZE;
    }
    // Copy whatever is left out of the last block.
    blocks[last].buffer.copy(buffer, bufOffset, 0, length - bufOffset);
    // And return.
    return buffer;
  }

  /**
   * Scans the entire file, passing blocks to the callback in order as they are
   * read. The callback has the signature function(err, buffer, offset), where
   * err is non-null if an error has occurred, buffer is the buffer containing
   * the data, and offset is the offset in bytes from the start of the file for
   * that buffer.
   * <p>
   * The callback may return false to stop the scan if so desired. Any other
   * return value will continue the scan. (Raising an error will <em>also</em>
   * stop the scan.)
   * <p>
   * Note that while this will consult the local cache for blocks, it does not
   * cache content it finds.
   * @param {function(error, buffer, offset)} callback callback that receives block data or
   * an error if the scan has failed. A scan may return <code>false</code> to
   * terminate a scan. When a scan has completed and no more blocks will be sent,
   * the callback will be called with both a null error and buffer with offset
   * set to the offset that the previous callback ended on.
   * @param {number} offset the offset (in bytes) into the file to start at. At
   * present you will <em>always</em> receive complete blocks, so the first byte
   * received may not be at the requested offset.
   * @param {number} lastOffset the last offset (in bytes, exclusive) to receive
   * data from.
   */
  scan(callback, offset, lastOffset) {
    if (arguments.length < 3) {
      lastOffset = this.size;
      if (arguments.length < 2)
        offset = 0;
    }
    let index = Math.floor(offset / BLOCK_SIZE),
      lastIndex = Math.ceil(lastOffset / BLOCK_SIZE),
      me = this,
      buffer = new Buffer(BLOCK_SIZE),
      readNextBlock = function() {
        // In order to avoid destroying the stack if we have enough cached blocks
        // to scan through, do this in a loop. We only break the loop once we have
        // no cached data.
        while (index < lastIndex) {
          var b = me._blocks.peek(index);
          if (b && !b.pending) {
            var buf = b.buffer;
            if (buf.length != b.length)
              buf = buf.slice(0, b.length);
            if (callback(null, buf, index * BLOCK_SIZE) === false) {
              // Cancel the scan.
              return;
            }
            index++;
          } else {
            // Need to read it
            fs.read(me.fd, buffer, 0, buffer.length, index * BLOCK_SIZE, function(err, bytesRead) {
              if (err) {
                callback(err);
              } else {
                // If we didn't read the full buffer size (which happens on the last block)
                // return a slice.
                if (callback(null, bytesRead < buffer.length ?
                    buffer.slice(0, bytesRead) : buffer, index * BLOCK_SIZE) !== false) {
                  // And read the next block
                  index++;
                  readNextBlock();
                }
              }
            });
            // And we're done for now
            return;
          }
        }
        // Once we're here, we're done altogether, so signal that.
        callback(null, null, lastOffset);
      };
    // Sanity checking on the indices to trap NaN and infinity
    if (!(index >= 0))
      index = 0;
    index = Math.min(index, this.maxBlock);
    if (!(index < lastIndex)) {
      lastIndex = index;
    }
    debuglog('scan: scan from %d to %d', index, lastIndex);
    readNextBlock();
  }
}

exports.open = function(filename, callback) {
  fs.open(filename, 'r', function(err, fd) {
    if (err) {
      callback(err);
    } else {
      new HexFile(filename, fd, callback);
    }
  });
}
exports.HexFile = HexFile;
