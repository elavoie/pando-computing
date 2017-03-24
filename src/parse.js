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

var configFile = path.join(process.env.HOME, '.pando/config.json')
var config = {}
try {
  config = JSON.parse(fs.readFileSync(configFile))
} catch (e) {
  log('No $HOME/.pando/config.json file found')
  log(configFile + ' not found, trying the pando directory')

  configFile = path.join(__dirname, '../config.json')
  try {
    config = JSON.parse(fs.readFileSync(configFile))
  } catch (e) {
    log(configFile + ' not found, expecting all arguments to be supplied on the comandline')
  }
}

var options = {
  alias: {
    'help': ['h']
  },
  boolean: ['local', 'public', 'headless', 'stdin', 'help', 'start-idle'],
  default: {
    degree: config['degree'] || 10,
    port: config['port'] || 5000,
    host: config['host'] || null,
    headless: config['headless'] || false,
    limit: 1,
    stdin: config['stdin'] || false,
    help: false,
    local: config['local'] || false,
    module: null,
    items: pull.values([]),
    'reporting-interval': 3, // seconds
    secret: config['secret'] || 'INSECURE-SECRET',
    seed: config['seed'] || null,
    'start-idle': config['start-idle'] || false
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
    argv.items = toPull.source(process.stdin.pipe(split(undefined, null, { trailing: false })))
  } else {
    argv.items = pull.values(argv._.slice(1))
  }

  if (argv.public && !argv.host) {
    throw new Error('Not hostname provided for public server')
  }

  log('returning argv')
  log(argv)
  return argv
}
