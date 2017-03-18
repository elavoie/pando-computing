#!/usr/bin/env node
var pull = require('pull-stream')
var debug = require('debug')
var log = debug('pando')
// var lendStream = require('pull-lend-stream')
var parse = require('../src/parse.js')
// var httpProcessor = require('../src/http-processor.js')
// var publicServerProcessor = require('../src/public-server-processor.js')
var bundle = require('../src/bundle.js')
var electronWebRTC = require('electron-webrtc')
var SegfaultHandler = require('segfault-handler')
SegfaultHandler.registerHandler('crash.log') // With no argument, SegfaultHandler will generate a generic log file name
var createProcessor = require('../src/processor.js')
var Node = require('webrtc-tree-overlay')
var Server = require('pando-server')
var BootstrapClient = require('webrtc-bootstrap')
var os = require('os')
var fs = require('fs')
var path = require('path')
var website = require('simple-updatable-website')

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
  if (err.code === 'EPIPE') {
    process.exit(1)
  }
})

bundle(args.module, function (err, bundlePath) {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  var processor = null
  if (args.local) {
    processor = pull.asyncMap(require(args.module)['/pando/1.0.0'])
  } else {
    var server = null
    var host = null
    if (!args.host) {
      log('creating bootstrap server')
      server = new Server({
        secret: args.secret,
        publicDir: path.join(__dirname, '../local-server/public'),
        port: args.port,
        seed: args.seed
      })
      host = 'localhost:' + args.port
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
        degree: args.degree
      }) + ' }'
    )

    log('Uploading files')
    website.upload([
      bundlePath,
      path.join(__dirname, '../public/config.js'),
      path.join(__dirname, '../public/index.html'),
      path.join(__dirname, '../public/volunteer.js')
    ], host, args.secret, function (err) {
      if (err) throw err
      log('files uploaded successfully')

      log('connecting to bootstrap server')
      var bootstrap = new BootstrapClient(host)

      log('creating root node')
      var root = new Node(bootstrap, {
        peerOpts: { wrtc: wrtc },
        maxDegree: args.degree
      }).becomeRoot(args.secret)

      processor = createProcessor(root, {
        startProcessing: !args['start-idle'],
        bundle: require(bundlePath)['/pando/1.0.0']
      })

      function close () {
        log('closing')
        if (server) server.close()
        if (root) root.close()
        if (bootstrap) bootstrap.close()
        if (wrtc) wrtc.close()
        if (processor) processor.close()
      }

      pull(
        args.items,
        pull.through(log),
        processor,
        pull.through(log),
        pull.through(function (x) { process.stdout.write(String(x) + '\n') }),
        pull.drain(null,
          function (err) {
            if (err) {
              console.error(err)
              close()
              process.exit(1)
            }
            close()
            process.exit(0)
          })
      )
    })
  }
})
