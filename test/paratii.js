/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 8] */
'use strict'

const waterfall = require('async/waterfall')
const series = require('async/series')
const each = require('async/each')
const parallel = require('async/parallel')

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect

const Bitswap = require('../src')

const createTempRepo = require('./utils/create-temp-repo-nodejs')
const createLibp2pNode = require('./utils/create-libp2p-node')
const makeBlock = require('./utils/make-block')
const orderedFinish = require('./utils/helpers').orderedFinish

const Msg = require('../src/types/message')
// Creates a repo + libp2pNode + Bitswap with or without DHT
function createThing (dht, ethAddress, callback) {
  waterfall([
    (cb) => createTempRepo(cb),
    (repo, cb) => {
      createLibp2pNode({
        DHT: dht ? repo.datastore : undefined
      }, (err, node) => cb(err, repo, node))
    },
    (repo, libp2pNode, cb) => {
      const bitswap = new Bitswap(libp2pNode, repo.blocks, ethAddress)
      bitswap.start((err) => cb(err, repo, libp2pNode, bitswap))
    }
  ], (err, repo, libp2pNode, bitswap) => {
    expect(err).to.not.exist()

    callback(null, {
      repo: repo,
      libp2pNode: libp2pNode,
      bitswap: bitswap
    })
  })
}

describe('bitswap without DHT', function () {
  this.timeout(20 * 1000)

  let nodes

  before((done) => {
    parallel([
      (cb) => createThing(false, 'node0', cb),
      (cb) => createThing(false, 'node1', cb),
      (cb) => createThing(false, 'node2', cb)
    ], (err, results) => {
      expect(err).to.not.exist()
      expect(results).to.have.length(3)
      nodes = results
      done()
    })
  })

  after((done) => {
    each(nodes, (node, cb) => {
      series([
        (cb) => node.bitswap.stop(cb),
        // (cb) => node.libp2pNode.stop(cb),
        (cb) => node.repo.teardown(cb)
      ], cb)
    }, done)
  })

  it('connect 0 -> 1 && 1 -> 2', (done) => {
    parallel([
      (cb) => nodes[0].libp2pNode.dial(nodes[1].libp2pNode.peerInfo, cb),
      (cb) => nodes[1].libp2pNode.dial(nodes[2].libp2pNode.peerInfo, cb)
    ], done)
  })

  it('send Paratii Msg 0 -> 1', (done) => {
    let ethAddress = 'eth_address_goes_here'
    let msg = new Msg({hello: {eth: ethAddress}})

    nodes[1].bitswap.notifications.once('message:new', (peerId, msg) => {
      expect(peerId.toB58String()).to.equal(nodes[0].libp2pNode.peerInfo.id.toB58String())
      expect(msg).to.exist()
      expect(msg.hello).to.exist()
      expect(msg.hello.eth.toString()).to.equal(ethAddress)
      setImmediate(() => {
        done()
      })
    })
    nodes[0].bitswap.network.sendMessage(nodes[1].libp2pNode.peerInfo.id, msg, (err) => {
      if (err) throw err
    })
  })

  it('send Paratii Msg 0 -> 1 : with 1 command', (done) => {
    let ethAddress = 'eth_address_goes_here'
    let msg = new Msg({hello: {eth: ethAddress}})
    msg.addCommand('test', 1)
    nodes[1].bitswap.notifications.once('message:new', (peerId, msg) => {
      expect(peerId.toB58String()).to.equal(nodes[0].libp2pNode.peerInfo.id.toB58String())
      expect(msg).to.exist()
      expect(msg.fragments).to.exist()
      expect(msg.fragments.values()).to.exist()
      expect(Array.from(msg.fragments.values())).to.have.lengthOf(1)
      setImmediate(() => {
        done()
      })
    })
    nodes[0].bitswap.network.sendMessage(nodes[1].libp2pNode.peerInfo.id, msg, (err) => {
      if (err) throw err
    })
  })
})

describe('bitswap with DHT', function () {
  this.timeout(20 * 1000)

  let nodes

  before((done) => {
    parallel([
      (cb) => createThing(true, 'node0', cb),
      (cb) => createThing(true, 'node1', cb),
      (cb) => createThing(true, 'node2', cb)
    ], (err, results) => {
      expect(err).to.not.exist()
      expect(results).to.have.length(3)
      nodes = results
      done()
    })
  })

  after((done) => {
    each(nodes, (node, cb) => {
      series([
        (cb) => node.bitswap.stop(cb),
        (cb) => node.libp2pNode.stop(cb),
        (cb) => node.repo.teardown(cb)
      ], cb)
    }, done)
  })

  it('connect 0 -> 1 && 1 -> 2', (done) => {
    parallel([
      (cb) => nodes[0].libp2pNode.dial(nodes[1].libp2pNode.peerInfo, cb),
      (cb) => nodes[1].libp2pNode.dial(nodes[2].libp2pNode.peerInfo, cb)
    ], done)
  })

  it('send Paratii Msg 0 -> 1', (done) => {
    let ethAddress = 'eth_address_goes_here'
    let msg = new Msg({hello: {eth: ethAddress}})

    nodes[1].bitswap.notifications.once('message:new', (peerId, msg) => {
      expect(peerId.toB58String()).to.equal(nodes[0].libp2pNode.peerInfo.id.toB58String())
      expect(msg).to.exist()
      expect(msg.hello).to.exist()
      expect(msg.hello.eth.toString()).to.equal(ethAddress)
      done()
    })
    nodes[0].bitswap.network.sendMessage(nodes[1].libp2pNode.peerInfo.id, msg, (err) => {
      if (err) throw err
    })
  })

  it('send Paratii Msg 0 -> 1 : with 1 command', (done) => {
    let msg = nodes[0].bitswap.createCommand('test')

    nodes[1].bitswap.notifications.once('message:new', (peerId, msg) => {
      expect(peerId.toB58String()).to.equal(nodes[0].libp2pNode.peerInfo.id.toB58String())
      expect(msg).to.exist()
      expect(msg.fragments).to.exist()
      expect(msg.fragments.values()).to.exist()
      expect(Array.from(msg.fragments.values())).to.have.lengthOf(1)
      done()
    })
    nodes[0].bitswap.network.sendMessage(nodes[1].libp2pNode.peerInfo.id, msg, (err) => {
      if (err) throw err
    })
  })

  it('send Paratii Msg 0 -> 1 : and get response OK', (done) => {
    let msg = nodes[0].bitswap.createCommand('test')
    nodes[1].bitswap.notifications.once('message:new', (peerId, msg) => {
      expect(peerId.toB58String()).to.equal(nodes[0].libp2pNode.peerInfo.id.toB58String())
      expect(msg).to.exist()
      expect(msg.fragments).to.exist()
      expect(msg.fragments.values()).to.exist()
      expect(Array.from(msg.fragments.values())).to.have.lengthOf(1)
    })

    nodes[0].bitswap.notifications.once('message:new', (peerId, msg) => {
      expect(peerId.toB58String()).to.equal(nodes[1].libp2pNode.peerInfo.id.toB58String())
      expect(msg).to.exist()
      expect(msg.fragments).to.exist()
      expect(msg.fragments.values()).to.exist()
      expect(Array.from(msg.fragments.values())).to.have.lengthOf(1)
      expect(Array.from(msg.fragments.values())[0]['payload']).to.deep.equal(Buffer.from('OK'))
      expect(Array.from(msg.fragments.values())[0]['type']).to.equal(2)
      done()
    })

    nodes[0].bitswap.network.sendMessage(nodes[1].libp2pNode.peerInfo.id, msg, (err) => {
      if (err) throw err
    })
  })

  it('send Paratii TRANSCODE Msg 0 -> 1 : and get response OK', (done) => {
    let msgOriginal = nodes[0].bitswap.createCommand('transcode', {hash: 'test hash', author: 'test author'})
    console.log('msg: ', msgOriginal)
    nodes[1].bitswap.notifications.on('message:new', (peerId, msg) => {
      expect(peerId.toB58String()).to.equal(nodes[0].libp2pNode.peerInfo.id.toB58String())
      expect(msg).to.exist()
      expect(msg.fragments).to.exist()
      expect(msg.fragments.values()).to.exist()
      expect(Array.from(msg.fragments.values())).to.have.lengthOf(1)
      expect(Array.from(msg.fragments.values())[0].tid).to.exist()
      let fragArray = Array.from(msg.fragments.values())
      console.log('fragments :', fragArray.map((frag, i) => {
        return {
          tid: frag.tid,
          payload: frag.payload.toString(),
          args: (frag.args) ? frag.args.toString() : null
        }
      }))
      // console.log('fragments', msg.fragments)
    })

    nodes[0].bitswap.notifications.on('message:new', (peerId, msg) => {
      expect(peerId.toB58String()).to.equal(nodes[1].libp2pNode.peerInfo.id.toB58String())
      expect(msg).to.exist()
      expect(msg.fragments).to.exist()
      expect(msg.fragments.values()).to.exist()
      expect(Array.from(msg.fragments.values())).to.have.lengthOf(1)
      expect(Array.from(msg.fragments.values())[0]['payload']).to.deep.equal(Buffer.from('OK'))
      expect(Array.from(msg.fragments.values())[0]['type']).to.equal(2)
      let frag = Array.from(msg.fragments.values())[0]
      if (frag.tid.toString() === Array.from(msgOriginal.fragments.values())[0]['tid'].toString()) {
        done()
      }
    })

    nodes[0].bitswap.network.sendMessage(nodes[1].libp2pNode.peerInfo.id, msgOriginal, (err) => {
      if (err) throw err
    })
  })
})
