var BootstrapClient = require('webrtc-bootstrap')
var Node = require('webrtc-tree-overlay')
var createProcessor = require('../src/processor.js')

module.exports['webrtc'] = function (host, bundle, config) {
  if (!config) {
    console.log('Missing configuration')
  }

  var bootstrap = new BootstrapClient(host)
  var nodeOpts = {
    maxDegree: config['degree']
  }
  console.log('Node() opts:')
  console.log(JSON.stringify(nodeOpts))
  var node = new Node(bootstrap, nodeOpts).join()
  console.log('creating processor')
  var processor = createProcessor(node, {
    startProcessing: true,
    bundle: bundle['/pando/1.0.0']
  })
  return processor
}

