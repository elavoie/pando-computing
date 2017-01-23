var pull = require('pull-stream')
var pullws = require('pull-ws')
var Peer = require('simple-peer')
var SimpleWebSocket = require('simple-websocket')
var toPull = require('stream-to-pull-stream')

function connectStream (stream, bundle) {
  pull(
    stream,
    pull.map((x) => JSON.parse(x)),
    // pull.through((x) => console.log('processing: ' + x)),
    pull.asyncMap(bundle['/pando/1.0.0']),
    // pull.through((x) => console.log('returning: ' + x)),
    pull.map((x) => JSON.stringify(x)),
    stream
  )
}

function wsConnection (bundle) {
  return function (err, stream) {
    if (err) {
      throw err
    }
    console.log('websocket connection established')

    connectStream(stream, bundle)
  }
}

function wrtcConnection (url, bundle) {
  console.log('connecting to signaling socket')
  var ws = new SimpleWebSocket(url + '-webrtc')
  console.log('webrtc handshake')
  ws.on('connect', function () {
    var peer = new Peer({ initiator: true })
      .on('signal', function (offer) {
        ws.send(JSON.stringify({ offer: offer }))
      })
      .on('connect', function () {
        console.log('webrtc connection established')
        var stream = toPull.duplex(peer)
        connectStream(stream, bundle)
      })
      .on('error', function (err) {
        console.log('error: ' + err)
        ws.destroy()
      })

    ws.on('data', function incoming (data) {
      var message = JSON.parse(data)
      peer.signal(message.answer)
    })
  })
}

module.exports['ws'] = function (url, bundle) {
  pullws.connect(url, wsConnection(bundle))
}

module.exports['webrtc'] = function (url, bundle) {
  wrtcConnection(url, bundle)
}
