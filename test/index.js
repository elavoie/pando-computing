#!/usr/bin/env node

var tape = require('tape')
var run = require('./run')

var valueNb = (process.argv[2] && Number.parseInt(process.argv[2])) || 24
var workerNb = (process.argv[3] && Number.parseInt(process.argv[3])) || 6
var maxDegree = (process.argv[4] && Number.parseInt(process.argv[4])) || 2
var seed = (process.argv[5] && Number.parseInt(process.argv[5])) || 1337

console.log('run(' + valueNb + ', ' + workerNb + ', ' + maxDegree + ', ' + seed + ')')
tape('Full test', run(valueNb, workerNb, maxDegree, seed))
