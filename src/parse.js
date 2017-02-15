var fs = require('fs')
var path = require('path')
var debug = require('debug')
var log = debug('pando:parse')
var pull = require('pull-stream')
var parseArgs = require('minimist')
var toPull = require('stream-to-pull-stream')
var split = require('split')

function help () {
  console.log(fs.readFileSync(path.join(__dirname, 'usage.txt')).toString())
  process.exit(0)
}

var options = {
  alias: {
    'help': ['h']
  },
  boolean: ['local', 'public', 'headless', 'stdin', 'help'],
  default: {
    http: 5000,
    headless: false,
    public: false,
    stdin: false,
    help: false,
    local: false,
    module: null,
    items: pull.values([])
  }
}

module.exports = function (argv) {
  log('parsing: ' + argv)
  argv = parseArgs(argv, options)
  log('after minimist: ')
  log(argv)

  if (argv._.length === 0 || argv.help) {
    help()
  }

  argv.module = path.join(process.cwd(), argv._[0])
  // Try loading the module to see if it is valid
  var f = require(argv.module)
  if (!f.hasOwnProperty('/pando/1.0.0')) {
    console.log("Incompatible module, missing '/pando/1.0.0' property")
    process.exit(1)
  }
  if (typeof f['/pando/1.0.0'] !== 'function' ||
      f['/pando/1.0.0'].length !== 2) {
    console.log("Incompatible module, property '/pando/1.0.0' is not a function or does not expect two arguments")
    process.exit(1)
  }

  if (argv.stdin) {
    argv.items = toPull.source(process.stdin.pipe(split()))
  } else {
    argv.items = pull.values(argv._.slice(1))
  }

  log('returning argv')
  log(argv)
  return argv
}
