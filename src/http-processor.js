var http = require('http')
var express = require('express')
var createServer = require('pull-ws/server')
var pull = require('pull-stream')
var limit = require('pull-limit')
var path = require('path')
var debug = require('debug')
var log = debug('pando:http-processor')

module.exports = function (lender, options) {
  var app = express()
  options = options || {}
  options.port = options.port || 5000
  log('options:')
  log(options)

  var publicDir = path.join(__dirname, '..', 'public')
  app.use(express.static(publicDir))

  var port = options.port

  var httpServer = http.createServer(app)
  httpServer.listen(port)

  console.error('http server listening on %d', port)

  createServer({server: httpServer}, function (stream) {
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

  return lender
}
