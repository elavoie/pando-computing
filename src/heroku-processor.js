var pull = require('pull-stream')
var sync = require('pull-sync')
var path = require('path')
var debug = require('debug')
var log = debug('pando:heroku-processor')
var request = require('request')
var fs = require('fs')
var ws = require('pull-ws')

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

module.exports = function (lender) {
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
    path.join(publicDir, 'bundle.js')
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
          sync(stream),
          s
        )
        log('stream connected to heroku server')
      })
    })
  })

  return lender
}
