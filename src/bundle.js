var browserify = require('browserify')
var path = require('path')
var fs = require('fs')

module.exports = function (modulePath, cb) {
  var outputPath = path.join(__dirname, '..', 'public', 'bundle.js')
  browserify(fs.createReadStream(modulePath), {
    basedir: process.cwd(),
    standalone: 'bundle'
  }).bundle().pipe(fs.createWriteStream(outputPath))
  .on('close', function () {
    cb(null, outputPath)
  })
  .on('error', function (err) {
    cb(err)
  })
}
