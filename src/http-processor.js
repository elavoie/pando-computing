var http = require('http')
var express = require('express')
var createServer = require('pull-ws/server')
var pull = require('pull-stream')
var limit = require('pull-limit')
var path = require('path')
var debug = require('debug')
var log = debug('pando:http-processor')
var ws = require('ws')
var Peer = require('simple-peer')
var toPull = require('stream-to-pull-stream')
var os = require('os')

function connectTo (stream, options) {
  return function (err, s) {
    if (err) {
      if (stream.close) return stream.close(err)

      pull(
        pull.error(err),
        stream
      )
      return
    }

    pull(
      s,
      limit(stream, options.limit),
      s
    )
  }
}

function getIPAddresses () {
  var ifaces = os.networkInterfaces()
  var addresses = []

  Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0

    ifaces[ifname].forEach(function (iface) {
      if (iface.family !== 'IPv4' || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return
      }

      if (alias >= 1) {
        // this single interface has multiple ipv4 addresses
        addresses.push(iface.address)
      } else {
        // this interface has only one ipv4 adress
        addresses.push(iface.address)
      }
    })
  })
  return addresses
}

module.exports = function (lender, options) {
  var app = express()
  options = options || {}
  options.port = options.port || 5000
  options.wrtc = options.wrtc || require('electron-webrtc')()
  options.limit = options.limit || 1
  log('options:')
  log(options)

  var publicDir = path.join(__dirname, '..', 'public')
  app.use(express.static(publicDir))

  var port = options.port

  var httpServer = http.createServer(app)
  httpServer.listen(port)

  createServer({server: httpServer, path: '/volunteer'}, function (stream) {
    log('websocket connection open for volunteer')
    lender.lendStream(connectTo(stream, options))
  })

  new ws.Server({server: httpServer, path: '/volunteer-webrtc'})
    .on('connection', function (ws) {
      log('webrtc handshake')
      var peer = new Peer({ wrtc: options.wrtc })

      // Signal through WebSocket
      ws.on('message', function incoming (data) {
        log('MESSAGE', message)
        var message = JSON.parse(data)
        var offer = message.offer
        peer.signal(offer)
      })

      peer.on('signal', function (answer) {
        log('SIGNAL', answer)
        ws.send(JSON.stringify({ answer: answer }))
      })

      // Connect stream
      peer.on('connect', function () {
        log('webrtc connection open for volunteer')
        ws.close()
        var stream = toPull.duplex(peer)
        lender.lendStream(connectTo(stream, options))
      })

      peer.on('error', function (err) {
        console.error(err)
        peer.destroy()
      })
    })

  getIPAddresses().forEach(function (addr) {
    console.error('Serving volunteer code at http://' + addr + ':' + port)
  })

  return lender
}
