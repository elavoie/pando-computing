module.exports['/pando/1.0.0'] = function (x, cb) {
  setTimeout(function () {
    x = Number.parseInt(JSON.parse(x))
    var r = x * x
    cb(null, r)
  }, 1000)
}
