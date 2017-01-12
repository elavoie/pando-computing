var pull = require('pull-stream')
var ws = require('pull-ws')

module.exports = function (url, bundle) {
  ws.connect(url, (err, stream) => {
    if (err) {
      throw err
    }

    pull(
      stream,
      pull.map((x) => JSON.parse(x)),
      pull.through((x) => console.log('processing: ' + x)),
      pull.asyncMap(bundle['/pando/1.0.0']),
      pull.through((x) => console.log('returning: ' + x)),
      pull.map((x) => JSON.stringify(x)),
      stream
    )
  })
}
