var SimplePeer = require('simple-peer')
var pull = require('pull-stream')
var lendStream = require('pull-lend-stream')
var limit = require('pull-limit')
var toPull = require('stream-to-pull-stream')
var toObject = require('pull-stream-function-to-object')
var debug = require('debug')
var probe = require('pull-probe')
var setImmediate = require('async.util.setimmediate')
var zlib = require('zlib')

var processorNb = 0

function idSummary (id) {
  if (id) return id.slice(0, 4)
  else return id
}

function createProcessor (node, opts) {
  var log = debug('pando:processor(' + processorNb++ + ')')
  var closed = false
  var performanceStatus = {}

  function close (err) {
    if (closed) return
    closed = true

    if (err) log('closing with error: ' + err)
    else log('closing')

    node.close()

    log('clearing report timeout')
    if (periodicReportTimeout) clearTimeout(periodicReportTimeout)

    log('closing all children')
    for (var id in children) {
      children[id].close()
    }
  }

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
      if (err === true) {
        log('lendStream(true), stream already ended')
        return
      } else if (err) {
        log('lendStream(' + err + '), aborting')
        return
      }
      log('processing started')

      pull(
        stream,
        probe('processing-input'),
        pull.asyncMap(function (x, cb) {
          if (processingEnded) {
            cb(processingEnded)
          } else {
            setImmediate(function () {
              opts.bundle(x, cb)
            })
          }
        }),
        pull.map(function (x) { return String(x) }),
        pull.map(function (x) { return zlib.gzipSync(new Buffer(x)).toString('base64') }),
        probe('processing-output'),
        stream
      )
    })
  }

  function periodicReport () {
    log('periodicReport every ' + opts.reportingInterval + ' ms')
    sendSummary()
    periodicReportTimeout = setTimeout(periodicReport, opts.reportingInterval)
  }

  function addChild (child) {
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
        childrenNb: 0,
	unprocessedInputs: 0
      })
      sendSummary()
    }

    children[child.id] = child
  }

  if (!node) {
    throw new Error('Invalid node')
  }

  opts = opts || {}

  if (!opts.hasOwnProperty('startProcessing')) {
    opts.startProcessing = true
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

  if (!opts.hasOwnProperty('batchSize')) {
    opts.batchSize = 1
  }

  log('creating processor with options')
  log(opts)

  var periodicReportTimeout = null
  var processingEnded = false
  var processingStarted = false
  var parent = null
  var unprocessedInputs = 0

  var lender = lendStream()

  node.on('parent-connect', function (controlChannel) {
    log('connected to parent')
    handlePandoMessages(controlChannel)
    parent = controlChannel
    controlChannel.on('data-channel-signal', function (signal) {
      dataChannel.signal(signal)
    })
    controlChannel.on('status', function (status) {
      log('Unexpected status message from parent')
    })
    controlChannel.on('close', function () {
      log('parent control channel closed')
      close()
    })
    controlChannel.on('error', function (err) {
      log('parent control channel failed with error: ' + err)
      close()
    })

    sendSummary()

    // 1. open data channel
    var dataChannel = new SimplePeer(node.peerOpts)
    dataChannel.on('signal', function (data) {
      sendDataChannelSignal(controlChannel, data)
    })
      .on('connect', function () {
        node.emit('ready')

        var pullDataChannel = toPull.duplex(dataChannel)
        var s = pullDataChannel

        pull(
          s,
          pull.through(function () { unprocessedInputs++ }),
          lender,
          pull.through(function () { unprocessedInputs-- }),
          s
        )

        log('connected to parent data channel')
        startProcessing()
      })
      .on('close', function () {
        log('parent data channel closed')
        close()
      })
      .on('error', function (err) {
        log('parent data channel failed with error: ' + err)
        close()
      })

    node.once('close', function () {
      log('destroying parent channel')
      dataChannel.destroy()
    })
  })

  var latestStatus = {}
  var childrenNb = 0
  var children = {}
  var lastReportTime = new Date()

  function addStatus (id, status) {
    if (typeof id === 'undefined') return
    latestStatus[id] = status
  }

  function sendSummary () {
    var summary = {
      id: node.id,
      unprocessedInputs: unprocessedInputs,
      processing: (processingStarted && !processingEnded),
      childrenNb: childrenNb,
      nbLeafNodes: (processingEnded) ? 0 : 1,
      lendStreamState: lender._state(),
      limits: {},
      childrenUnprocessedInputs: {},
      performance: {
        id: node.id,
        deviceName: performanceStatus.deviceName || '',
        nbItems: performanceStatus.nbItems || 0,
        units: performanceStatus.units || 'items',
        throughput: performanceStatus.throughput || 0,
        throughputStats: performanceStatus.throughputStats || { minimum: 0, average: 0, maximum: 0, 'standard-deviation': 0 },
        cpuUsage: performanceStatus.cpuUsage || 0,
        cpuUsageStats: performanceStatus.cpuUsageStats || { minimum: 0, average: 0, maximum: 0, 'standard-deviation': 0 },
        dataTransferLoad: performanceStatus.dataTransferLoad || 0,
        dataTransferStats: performanceStatus.dataTransferStats || { minimum: 0, average: 0, maximum: 0, 'standard-deviation': 0 }
      },
      children: {}
    }

    var time = new Date()
    var lastReportInterval = time - lastReportTime
    for (var s in latestStatus) {
      var child = latestStatus[s]
      var n = child.nbLeafNodes
      var c = child.childrenNb
      summary.nbLeafNodes += n
      summary.childrenNb += c
      summary.limits[child.id] = child.limit
      summary.childrenUnprocessedInputs[child.id] = child.unprocessedInputs

      // Merge in performance reports
      if (child.performance && child.performance.throughput) {
        summary.performance.throughput += child.performance.throughput
      }
      if (child.performance && child.performance.nbItems) {
        summary.performance.nbItems += child.performance.nbItems
      }
      if (child.performance && 
          child.performance.throughputStats) {
        var stats = summary.performance.throughputStats
        stats.average += Number(child.performance.throughputStats.average)
        stats['standard-deviation'] += Number(child.performance.throughputStats['standard-deviation'])
        stats.maximum += Number(child.performance.throughputStats.maximum)
        stats.minimum += Number(child.performance.throughputStats.minimum)
      }

      if (child.performance && 
          child.performance.cpuUsageStats) {
        var stats = summary.performance.cpuUsageStats
        stats.average += Number(child.performance.cpuUsageStats.average)
        stats['standard-deviation'] += Number(child.performance.cpuUsageStats['standard-deviation'])
        stats.maximum += Number(child.performance.cpuUsageStats.maximum)
        stats.minimum += Number(child.performance.cpuUsageStats.minimum)
      }

      if (child.performance && 
          child.performance.dataTransferStats) {
        var stats = summary.performance.dataTransferStats
        stats.average += Number(child.performance.dataTransferStats.average)
        stats['standard-deviation'] += Number(child.performance.dataTransferStats['standard-deviation'])
        stats.maximum += Number(child.performance.dataTransferStats.maximum)
        stats.minimum += Number(child.performance.dataTransferStats.minimum)
      }
      
      summary.children[child.id] = { 
        id: child.id, 
        timestamp: time,
        lastReportInterval: lastReportInterval,
        performance: child.performance 
      }
    }
    lastReportTime = time

    log('sendSummary: ' + JSON.stringify(summary))
    node.emit('status', summary)
    if (parent) {
      sendStatus(parent, summary)
    }
  }

  function removeChild (child) {
    childrenNb--
    if (latestStatus[child.id]) {
      delete latestStatus[child.id]
    }

    delete children[child.id]

    // Restart processing when we are not
    // coordinating children
    if (childrenNb === 0 && opts.startProcessing) {
      processingEnded = false
      startProcessing()
    }

    child.destroy()
  }

  node.on('child-connect', function (child) {
    log('connected to child(' + idSummary(child.id) + ')')
    addChild(child)
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
        var limit = opts.batchSize
        if (status.nbLeafNodes > 0) {
          limit = (status.nbLeafNodes) * opts.batchSize
        }

        status.limit = limit
        log('updating child(' + idSummary(child.id) + ') limit to ' + status.limit)
        limitedChannel.updateLimit(status.limit)
      }
      addStatus(child.id, status)
    })
    child.on('close', function () {
      log('child(' + idSummary(child.id) + ') control channel closed')
      if (limitedChannel) limitedChannel.source(true, function () {})
      removeChild(child)
      if (dataChannel) dataChannel.destroy()
      if (stream) stream.close()
    })
    child.on('error', function (err) {
      log('child(' + idSummary(child.id) + ') control channel failed with error: ' + err)
      if (limitedChannel) limitedChannel.source(true, function () {})
      removeChild(child)
      if (dataChannel) dataChannel.destroy()
      if (stream) stream.close()
    })

    var limitedChannel = null
    var stream = null
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
        limitedChannel = limit(pullDataChannel, opts.batchSize)

        var unprocessedInputs = 0

        lender.lendStream(function (err, subStream) {
          if (err) {
            log('lendStream(' + err + ')')
            if (!node.parent) { log('parent not connected yet') }
            return close(err)
          }

          log('child(' + idSummary(child.id) + ') subStream opened')
          stream = subStream
          pull(
            subStream,
            probe('pando:child:input'),
            pull.through(function () {
              unprocessedInputs++
              if (child.id && latestStatus[child.id]) {
                latestStatus[child.id].unprocessedInputs = unprocessedInputs
              }
            }),
            limitedChannel,
            pull.through(function () {
              unprocessedInputs--
              if (child.id && latestStatus[child.id]) {
                latestStatus[child.id].unprocessedInputs = unprocessedInputs
              }
            }),
            probe('pando:child:result'),
            subStream
          )
        })
      })
      .on('close', function () {
        log('child(' + idSummary(child.id) + ') data channel closed')
        if (limitedChannel) limitedChannel.source(true, function () {})
        child.destroy()
        if (stream) stream.close()
      })
      .on('error', function (err) {
        log('child(' + idSummary(child.id) + ') data channel failed with error: ' + err)
        if (limitedChannel) limitedChannel.source(err, function () {})
        child.destroy()
        if (stream) stream.close()
      })
    node.once('close', function () {
      dataChannel.destroy()
    })
  })

  node.on('status', function (summary) {
    log('status summary: ' + JSON.stringify(summary))
  })

  node.on('close', close)
  node.on('error', close)

  var processor = toObject(pull(
    pull.through(function () { unprocessedInputs++ }),
    lender,
    pull.map(function (x) { return zlib.gunzipSync(new Buffer(String(x), 'base64')).toString() }),
    pull.through(function () { unprocessedInputs-- })
  ))

  node.sink = processor.sink.bind(lender)
  var source = processor.source.bind(lender)

  node.source = function (abort, cb) {
    if (opts.startProcessing && !processingStarted) startProcessing()
    source(abort, cb)
  }

  node.lendStream = lender.lendStream.bind(lender)

  node.updatePerformance = function (status) {
    performanceStatus = status
  }

  periodicReport()
  return node
}

module.exports = createProcessor
