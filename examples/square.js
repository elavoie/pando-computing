var debug = require('debug')
var log = debug('pando:examples:square')

module.exports['/pando/1.0.0'] = function (x, cb) {
  log('started processing ' + x)
  setTimeout(function () {
    var r = x*x
    log('returning ' + r)
    cb(null, r)
  }, 1000)
}
