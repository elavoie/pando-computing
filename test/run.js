var createProcessor = require('../src/processor.js')
var Node = require('webrtc-tree-overlay')
var Server = require('pando-server')
var BootstrapClient = require('webrtc-bootstrap')
var pull = require('pull-stream')
var probe = require('pull-probe')
var debug = require('debug')
var log = debug('test')
var wrtc = require('wrtc')

module.exports = function run (valueNb, workerNb, degree, seed) {
  return function (t) {
    valueNb = valueNb || 24 // Number of values to compute
    workerNb = workerNb || 6 // Number of workers to use
    degree = degree || 2 // Maximum number of children per node
    seed = seed || 1337 // Random id generation seed

    var port = 5000
    var secret = 'secret'

    log('creating server')
    t.ok(Server)
    var server = new Server({ secret: secret, port: port, seed: seed })

    server.on('listening', function () {
      t.ok(server)
      log('connecting to bootstrap server')
      var bootstrap = new BootstrapClient('localhost:' + port)
      t.ok(bootstrap)
      log('creating root node')
      var root = new Node(bootstrap, {
        peerOpts: { wrtc: wrtc },
        maxDegree: degree
      }).becomeRoot(secret)
      t.ok(root)
      log('creating processor')
      var processor = createProcessor(root, { startProcessing: false })
      t.ok(processor)

      var actual = []
      var expected = []
      for (var i = 0; i < valueNb; ++i) {
        expected.push(i * i)
      }

      var workers = []
      for (i = 0; i < workerNb; ++i) {
        log('created node ' + i)
        workers[i] = createProcessor(
          new Node(bootstrap, {
            peerOpts: { wrtc: wrtc },
            maxDegree: degree
          }),
          {
            initialChildLimit: 1
          }
        ).join()
      }

      var timeout = setTimeout(function () {
        throw new Error('Test timed out')
      }, 60 * 1000)

      var closed = false
      function close () {
        if (!closed) {
          closed = true
          clearTimeout(timeout)
          t.deepEqual(actual, expected)
          try {
            console.log('closing bootstrap client')
            bootstrap.close()
            console.log('closing server')
            server.close()
            console.log('closing root node')
            root.close()
            console.log('closing workers')
            workers.forEach(function (w) {
              w.close()
            })
          } catch (e) {
            console.log(e)
            console.log(e.message)
          }
          t.end()
        }
      }

      var statusLog = debug('root-status')
      processor.on('status', statusLog)

      pull(
        // pull.count counts from [0, valueNb] so substracting one
        // to have the correct number of values
        pull.count(valueNb - 1),
        pull.through(function (x) {
          log('input: ' + x)
        }),
        probe('test-before-processor'),
        pull.map(function (x) { return JSON.stringify(x) }),
        processor,
        pull.map(function (x) { return JSON.parse(x) }),
        probe('test-after-processor'),
        pull.through((function () {
          var lastPercent = 0
          var count = 0
          return function (x) {
            count++
            var log = debug('completion')
            var newPercent = Math.floor((count / valueNb) * 100)
            if (newPercent > lastPercent) {
              log('completed ' + newPercent + '%')
              lastPercent = newPercent
            }
          }
        })()),
        pull.through(function (x) {
          log('output: ' + x)
          actual.push(x)
        }),
        pull.through((function () {
          // Work around closing bug in lend-stream (or in one of the
          // sub-streams) by making sure we close after all output values are
          // computed
          var count = 0
          return function (x) {
            count++
            if (count >= valueNb) {
              close()
            }
          }
        })()),
        pull.drain(null, function () {
          log('stream ended')
          close()
        })
      )
    })
  }
}
