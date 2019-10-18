#!/usr/bin/env node
var pull = require('pull-stream')
var debug = require('debug')
var log = debug('pando-computing')
var logMonitoring = debug('pando-computing:monitoring')
var logMonitoringChildren = debug('pando-computing:monitoring:children')
var logHeartbeat = debug('pando-computing:heartbeat')
var parse = require('../src/parse.js')
var bundle = require('../src/bundle.js')
var electronWebRTC = require('electron-webrtc')
var createProcessor = require('../src/processor.js')
var Node = require('webrtc-tree-overlay')
var Server = require('pando-server')
var BootstrapClient = require('webrtc-bootstrap')
var os = require('os')
var fs = require('fs')
var path = require('path')
var website = require('simple-updatable-website')
var http = require('http')
var WebSocket = require('ws')
var express = require('express')
var probe = require('pull-probe')
var mkdirp = require('mkdirp')
var sync = require('pull-sync')
var toPull = require('stream-to-pull-stream')
var limit = require('pull-limit')
var package = require('../package.json')

var duplexWs = require('pull-ws')

var args = parse(process.argv.slice(2))

var wrtc = electronWebRTC({ headless: args.headless })

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

process.stdout.on('error', function (err) {
  log('process.stdout:error(' + err + ')')
  if (err.code === 'EPIPE') {
    process.exit(1)
  }
})

bundle(args.module, function (err, bundlePath) {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  var statusSocket = null
  var wsVolunteersStatus = {}
  var processor = null
  if (args.local) {
    log('local execution')
    processor = pull.asyncMap(require(args.module)['/pando/1.0.0'])

    var io = ({
      source: args.items,
      sink: pull(
        pull.map(function (x) { return String(x) + '\n' }),
        toPull.sink(process.stdout, function (err) {
          log('process.stdout:done(' + err + ')')
          if (err) {
            console.error(err.message)
            console.error(err)
            process.exit(1)
          }
          process.exit(0)
        })
      )
    })

    if (args['sync-stdio']) {
      log('synchronizing stdio')
      io = sync(io)
    }

    log('executing function locally')
    pull(
      io,
      pull.through(log),
      probe('pando:input'),
      processor,
      probe('pando:result'),
      pull.through(log),
      io
    )
  } else {
    var server = null
    var host = null
    if (!args.host) {
      log('creating bootstrap server')
      var publicDir = path.join(__dirname, '../local-server/public')
      mkdirp.sync(publicDir)
      server = new Server({
        secret: args.secret,
        publicDir: publicDir,
        port: args.port,
        seed: args.seed
      })
      host = 'localhost:' + args.port

      server._bootstrap.upgrade('/volunteer',
        function (ws) {
          if (processor) {
            log('volunteer connected over WebSocket')

            ws.isAlive = true
            var heartbeat = setInterval(function ping() {
              if (ws.isAlive === false) {
                logHeartbeat('ws: volunteer connection lost')
                return ws.terminate()
              }
              ws.isAlive = false
              ws.ping(function () {})
            }, args.heartbeat)
            ws.addEventListener('close', function () {
              clearInterval(heartbeat)
              heartbeat = null   
            })
            ws.addEventListener('error', function () {
              clearInterval(heartbeat)
              heartbeat = null   
            })
            ws.addEventListener('pong', function () {
              logHeartbeat('ws: volunteer connection pong')
              ws.isAlive = true
            })

            processor.lendStream(function (err, stream) {
              if (err) return log('error lender sub-stream to volunteer: ' + err)
              log('lending sub-stream to volunteer')

              pull(
                stream,
                probe('volunteer-input'),
                limit(duplexWs(ws), args['batch-size']),
                probe('volunteer-output'),
                stream
              )
            })
          }
        })

      server._bootstrap.upgrade('/volunteer-monitoring',
        function (ws) {
          log('volunteer monitoring connected over WebSocket')

          ws.isAlive = true
          var heartbeat = setInterval(function ping() {
              if (ws.isAlive === false) {
                logHeartbeat('ws: volunteer monitoring connection lost')
                return ws.terminate()
              }
              ws.isAlive = false
              ws.ping(function () {})
          }, args.heartbeat)
          ws.addEventListener('close', function () {
            clearInterval(heartbeat)
            heartbeat = null   
          })
          ws.addEventListener('error', function () {
            clearInterval(heartbeat)
            heartbeat = null   
          })
          ws.addEventListener('pong', function () {
            logHeartbeat('ws: volunteer monitoring pong')
            ws.isAlive = true
          })

          var id = null
          var lastReportTime = new Date()
          pull(
            duplexWs.source(ws),
            pull.drain(function (data) {
              var info = JSON.parse(data) 
              id = info.id
              var time = new Date()
              wsVolunteersStatus[info.id] = {
                id: info.id,
                timestamp: time,
                lastReportInterval: time - lastReportTime,
                performance: info
              }
              lastReportTime = time
            }, function () {
              if (id) {
                delete wsVolunteersStatus[id]
              }
            })
          )
        })

      getIPAddresses().forEach(function (addr) {
        console.error('Serving volunteer code at http://' + addr + ':' + args.port)
      })
    } else {
      log('using an external public bootstrap server')
      host = args.host
      console.error('Serving volunteer code at http://' + host)
    }

    log('Serializing configuration for workers')
    fs.writeFileSync(
      path.join(__dirname, '../public/config.js'),
      'window.pando = { config: ' + JSON.stringify({
        batchSize: args['batch-size'],
        degree: args.degree,
        globalMonitoring: args['global-monitoring'],
        iceServers: args['ice-servers'],
        reportingInterval: args['reporting-interval'] * 1000,
        requestTimeoutInMs: args['bootstrap-timeout'] * 1000,
        version: package.version
      }) + ' }'
    )

    log('Uploading files to ' + host + ' with secret ' + args.secret)
    website.upload([
      bundlePath,
      path.join(__dirname, '../public/config.js'),
      path.join(__dirname, '../public/index.html'),
      path.join(__dirname, '../public/volunteer.js'),
      path.join(__dirname, '../public/simplewebsocket.min.js'),
      path.join(__dirname, '../node_modules/bootstrap/dist/css/bootstrap.min.css'),
      path.join(__dirname, '../node_modules/bootstrap/dist/js/bootstrap.min.js'),
      path.join(__dirname, '../node_modules/jquery/jquery.min.js'),
      path.join(__dirname, '../node_modules/popper.js/dist/umd/popper.min.js')
    ], host, args.secret, function (err) {
      if (err) throw err
      log('files uploaded successfully')

      log('connecting to bootstrap server')
      var bootstrap = new BootstrapClient(host)

      log('creating root node')
      var root = new Node(bootstrap, {
        requestTimeoutInMs: args['bootstrap-timeout'] * 1000, // ms
        peerOpts: { wrtc: wrtc, config: { iceServers: args['ice-servers'] } },
        maxDegree: args.degree
      }).becomeRoot(args.secret)

      processor = createProcessor(root, {
        batchSize: args['batch-size'],
        bundle: !args['start-idle'] ? require(bundlePath)['/pando/1.0.0'] : 
          function (x, cb) { console.error('Internal error, bundle should not have been executed') },
        globalMonitoring: args['global-monitoring'],
        reportingInterval: args['reporting-interval'] * 1000, // ms
        startProcessing: !args['start-idle']
      })

      processor.on('status', function (rootStatus) {
        var volunteers = {}

        // Adding volunteers connected over WebSockets
        for (var id in wsVolunteersStatus) {
          volunteers[id] = wsVolunteersStatus[id]
        }

        // Adding volunteers connected over WebRTC
        for (var id in rootStatus.children) {
          volunteers[id] = rootStatus.children[id]
        }

        var status = JSON.stringify({
          root: rootStatus,
          volunteers: volunteers,
          timestamp: new Date()
        })

        logMonitoring(status)
        logMonitoringChildren('children nb: ' + rootStatus.childrenNb + ' leaf nb: ' + rootStatus.nbLeafNodes)

        if (statusSocket) {
          log('sending status to monitoring page')
          statusSocket.send(status)
        }
      })

      function close () {
        log('closing')
        if (server) server.close()
        if (root) root.close()
        if (bootstrap) bootstrap.close()
        if (wrtc) wrtc.close()
        if (processor) processor.close()
      }

      var io = {
        source: args.items,
        sink: pull.drain(
          function (x) { process.stdout.write(String(x) + '\n') },
          function (err) {
            log('drain:done(' + err + ')')
            if (err) {
              console.error(err.message)
              console.error(err)
              close()
              process.exit(1)
            } else {
              close()
              process.exit(0)
            }
          }
        )
      }

      if (args['sync-stdio']) {
        io = sync(io)
      }

      pull(
        io,
        pull.through(log),
        probe('pando:input'),
        processor,
        probe('pando:result'),
        pull.through(log),
        io
      )
    })

    log('Starting monitoring server')
    var app = express()
    app.use(express.static(path.join(__dirname, '../root')))
    var monitoringPort = args.port + 1
    var wss = WebSocket.Server({ server: http.createServer(app).listen(monitoringPort) })
    wss.on('connection/root-status', function (socket) {
      statusSocket = socket
      socket.onerror = function () {
        statusSocket = null
      }
      socket.onclose = function () {
        statusSocket = null
      }
    })
    getIPAddresses().forEach(function (addr) {
      console.error('Serving monitoring page at http://' + addr + ':' + monitoringPort)
    })
  }
})
