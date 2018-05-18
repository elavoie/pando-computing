var BootstrapClient = require('webrtc-bootstrap')
var Node = require('webrtc-tree-overlay')
var createProcessor = require('../src/processor.js')

module.exports['webrtc'] = function (host, bundle, config) {
  if (!config) {
    console.log('Missing configuration')
  }

  var bootstrap = new BootstrapClient(host, {
    cb: function (err) {
      if (err) console.log(err)
      close()
    }
  })
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

