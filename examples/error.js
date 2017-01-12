var debug = require('debug')
var log = debug('pando:examples:error')

module.exports['/pando/1.0.0'] = function (x, cb) {
  log('started processing ' + x)
  setTimeout(function () {
    log('error')
    cb(new Error('processing error'))
  }, 1000)
}
