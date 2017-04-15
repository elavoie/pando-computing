var Big = require('bignumber.js')

function collatz (n) {
  n = new Big(n)
  var y = 0
  while (n.gt(1)) {
    if (n.mod(2).eq(0)) {
      n = n.div(2)
    } else {
      n = n.mul(3).add(1)
    }
    y = y + 1
  }
  return y
}

// Pando convention
module.exports['/pando/1.0.0'] = function (x, cb) {
  try {
    var r = collatz(x)
    cb(null, r)
  } catch (e) {
    cb(e)
  }
}
