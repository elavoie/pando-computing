// var debug = require('debug')
// var log = debug('pando:examples:square')

var count = 0

function onMod (n, cb) {
  if ((count % n) === 0 && count > 0) {
    cb()
  }
}

module.exports['/pando/1.0.0'] = function (x, cb) {
  /*
  onMod(1000, function () {
    // console.error('processed 1000 values')
    // console.error('next value:' + x)
  })
  */

  x = Number.parseInt(JSON.parse(x))
  var r = x * x
  /*
  onMod(1000, function () {
    // console.error('result: ' + r)
  })
  */
  count++
  cb(null, r)
}
