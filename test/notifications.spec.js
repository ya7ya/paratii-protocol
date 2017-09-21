/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const map = require('async/map')
const parallel = require('async/parallel')
const PeerId = require('peer-id')

const Notifications = require('../src/notifications')

const makeBlock = require('./utils/make-block')

describe('Notifications', () => {
  let blocks
  let peerId
  let remotePeerId

  before((done) => {
    parallel([
      (cb) => map([0, 1, 2], (i, cb) => makeBlock(cb), (err, res) => {
        expect(err).to.not.exist()
        blocks = res
        cb()
      }),
      (cb) => PeerId.create({bits: 1024}, (err, id) => {
        expect(err).to.not.exist()
        console.log('Peer ID: ', id.toB58String())
        peerId = id
        cb()
      }),
      (cb) => PeerId.create({bits: 1024}, (err, id) => {
        expect(err).to.not.exist()
        console.log('remote Peer ID: ', id.toB58String())
        remotePeerId = id
        cb()
      })
    ], done)
  })

  it('hasBlock', (done) => {
    const n = new Notifications(peerId)
    const b = blocks[0]
    n.once(`block:${b.cid.buffer.toString()}`, (block) => {
      expect(b).to.eql(block)
      done()
    })
    n.hasBlock(b)
  })

  it('receivedNewBlock', (done) => {
    const n = new Notifications(peerId)
    const b = blocks[0]
    n.once('receivedNewBlock', (peer, block) => {
      expect(b).to.eql(block)
      expect(remotePeerId).to.eql(peer)
      done()
    })
    n.receivedNewBlock(remotePeerId, b)
  })

  describe('wantBlock', () => {
    it('receive block', (done) => {
      const n = new Notifications(peerId)
      const b = blocks[0]

      n.wantBlock(b.cid, (block) => {
        expect(b).to.eql(block)

        // check that internal cleanup works as expected
        expect(Object.keys(n._blockListeners)).to.have.length(0)
        expect(Object.keys(n._unwantListeners)).to.have.length(0)
        done()
      }, () => {
        done(new Error('should never happen'))
      })

      n.hasBlock(b)
    })

    it('unwant block', (done) => {
      const n = new Notifications()
      const b = blocks[0]

      n.wantBlock(b.cid, () => {
        done(new Error('should never happen'))
      }, done)

      n.unwantBlock(b.cid)
    })
  })
})
