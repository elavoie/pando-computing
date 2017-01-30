var pull = require('pull-stream')
var sync = require('pull-sync')
var path = require('path')
var debug = require('debug')
var log = debug('pando:heroku-processor')
var request = require('request')
var fs = require('fs')
var ws = require('pull-ws')
var Peer = require('simple-peer')
var SimpleWebSocket = require('simple-websocket')
var toPull = require('stream-to-pull-stream')
var limit = require('pull-limit')
var probe = require('pull-probe')

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
      probe('heroku-wrtc-stream:before'),
      limit(stream),
      probe('heroku-wrtc-stream:after'),
      s
    )
  }
}

function upload (files, target, cb) {
  log('upload([' + files + '], ' + target + ', [' + (typeof cb) + ']')
  var r = request.post(target, function (err) {
    if (err) throw err
    log('uploading done')
    cb()
  })
  var form = r.form()

  files.forEach(function (file) {
    var filename = path.basename(file)
    log('uploading ' + file)
    form.append(filename, fs.createReadStream(file), { filename: filename })
  })
}

module.exports = function (lender, options) {
  options = options || {}
  options.wrtc = options.wrtc || require('electron-webrtc')()
  var configFile = path.join(__dirname, '../heroku/config.json')
  try {
    var config = JSON.parse(fs.readFileSync(configFile))
  } catch (e) {
    throw new Error('Missing ' + configFile + ' or invalid JSON format')
  }
  var clientId = config['clientId']
  var host = config['host']
  var target = 'http://' + host + '/' + clientId + '/upload'
  var publicDir = path.join(__dirname, '..', 'public')

  // Update heroku server with the latest info
  upload([
    path.join(publicDir, 'volunteer.js'),
    path.join(publicDir, 'bundle.js'),
    path.join(publicDir, 'index.html')
  ], target, function () {
    var target = 'ws://' + host + '/' + clientId
    log('connecting to ' + target)
    // Lend stream over a websocket
    ws.connect(target, (err, stream) => {
      if (err) {
        throw err
      }

      log('connected, lending stream')
      lender.lendStream(function (err, s) {
        if (err) {
          throw err
        }

        pull(
          s,
          probe('heroku-ws-stream:before'),
          sync(pull(
            probe('heroku-ws-stream-synced:before'),
            stream,
            probe('heroku-ws-stream-synced:after')
          )),
          probe('heroku-ws-stream:after'),
          s
        )
        log('stream connected to heroku server')
      })
    })

    var webrtcSignals = new SimpleWebSocket(target + '/webrtc-signaling')
    log('connecting to webrtc signaling socket')
    webrtcSignals.on('connect', function () {
      log('connected to webrtc signaling socket')

      webrtcSignals.on('error', function (err) {
        console.error('webrtc signal error: ' + err)
      })

      webrtcSignals.on('data', function (data) {
        var message = JSON.parse(data)
        var origin = message.origin
        var offer = message.offer

        var peer = new Peer({ wrtc: options.wrtc })
        var stream = toPull.duplex(peer)
        peer.on('signal', function (answer) {
          webrtcSignals.send(JSON.stringify({
            destination: origin,
            answer: answer
          }))
        })
        .on('error', function (err) {
          log('error: ' + err)
        })
        .on('connect', function () {
          log('webrtc connection established')
          lender.lendStream(connectTo(stream))
        })

        peer.signal(offer)
      })
    })
  })

  console.error('Serving volunteer code at http://' + host)
  return lender
}
