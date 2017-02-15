var http = require('http')
var express = require('express')
var app = express()
var port = process.env.PORT || 5000
var createServer = require('pull-ws/server')
var pull = require('pull-stream')
var lendStream = require('pull-lend-stream')
var limit = require('pull-limit')
var sync = require('pull-sync')
var path = require('path')
var fs = require('fs')
var Busboy = require('busboy')
var ws = require('ws')
var debug = require('debug')
var log = debug('pando-server')
log.jobs = debug('pando-server:jobs')
var randombytes = require('randombytes')

// For WebRTC signaling
var client = null
var prospects = {}
function closeProspect (id) {
  if (prospects[id]) prospects[id].close()
}

function incomingAnswer (data) {
  log('INCOMING ANSWER', data)
  var destination = JSON.parse(data).destination
  if (prospects.hasOwnProperty(destination)) {
    prospects[destination].send(data, function (err) {
      if (err) closeProspect(destination)
    })
  } else {
    log('Unknown destination ' + destination + ', ignoring message')
  }
}

function offerHandler (id) {
  return function incomingOffer (message) {
    message = JSON.parse(message)
    message.origin = id
    log('INCOMING OFFER')
    log(message)
    if (client) client.send(JSON.stringify(message))
  }
}

app.use(express.static(path.join(__dirname, 'public')))

var httpServer = http.createServer(app)
httpServer.listen(port)

console.log('http server listening on %d', port)

var lender = lendStream()

var configFile = path.join(__dirname, 'config.json')
try {
  var config = JSON.parse(fs.readFileSync(configFile))
} catch (e) {
  throw new Error('Missing ' + configFile + ' or invalid JSON format')
}
var clientId = config['clientId']
var clientPath = '/' + clientId
console.log('Opening websocket connection for client on ' + clientPath)

app.post(path.join(clientPath, 'upload'), function (req, res) {
  var busboy = new Busboy({ headers: req.headers })
  console.log('receiving files')

  busboy.on('file', function (fieldname, file, filename) {
    var saveTo = path.join(
      path.join(__dirname, 'public'),
      path.basename(filename))
    console.log('saving ' + filename + ' at ' + saveTo)
    file.pipe(fs.createWriteStream(saveTo))
  })
  busboy.on('finish', function () {
    res.writeHead(200, { 'Connection': 'close' })
    res.end('done')
  })
  return req.pipe(busboy)
})

app.post('/webrtc/answer', function (req, res) {
  var busboy = new Busboy({ headers: req.headers })
  log('receiving webrtc answer:')
  busboy.on('field', function (fieldname, data) {
    if (fieldname === 'data') {
      log('answer: ' + data)
      incomingAnswer(data)
    } else {
      log('unexpected field: ' + fieldname)
    }
  })
  busboy.on('finish', function () {
    res.writeHead(200, { 'Connection': 'close' })
    res.end('done')
  })
  return req.pipe(busboy)
})

createServer({ server: httpServer, path: '/' + clientId }, function (stream) {
  console.log('websocket connection open for client')
  stream = sync(stream)
  console.log('creating new lender')
  lender = lendStream()

  pull(
    stream,
    pull.through(function (j) { log.jobs('distributing job: ' + j) }),
    lender,
    pull.through(function (j) { log.jobs('sending result: ' + j) }),
    stream
  )
})

createServer({ server: httpServer, path: '/volunteer' }, function (stream) {
  log('websocket connection open for volunteer')
  lender.lendStream(function (err, s) {
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
      limit(stream),
      s
    )
  })
})

new ws.Server({server: httpServer, path: '/' + clientId + '/webrtc-signaling'})
  .on('connection', function (ws) {
    log('client connected for webrtc-signaling')
    ws.on('message', function (data) {
      log('WARNING: unexpected message from client: ' + data) 
    })
    client = ws
  })

new ws.Server({server: httpServer, path: '/volunteer-webrtc'})
  .on('connection', function (ws) {
    function remove () {
      log('volunteer ' + id + ' disconnected')
      delete prospects[id]
    }
    var id = ws.id = randombytes(16).inspect()
    ws.on('message', offerHandler(id))
    ws.on('close', remove)
    prospects[id] = ws
    setTimeout(function () {
      closeProspect(id)
    }, 30 * 1000)
  })

console.log('websocket server created')
