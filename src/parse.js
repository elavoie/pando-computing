var fs = require('fs')
var path = require('path')
var debug = require('debug')
var log = debug('pando-computing')
var pull = require('pull-stream')
var parseArgs = require('minimist')
var toPull = require('stream-to-pull-stream')
var split = require('split')

function help () {
  console.log(fs.readFileSync(path.join(__dirname, 'usage.txt')).toString())
  process.exit(0)
}

function version () {
  var p = require('../package.json')
  console.log(p.version)
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
    'help': ['h'],
    'version': ['v']
  },
  boolean: [
    'global-monitoring',
    'headless',
    'help',
    'local',
    'public',
    'start-idle',
    'stdin',
    'sync-stdio',
    'version'
  ],
  default: {
    'batch-size': config['batch-size'] || 1,
    'bootstrap-timeout': config['bootstrap-timeout'] || 60, // seconds
    'global-monitoring': config['global-monitoring'] || false,
    'reporting-interval': 3, // seconds
    'start-idle': config['start-idle'] || true,
    degree: config['degree'] || 10,
    headless: config['headless'] || false,
    heartbeat: config['heartbeat'] || 30000,
    help: false,
    host: config['host'] || null,
    'ice-servers': config['iceServers'] || 'stun:stun.l.google.com:19302',
    items: pull.values([]),
    limit: 1,
    local: config['local'] || false,
    module: null,
    port: config['port'] || 5000,
    secret: config['secret'] || 'INSECURE-SECRET',
    seed: config['seed'] || null,
    stdin: config['stdin'] || config['sync-stdio'] || false,
    'sync-stdio': config['sync-stdio'] || false,
    version: false
  }
}

module.exports = function (argv) {
  log('parsing: ' + argv)
  argv = parseArgs(argv, options)
  log('after minimist: ')
  log(argv)

  if ((argv._.length === 0 && !argv.version) || argv.help) {
    help()
  }

  if (argv.version) {
    version()
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

  if (argv['sync-stdio']) {
    argv.stdin = true
  }

  if (argv.stdin) {
    log('reading from standard input')
    argv.items = toPull.source(process.stdin.pipe(split(undefined, null, { trailing: false })))
  } else {
    log('reading commandline arguments')
    argv.items = pull.values(argv._.slice(1).map(function (x) { return String(x) }))
  }

  if (argv.public && !argv.host) {
    throw new Error('Not hostname provided for public server')
  }

  // Provide the iceServers in the correct format
  argv['ice-servers'] = argv['ice-servers'].split(',').map(function (url) { return { urls: url } })

  if (argv.host && argv.host.indexOf('/') !== -1) {
    log('removing trailing slashes from host: ' + argv.host)
    // remove trailing slashes
    argv.host = argv.host.replace('/', '')
  }

  log('returning argv')
  log(argv)
  return argv
}

