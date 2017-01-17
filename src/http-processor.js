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
var wrtc = require('wrtc')
var toPull = require('stream-to-pull-stream')

function connectTo (stream) {
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
      limit(stream),
      s
    )
  }
}

module.exports = function (lender, options) {
  var app = express()
  options = options || {}
  options.port = options.port || 5000
  log('options:')
  log(options)

  var publicDir = path.join(__dirname, '..', 'public')
  app.use(express.static(publicDir))

  var port = options.port

  var httpServer = http.createServer(app)
  httpServer.listen(port)

  console.error('http server listening on %d', port)

  createServer({server: httpServer, path: '/volunteer'}, function (stream) {
    log('websocket connection open for volunteer')
    lender.lendStream(connectTo(stream))
  })

  new ws.Server({server: httpServer, path: '/volunteer-webrtc'})
    .on('connection', function (ws) {
      log('webrtc handshake')
      var peer = new Peer({ wrtc: wrtc })

      // Signal through WebSocket
      ws.on('message', function incoming (message) {
        log('MESSAGE', message)
        peer.signal(JSON.parse(message))
      })

      peer.on('signal', function (data) {
        log('SIGNAL', data)
        ws.send(JSON.stringify(data))
      })

      // Connect stream
      peer.on('connect', function () {
        log('webrtc connection open for volunteer')
        ws.close()
        var stream = toPull.duplex(peer)
        lender.lendStream(connectTo(stream))
      })

      peer.on('error', function (err) {
        console.error(err)
        peer.destroy()
      })
    })
  console.log('Listening for WebRTC connections on http://localhost:' + port + '/volunteer-webrtc')

  return lender
}
