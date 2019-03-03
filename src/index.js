var package = require('../package.json')
var Socket = require('simple-websocket')
var log = require('debug')('pando-computing')

function display (info) {
  if (typeof window === 'undefined') return

  document.getElementById('throughput').value = info.throughput
  document.getElementById('cpu-usage').value = info.cpuUsage
  document.getElementById('data-transfer-load').value = info.dataTransferLoad
}

var id = Math.floor(Math.random() * Math.pow(2,32)).toString(16)
if (id.length % 2) { id = '0' + id }

var startTime = new Date()
var nbItems = 0
var units = 'items'
var throughputs = []
var cpuUsages = []
var dataTransferLoads = []
var cpuTime = 0
var dataTransferTime = 0

var interval = 3000
if (typeof window !== 'undefined' &&
    typeof window.pando !== 'undefined' &&
    typeof window.pando.config !== 'undefined') {
  interval = window.pando.config.reportingInterval
}

function sum (a) {
  var s = 0
  for (var i = 0; i < a.length; ++i) {
    s += a[i]
  }

  return s
}
function average (a) {
  return sum(a)/a.length
}
function standardDeviation (a) {
  var avg = average(a)
  var deviations = 0
  for (var i = 0; i < a.length; ++i) {
    deviations += Math.abs(a[i] - avg)
  }
  return deviations / a.length
}
function maximum (a) {
  var max = -Infinity
  for (var i = 0; i < a.length; ++i) {
    if (a[i] > max) {
      max = a[i]
    }
  }
  return max
}
function minimum (a) {
  var min = Infinity
  for (var i = 0; i < a.length; ++i) {
    if (a[i] < min) {
      min = a[i]
    }
  }
  return min
}

setInterval(function () {
  var status = {
    id: id,
    cpuTime: cpuTime,
    dataTransferTime: dataTransferTime,
    nbItems: nbItems,
    units: units,
    deviceName: deviceName,
    throughput: 0,
    throughputStats: { },
    cpuUsage: 0,
    cpuUsageStats: { },
    dataTransferLoad: 0,
    dataTransferStats: {}
  }

  var endTime = new Date()
  var duration = endTime - startTime
  startTime = endTime

  var throughput = nbItems/(duration / 1000)
  var avg = Number(average(throughputs)).toFixed(2)
  var std = Number(standardDeviation(throughputs)).toFixed(2)
  var max = Number(maximum(throughputs)).toFixed(2)
  var min = Number(minimum(throughputs)).toFixed(2)
  var throughputStats = '(avg: ' + avg + ', std: ' + std + ', max: ' + max + ', min: ' + min + ')'
  status.throughput = throughput
  status.throughputStats.average = avg
  status.throughputStats['standard-deviation']= std
  status.throughputStats.maximum = max
  status.throughputStats.minimum = min

  var cpuUsage = (cpuTime/duration) * 100
  var avg = Number(average(cpuUsages)).toFixed(2)
  var std = Number(standardDeviation(cpuUsages)).toFixed(2)
  var max = Number(maximum(cpuUsages)).toFixed(2)
  var min = Number(minimum(cpuUsages)).toFixed(2)
  var cpuUsageStats = '(avg: ' + avg + ', std: ' + std + ', max: ' + max + ', min: ' + min + ')'

  status.cpuUsage = cpuUsage
  status.cpuUsageStats.average = avg
  status.cpuUsageStats['standard-deviation']= std
  status.cpuUsageStats.maximum = max
  status.cpuUsageStats.minimum = min

  var dataTransferLoad = (dataTransferTime/duration) * 100
  var avg = Number(average(dataTransferLoads)).toFixed(2)
  var std = Number(standardDeviation(dataTransferLoads)).toFixed(2)
  var max = Number(maximum(dataTransferLoads)).toFixed(2)
  var min = Number(minimum(dataTransferLoads)).toFixed(2)
  var dataTransferStats = '(avg: ' + avg + ', std: ' + std + ', max: ' + max + ', min: ' + min + ')'

  status.dataTransferLoad = dataTransferLoad
  status.dataTransferStats.average = avg
  status.dataTransferStats['standard-deviation']= std
  status.dataTransferStats.maximum = max
  status.dataTransferStats.minimum = min

  display({
    throughput: Number(throughput).toFixed(2) + ' ' + units + '/s ' + throughputStats,
    cpuUsage: Number(cpuUsage).toFixed(2) + '% ' + cpuUsageStats,
    dataTransferLoad: Number(dataTransferLoad).toFixed(2) + '% ' + dataTransferStats
  })
 

  // Update with device name
  var deviceName = ''
  if (typeof window !== 'undefined') {
    deviceName = document.getElementById('device-name').value
    status.deviceName = deviceName
  }
  submit(status)

  nbItems = 0
  cpuTime = 0
  dataTransferTime = 0
  throughputs.push(throughput)
  cpuUsages.push(cpuUsage)
  dataTransferLoads.push(dataTransferLoad)
}, interval)

function report (info) {
  // Setup default values
  var r = {
    id: id,
    cpuTime: info.cpuTime || 0,
    dataTransferTime: info.dataTransferTime || 0,
    nbItems: info.nbItems || 1,
    units: info.units || 'items',
    deviceName: ''
  }

  // Increase values used for display
  nbItems += r.nbItems
  units = r.units
  cpuTime += r.cpuTime
  dataTransferTime += r.dataTransferTime
}

var socketInitialized = false
var monitoringSocket = null

function connect() {
  var protocol = window.pando.config.secure ? 'wss://' : 'ws://'
  var host = window.pando.config.host
  var url = protocol + host + '/volunteer-monitoring'

  monitoringSocket = new Socket(url)
  monitoringSocket
    .on('connect', function () {
      socketInitialized = true 
      console.log('Connected to report status at ' + url)
    })
    .on('close', function () {
      socketInitialized = false
      monitoringSocket.destroy()
      monitoringSocket = null
      console.log('Connection closed at ' + url)
    })
    .on('error', function () {
      socketInitialized = false
      monitoringSocket.destroy()
      monitoringSocket = null
      console.log('Connection closed at ' + url)
    })
}

function submit (info) {
  if (typeof window === 'undefined') return

  if (!monitoringSocket && window.pando.config.protocol === 'websocket') {
    console.log('connecting')
    connect()

  } else if (window.pando.config.protocol === 'webrtc') {
    if (window.pando.processor) {
      window.pando.processor.updatePerformance(info)
    }
    return
  }

  if (monitoringSocket && socketInitialized) {
    monitoringSocket.send(JSON.stringify(info))
  }
}

if (typeof window !== 'undefined') {
  if (window.pando.config.version !== package.version) {
    var msg = 'Incompatible Pando versions, you are running version ' + window.pando.config.version + ' while the application uses ' + package.version
    console.log('ERROR: ' + msg)
    throw new Error(msg)
  } else {
    log('Pando executable and application versions are compatible')
  }
}

module.exports = {
  version: package.version,
  report: report
}
