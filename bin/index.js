#!/usr/bin/env node
var path = require('path')
var pull = require('pull-stream')
var debug = require('debug')
var log = debug('pando')
var parse = require(path.join(__dirname, '..', 'src', 'parse.js'))
var args = parse(process.argv.slice(2))
var httpProcessor = require(path.join(__dirname, '..', 'src', 'http-processor.js'))
var lendStream = require('pull-lend-stream')
var bundle = require('../src/bundle.js')

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
    processor = httpProcessor(lender, { port: args.http, bundle: bundlePath })
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

