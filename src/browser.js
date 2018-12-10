var BootstrapClient = require('webrtc-bootstrap')
var Node = require('webrtc-tree-overlay')
var createProcessor = require('../src/processor.js')
var Socket = require('simple-websocket')
var log = require('debug')('pando:browser')
var zlib = require('zlib')
var EE = require('event-emitter')

module.exports['webrtc'] = function (host, bundle, config) {
  if (!config) {
    console.log('Missing configuration')
  }

  var bootstrap = new BootstrapClient(host, { secure: config.secure })
  var nodeOpts = {
    requestTimeoutInMs: config.requestTimeoutInMs,
    peerOpts: { config: { iceServers: config.iceServers } },
    maxDegree: config.degree
  }
  console.log('Node() opts:')
  console.log(JSON.stringify(nodeOpts))
  var node = new Node(bootstrap, nodeOpts).join()
  console.log('creating processor')
  var processor = createProcessor(node, {
    bundle: bundle['/pando/1.0.0'],
    globalMonitoring: config.globalMonitoring,
    reportingInterval: config.reportingInterval,
    startProcessing: true,
    batchSize: config.batchSize
  })

  var closed = false
  function close () {
    if (closed) return
    closed = true

    bootstrap.close()
    node.close()
  }
  processor.on('close', close)
  processor.on('error', close)
  return processor
}

module.exports['websocket'] = function (host, bundle) {
  var socket = new Socket(host)
  var processor = EE({})

  processor.close = function () {
    processor.emit('close')
    log('closing')
  }

  socket
    .on('connect', function () {
      processor.emit('ready')
      log('starting processing')
    })
    .on('data', function (x) {
      log('processing input: ' + x)
      setTimeout(function () {
        bundle['/pando/1.0.0'](x, function (err, x) {
          if (err) return socket.destroy()
          socket.send(zlib.gzipSync(new Buffer(String(x))).toString('base64'))
        })
      }, 0)
    })
    .on('close', function () {
      processor.close()
    })
    .on('error', function (err) {
      log('error: ' + err)
      processor.emit('error', err)
    })

  return processor
}
