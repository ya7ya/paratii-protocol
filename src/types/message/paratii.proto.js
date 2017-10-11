'use strict'

// from: https://github.com/ipfs/go-ipfs/blob/master/exchange/bitswap/message/pb/message.proto

module.exports = `
  message Message {
    message Wantlist {
      message Entry {
        // changed from string to bytes, it makes a difference in JavaScript
        optional bytes block = 1;      // the block cid (cidV0 in bitswap 1.0.0, cidV1 in bitswap 1.1.0)
        optional int32 priority = 2;    // the priority (normalized). default to 1
        optional bool cancel = 3;       // whether this revokes an entry
      }

      repeated Entry entries = 1;       // a list of wantlist entries
      optional bool full = 2;           // whether this is the full wantlist. default to false
    }

    message Block {
      optional bytes prefix = 1;        // CID prefix (cid version, multicodec and multihash prefix (type + length)
      optional bytes data = 2;
    }

    message Hello {
      required bytes eth = 1;
      optional uint32 dropAt = 2;
      optional uint32 payAt = 3;
      optional uint32 buyAt = 4;
      optional uint32 sellAt = 5;
    }

    message Fragment {
      optional bytes tid = 1;
      optional int32 type = 2;
      optional bytes payload = 3;
      optional bytes args = 4;
    }

    optional Hello hello = 1;
    repeated Fragment fragments = 2;
  }
`
