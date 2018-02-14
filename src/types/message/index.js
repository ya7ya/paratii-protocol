'use strict'

const protons = require('protons')
// const Block = require('ipfs-block')
// const isEqualWith = require('lodash.isequalwith')
// const assert = require('assert')
const each = require('async/each')
// const CID = require('cids')
// const codecName = require('multicodec/src/name-table')
// const vd = require('varint-decoder')
// const multihashing = require('multihashing-async')

// const pbm = protons(require('./message.proto'))
const pbm = protons(require('./paratii.proto'))
// const Entry = require('./entry')

class ParatiiMessage {
  constructor (opts) {
    this.hello = opts.hello

    // this.commands = new Map()
    // this.responses = new Map()
    this.fragments = new Map()
  }

  get empty () {
    return (!this.hello)
  }

  addCommand (cmd, tid, args) {
    if (!tid) {
      tid = String(Math.random())
    } else {
      tid = tid.toString()
    }

    if (args) {
      // console.log('[addCommand] adding args to command ', args)
      this.fragments.set(tid, {
        type: 1,
        tid: Buffer.from(tid),
        payload: Buffer.from(cmd),
        args: Buffer.from(args)
      })
    } else {
      this.fragments.set(tid, {
        type: 1,
        tid: Buffer.from(tid),
        payload: Buffer.from(cmd)
      })
    }
  }

  addResponse (response, tid) {
    if (!tid) {
      tid = String(Math.random())
    } else {
      tid = tid.toString()
    }

    this.fragments.set(tid, {
      type: 2,
      tid: Buffer.from(tid),
      payload: Buffer.from(response)
    })
  }

  // addEntry (cid, priority, cancel) {
  //   assert(cid && CID.isCID(cid), 'must be a valid cid')
  //   const cidStr = cid.buffer.toString()
  //
  //   const entry = this.wantlist.get(cidStr)
  //
  //   if (entry) {
  //     entry.priority = priority
  //     entry.cancel = Boolean(cancel)
  //   } else {
  //     this.wantlist.set(cidStr, new Entry(cid, priority, cancel))
  //   }
  // }
  //
  // addBlock (block) {
  //   assert(Block.isBlock(block), 'must be a valid cid')
  //   const cidStr = block.cid.buffer.toString()
  //   this.blocks.set(cidStr, block)
  // }
  //
  // cancel (cid) {
  //   assert(CID.isCID(cid), 'must be a valid cid')
  //   const cidStr = cid.buffer.toString()
  //   this.wantlist.delete(cidStr)
  //   this.addEntry(cid, 0, true)
  // }
  //
  // /*
  //  * Serializes to Bitswap Message protobuf of
  //  * version 1.0.0
  //  */
  // serializeToBitswap100 () {
  //   const msg = {
  //     wantlist: {
  //       entries: Array.from(this.wantlist.values()).map((entry) => {
  //         return {
  //           block: entry.cid.buffer, // cid
  //           priority: Number(entry.priority),
  //           cancel: Boolean(entry.cancel)
  //         }
  //       })
  //     },
  //     blocks: Array.from(this.blocks.values())
  //       .map((block) => block.data)
  //   }
  //
  //   if (this.full) {
  //     msg.wantlist.full = true
  //   }
  //
  //   return pbm.Message.encode(msg)
  // }

  serializeToParatii () {
    const msg = {
      hello: this.hello,
      // commands: Array.from(this.commands.values()),
      // responses: Array.from(this.responses.values())
      fragments: Array.from(this.fragments.values())
    }

    return pbm.Message.encode(msg)
  }

  /*
   * Serializes to Bitswap Message protobuf of
   * version 1.1.0
   */
  // serializeToBitswap110 () {
  //   const msg = {
  //     wantlist: {
  //       entries: Array.from(this.wantlist.values()).map((entry) => {
  //         return {
  //           block: entry.cid.buffer, // cid
  //           priority: Number(entry.priority),
  //           cancel: Boolean(entry.cancel)
  //         }
  //       })
  //     },
  //     payload: []
  //   }
  //
  //   if (this.full) {
  //     msg.wantlist.full = true
  //   }
  //
  //   this.blocks.forEach((block) => {
  //     msg.payload.push({
  //       prefix: block.cid.prefix,
  //       data: block.data
  //     })
  //   })
  //
  //   return pbm.Message.encode(msg)
  // }
  //
  // equals (other) {
  //   const cmp = (a, b) => {
  //     if (a.equals && typeof a.equals === 'function') {
  //       return a.equals(b)
  //     }
  //   }
  //
  //   if (this.full !== other.full ||
  //       !isEqualWith(this.wantlist, other.wantlist, cmp) ||
  //       !isEqualWith(this.blocks, other.blocks, cmp)
  //   ) {
  //     return false
  //   }
  //
  //   return true
  // }
  //
  // get [Symbol.toStringTag] () {
  //   const list = Array.from(this.wantlist.keys())
  //   const blocks = Array.from(this.blocks.keys())
  //   return `BitswapMessage <full: ${this.full}, list: ${list}, blocks: ${blocks}>`
  // }
}

ParatiiMessage.deserialize = (raw, callback) => {
  let decoded
  try {
    decoded = pbm.Message.decode(raw)
  } catch (err) {
    return setImmediate(() => callback(err))
  }

  // const isFull = (decoded.wantlist && decoded.wantlist.full) || false
  // const msg = new BitswapMessage(isFull)
  const msg = new ParatiiMessage(decoded)
  if (decoded.fragments.length > 0) {
    return each(decoded.fragments, (fragment, cb) => {
      switch (fragment.type) {
        case 1:
          // command
          msg.addCommand(fragment.payload, fragment.tid.toString(), fragment.args)
          break
        case 2:
          // response
          msg.addResponse(fragment.payload, fragment.tid.toString(), fragment.args)
          break
        default:
          throw new Error('unknown fragment type')
      }
      cb()
    }, (err) => {
      if (err) throw err
      callback(null, msg)
    })
  }
  // if (decoded.wantlist) {
  //   decoded.wantlist.entries.forEach((entry) => {
  //     // note: entry.block is the CID here
  //     const cid = new CID(entry.block)
  //     msg.addEntry(cid, entry.priority, entry.cancel)
  //   })
  // }

  // Bitswap 1.0.0
  // decoded.blocks are just the byte arrays
  // if (decoded.blocks.length > 0) {
  //   return each(decoded.blocks, (b, cb) => {
  //     multihashing(b, 'sha2-256', (err, hash) => {
  //       if (err) {
  //         return cb(err)
  //       }
  //       const cid = new CID(hash)
  //       msg.addBlock(new Block(b, cid))
  //       cb()
  //     })
  //   }, (err) => {
  //     if (err) {
  //       return callback(err)
  //     }
  //     callback(null, msg)
  //   })
  // }

  // Bitswap 1.1.0
  // if (decoded.payload.length > 0) {
  //   return each(decoded.payload, (p, cb) => {
  //     if (!p.prefix || !p.data) {
  //       cb()
  //     }
  //     const values = vd(p.prefix)
  //     const cidVersion = values[0]
  //     const multicodec = values[1]
  //     const hashAlg = values[2]
  //     // const hashLen = values[3] // We haven't need to use this so far
  //     multihashing(p.data, hashAlg, (err, hash) => {
  //       if (err) {
  //         return cb(err)
  //       }
  //
  //       const cid = new CID(cidVersion, codecName[multicodec.toString('16')], hash)
  //
  //       msg.addBlock(new Block(p.data, cid))
  //       cb()
  //     })
  //   }, (err) => {
  //     if (err) {
  //       return callback(err)
  //     }
  //     callback(null, msg)
  //   })
  // }

  callback(null, msg)
}

// ParatiiMessage.Entry = Entry
module.exports = ParatiiMessage
