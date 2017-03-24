var SimplePeer = require('simple-peer')
var pull = require('pull-stream')
var lendStream = require('pull-lend-stream')
var limit = require('pull-limit')
var toPull = require('stream-to-pull-stream')
var toObject = require('pull-stream-function-to-object')
var debug = require('debug')
var probe = require('pull-probe')

var processorNb = 0

function idSummary (id) {
  if (id) return id.slice(0, 4)
  else return id
}

function createProcessor (node, opts) {
  var log = debug('pando:processor(' + processorNb++ + ')')

  function handlePandoMessages (channel) {
    function parse (data) {
      var message = JSON.parse(data)
      if (message.type === 'DATA-CHANNEL-SIGNAL') {
        log('channel(' + idSummary(channel.id) + ') received DATA-CHANNEL-SIGNAL')
        channel.emit('data-channel-signal', message.signal)
      } else if (message.type === 'STATUS') {
        log('channel(' + idSummary(channel.id) + ') received STATUS')
        log(message)
        channel.emit('status', message)
      } else {
        log('channel(' + idSummary(channel.id) + ') INVALID MESSAGE: ' + data.toString())
      }
    }
    channel.on('data', parse)
  }

  function sendStatus (channel, status) {
    if (!channel) return

    log('channel(' + idSummary(channel.id) + ') sending STATUS')
    var message = {
      type: 'STATUS'
    }

    for (var p in status) {
      message[p] = status[p]
    }

    log(message)
    channel.send(JSON.stringify(message))
  }

  function sendDataChannelSignal (channel, signal) {
    log('channel(' + idSummary(channel.id) + ') sending DATA-CHANNEL-SIGNAL')
    var message = {
      type: 'DATA-CHANNEL-SIGNAL',
      signal: signal
    }

    channel.send(JSON.stringify(message))
  }

  function startProcessing () {
    log('starting processing')
    processingStarted = true
    lender.lendStream(function (err, stream) {
      if (err) {
        log('error opening subStream')
        log(err)
        throw err
      }
      log('processing started')

      pull(
        stream,
        probe('processing-input'),
        pull.asyncMap(function (x, cb) {
          x = JSON.parse(x)
          if (processingEnded) {
            cb(processingEnded)
          } else {
            opts.bundle(x, cb)
          }
        }),
        pull.map(function (x) { return String(x) }),
        probe('processing-output'),
        stream
      )
    })

    periodicReport()
  }

  function periodicReport () {
    sendSummary()
    periodicReportTimeout = setTimeout(periodicReport, opts.reportingInterval)
  }

  if (!node) {
    throw new Error('Invalid node')
  }

  opts = opts || {}

  if (!opts.hasOwnProperty('startProcessing')) {
    opts.startProcessing = true
  }

  if (!opts.hasOwnProperty('initialChildLimit')) {
    opts.initialChildLimit = 1
  }

  if (!opts.hasOwnProperty('reportingInterval')) {
    opts.reportingInterval = 3 * 1000 // ms
  }

  opts.bundle = opts.bundle || function (x, cb) {
    log('computing ' + x + ' squared')
    setTimeout(function () {
      var r = JSON.stringify(x * x)
      log('computed ' + r)
      cb(null, r)
    }, 100)
  }

  log('creating processor with options')
  log(opts)

  var periodicReportTimeout = null
  var processingEnded = false
  var processingStarted = false

  var lender = lendStream()

  node.on('parent-connect', function (controlChannel) {
    log('connected to parent')
    handlePandoMessages(controlChannel)
    controlChannel.on('data-channel-signal', function (signal) {
      dataChannel.signal(signal)
    })
    controlChannel.on('status', function (status) {
      log('Unexpected status message from parent')
    })

    sendSummary()

    // 1. open data channel
    var dataChannel = new SimplePeer(node.peerOpts)
    dataChannel.on('signal', function (data) {
      sendDataChannelSignal(controlChannel, data)
    })
      .on('connect', function () {
        var pullDataChannel = toPull.duplex(dataChannel)
        var s = pullDataChannel

        pull(
          s,
          lender,
          s
        )

        log('connected to parent data channel')
        startProcessing()
      })

    node.once('close', function () {
      log('destroying parent channel')
      dataChannel.destroy()
    })
  })

  var latestStatus = {}
  var childrenNb = 0

  function addStatus (id, status) {
    latestStatus[id] = status
  }

  function sendSummary () {
    var summary = {
      processing: (processingStarted && !processingEnded),
      childrenNb: childrenNb,
      nbLeafNodes: (processingEnded) ? 0 : 1,
      limits: {}
    }

    for (var s in latestStatus) {
      var n = latestStatus[s].nbLeafNodes
      var c = latestStatus[s].childrenNb
      summary.nbLeafNodes += n
      summary.childrenNb += c
      summary.limits[idSummary(s)] = latestStatus[s].limit
    }

    node.emit('status', summary)
    if (node.parent) {
      sendStatus(node.parent, summary)
    }
  }

  function removeChild (child) {
    childrenNb--
    if (latestStatus[child.id]) {
      delete latestStatus[child.id]
    }

    // Restart processing when we are not
    // coordinating children
    if (childrenNb === 0) {
      // processingEnded = false
    }

    child.destroy()
  }

  function shutdown () {
    log('clearing report timeout')
    if (periodicReportTimeout) clearTimeout(periodicReportTimeout)
  }

  node.on('child-connect', function (child) {
    childrenNb++
    if (childrenNb >= node.maxDegree) {
      // For all new connections that are not from an intermediate node
      // rejoining after a disconnection from its parent, the new child will
      // have no children.  Report a single leaf node to our parent
      // optimistically.  If the child has more, it will eventually give us a
      // status update with the exact number. This allows quickly scaling up
      // when many nodes are joining at a fast rate.
      addStatus(child.id, {
        nbLeafNodes: 1,
        childrenNb: 0
      })
      sendSummary()
    }

    log('connected to child(' + idSummary(child.id) + ')')
    handlePandoMessages(child)
    child.on('data-channel-signal', function (signal) {
      if (dataChannel) {
        dataChannel.signal(signal)
      } else {
        log('WARNING: Missed data-channel-signal from child(' + idSummary(child.id) + ')')
      }
    })
    child.on('status', function (status) {
      if (limitedChannel) {
        // Ensure each leaf node (which performs the computations) has at least
        // maxDegree tasks to work on so that they can dispatch them quickly if
        // maxDegree children join. If maxDegree children join under them, we
        // will receive a status update with the new number of leaf nodes and
        // the limit will be updated accordingly.
        status.limit = (status.nbLeafNodes) * node.maxDegree
        log('updating child(' + idSummary(child.id) + ') limit to ' + status.limit)
        limitedChannel.updateLimit(status.limit)
      }
      addStatus(child.id, status)
    })
    child.on('close', function () {
      removeChild(child)
      log('destroying child(' + idSummary(child.id) + ') data channel')
      dataChannel.destroy()
    })
    child.on('error', function () {
      removeChild(child)
    })

    var limitedChannel = null
    var peerOpts = {}
    for (var p in node.peerOpts) {
      peerOpts[p] = node.peerOpts[p]
    }
    peerOpts.initiator = true
    var dataChannel = new SimplePeer(peerOpts)
    dataChannel
      .on('signal', function (data) {
        sendDataChannelSignal(child, data)
      })
      .on('connect', function () {
        log('connected to child(' + idSummary(child.id) + ') data channel')
        log('stopping processing')
        processingEnded = true

        var pullDataChannel = toPull.duplex(dataChannel)
        limitedChannel = limit(pullDataChannel, opts.initialChildLimit)

        lender.lendStream(function (err, subStream) {
          if (err) {
            log('lendStream(' + err + ')')
            if (!node.parent) { log('parent not connected yet') }
            throw err
          }

          log('child(' + idSummary(child.id) + ') subStream opened')
          pull(
            subStream,
            probe('lending-input'),
            limitedChannel,
            probe('lending-result'),
            subStream
          )
        })
      })
    node.once('close', function () {
      dataChannel.destroy()
    })
  })

  node.on('status', function (summary) {
    log('status summary: ' + JSON.stringify(summary))
  })

  node.on('close', shutdown)
  node.on('error', shutdown)

  var processor = toObject(pull(
    pull.map(function (x) { return JSON.stringify(x) }),
    lender,
    pull.map(function (x) { return JSON.parse(x) })
  ))

  node.sink = processor.sink.bind(lender)
  var source = processor.source.bind(lender)

  node.source = function (abort, cb) {
    if (opts.startProcessing && !processingStarted) startProcessing()
    source(abort, cb)
  }

  periodicReport()
  return node
}

module.exports = createProcessor
