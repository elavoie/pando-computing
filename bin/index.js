#!/usr/bin/env node
var pull = require('pull-stream')
var debug = require('debug')
var log = debug('pando')
var lendStream = require('pull-lend-stream')
var parse = require('../src/parse.js')
var httpProcessor = require('../src/http-processor.js')
var herokuProcessor = require('../src/heroku-processor.js')
var bundle = require('../src/bundle.js')

var args = parse(process.argv.slice(2))

process.stdout.on('error', function (err) {
  if (err.code === 'EPIPE') {
    process.exit(1)
  }
})

bundle(args.module, function (err, bundlePath) {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  var processor = null
  if (args.local) {
    processor = pull.asyncMap(require(args.module)['/pando/1.0.0'])
  } else {
    var lender = lendStream()
    processor = lender

    httpProcessor(lender, { port: args.http, bundle: bundlePath })

    if (args.heroku) {
      herokuProcessor(lender)
    }
  }

  pull(
    args.items,
    pull.map(function (x) { return JSON.stringify(x) }),
    pull.through(log),
    processor,
    pull.through(log),
    pull.drain(function (x) { process.stdout.write(String(x) + '\n') },
      function (err) {
        if (err) {
          console.error(err)
          process.exit(1)
        }
        process.exit(0)
      })
  )
})
