var count = 0
module.exports['/pando/1.0.0'] = function (x, cb) {
  x = Number.parseInt(JSON.parse(x))
  var r = x * x
  count++
  cb(null, r)
}
