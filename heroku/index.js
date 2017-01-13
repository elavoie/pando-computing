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

app.use(express.static(path.join(__dirname, 'public')))

var httpServer = http.createServer(app)
httpServer.listen(port)

console.log('http server listening on %d', port)

var lender = lendStream()

var clientId = JSON.parse(fs.readFileSync('./config.json'))['clientId']
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

createServer({ server: httpServer, path: '/' + clientId }, function (stream) {
  console.log('websocket connection open for client')
  stream = sync(stream)
  console.log('creating new lender')
  lender = lendStream()

  pull(
    stream,
    pull.through(function (j) { console.log('distributing job: ' + j) }),
    lender,
    pull.through(function (j) { console.log('sending result: ' + j) }),
    stream
  )
})

createServer({ server: httpServer, path: '/volunteer' }, function (stream) {
  console.log('websocket connection open for volunteer')
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

console.log('websocket server created')
