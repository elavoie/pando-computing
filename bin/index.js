#!/usr/bin/env node
var pull = require("pull-stream");
var debug = require("debug");
var log = debug("pando-computing");
var logMonitoring = debug("pando-computing:monitoring");
var logMonitoringChildren = debug("pando-computing:monitoring:children");
var logHeartbeat = debug("pando-computing:heartbeat");
// var parse = require("../src/parse.js");
// var bundle = require("../src/bundle.js");
var electronWebRTC = require("electron-webrtc");
var createProcessor = require("../src/processor.js");
var Node = require("webrtc-tree-overlay");
var Server = require("pando-server");
var BootstrapClient = require("webrtc-bootstrap");
var os = require("os");
var fs = require("fs");
var path = require("path");
var website = require("simple-updatable-website");
// var http = require("http");
// var WebSocket = require("ws");
// var express = require("express");
var probe = require("pull-probe");
var mkdirp = require("mkdirp");
var sync = require("pull-sync");
// var toPull = require("stream-to-pull-stream");
var limit = require("pull-limit");
// const portfinder = require("portfinder");
var duplexWs = require("pull-ws");
// var cors = require("cors");

// const app = express();


function getIPAddresses() {
  var ifaces = os.networkInterfaces();
  var addresses = [];
  
  Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0;
    
    ifaces[ifname].forEach(function (iface) {
      if (iface.family !== "IPv4" || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
      }
      
      if (alias >= 1) {
        // this single interface has multiple ipv4 addresses
        addresses.push(iface.address);
      } else {
        // this interface has only one ipv4 adress
        addresses.push(iface.address);
      }
    });
  });
  return addresses;
}

class Project {
  constructor({
    port,
    module,
    items = [],
    secret = "INSECURE-SECRET",
    seed = null,
    heartbeat = 30000,
    batchSize = 1,
    degree = 10,
    globalMonitoring = false,
    iceServers = ["stun:stun.l.google.com:19302"],
    reportingInterval = 3,
    bootstrapTimeout = 60,
    syncStdio = false,
    projectID
  }) {
    this.port = port;
    this.server = null;
    this.processor = null;
    this.host = null;
    this.wsVolunteersStatus = {};
    this.statusSocket = null;
    this.module = path.join(process.cwd(), module);
    this.secret = secret;
    this.seed = seed;
    this.heartbeat = heartbeat;
    this.batchSize = batchSize;
    this.degree = degree;
    this.globalMonitoring = globalMonitoring;
    this.iceServers = iceServers.map((url) => ({ urls: url }));
    this.reportingInterval = reportingInterval;
    this.bootstrapTimeout = bootstrapTimeout;
    this.startIdle = true;
    this.items = pull.values(items.map((x) => String(x)));
    this.syncStdio = syncStdio;
    this.statusSocket = null;
    this.wsVolunteersStatus = {};
    this.projectID = projectID;
    
    var wrtc = electronWebRTC({ headless: true });
    this.start = () => {

      // bundle(this.module, (err, bundlePath) => {
        //   if (err) {
          //     console.error(err);
          //     process.exit(1);
          //   }
          
          const _this = this;
          
          log("creating bootstrap server");
          var publicDir = path.join(__dirname, "../local-server/public");
          // var publicDir = path.join(__dirname, "../testLocal");
          mkdirp.sync(publicDir);
          this.server = new Server({
          secret: this.secret,
          publicDir: publicDir,
          port: this.port,
          seed: this.seed,
        });
        this.host = "localhost:" + this.port;

        this.server._bootstrap.upgrade("/volunteer", (ws) => {
          if (this.processor) {
            log("volunteer connected over WebSocket");

            ws.isAlive = true;
            var heartbeat = setInterval(function ping() {
              if (ws.isAlive === false) {
                logHeartbeat("ws: volunteer connection lost");
                return ws.terminate();
              }
              ws.isAlive = false;
              ws.ping(function () {});
            }, this.heartbeat);
            ws.addEventListener("close", function () {
              clearInterval(heartbeat);
              heartbeat = null;
            });
            ws.addEventListener("error", function () {
              clearInterval(heartbeat);
              heartbeat = null;
            });
            ws.addEventListener("pong", function () {
              logHeartbeat("ws: volunteer connection pong");
              ws.isAlive = true;
            });

            this.processor.lendStream(function (err, stream) {
              if (err) return log("error lender sub-stream to volunteer: " + err);
              log("lending sub-stream to volunteer");

              pull(
                stream,
                probe("volunteer-input"),
                limit(duplexWs(ws), _this.batchSize),
                probe("volunteer-output"),
                stream
              );
            });
          }
        });

        this.server._bootstrap.upgrade("/volunteer-monitoring", (ws) => {
          log("volunteer monitoring connected over WebSocket");

          ws.isAlive = true;
          var heartbeat = setInterval(function ping() {
            if (ws.isAlive === false) {
              logHeartbeat("ws: volunteer monitoring connection lost");
              return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping(function () {});
          }, args.heartbeat);
          ws.addEventListener("close", function () {
            clearInterval(heartbeat);
            heartbeat = null;
          });
          ws.addEventListener("error", function () {
            clearInterval(heartbeat);
            heartbeat = null;
          });
          ws.addEventListener("pong", function () {
            logHeartbeat("ws: volunteer monitoring pong");
            ws.isAlive = true;
          });

          var id = null;
          var lastReportTime = new Date();
          pull(
            duplexWs.source(ws),
            pull.drain(
              function (data) {
                var info = JSON.parse(data);
                id = info.id;
                var time = new Date();
                this.wsVolunteersStatus[info.id] = {
                  id: info.id,
                  timestamp: time,
                  lastReportInterval: time - lastReportTime,
                  performance: info,
                };
                lastReportTime = time;
              },
              function () {
                if (id) {
                  delete this.wsVolunteersStatus[id];
                }
              }
            )
          );
        });

        getIPAddresses().forEach((addr) => {
          console.error(
            "Serving volunteer code at http://" + addr + ":" + this.port
          );
        });

        log("Serializing configuration for workers");
        fs.writeFileSync(
          path.join(__dirname, "../public/config.js"),
          "window.pando = { config: " +
            JSON.stringify({
              batchSize: this.batchSize,
              degree: this.degree,
              globalMonitoring: this.globalMonitoring,
              iceServers: this.iceServers,
              reportingInterval: this.reportingInterval * 1000,
              requestTimeoutInMs: this.bootstrapTimeout * 1000,
              version: "1.0.0",
            }) +
            " }"
        );

        log("Uploading files to " + this.host + " with secret " + this.secret);
        website.upload(
          [
            // bundlePath,
            path.join(__dirname, "../src/parse.js"),
            path.join(__dirname, "../public/config.js"),
            path.join(__dirname, "../public/index.html"),
            path.join(__dirname, "../public/volunteer.js"),
            path.join(__dirname, "../public/simplewebsocket.min.js"),
            path.join(
              __dirname,
              "../node_modules/bootstrap/dist/css/bootstrap.min.css"
            ),
            path.join(
              __dirname,
              "../node_modules/bootstrap/dist/js/bootstrap.min.js"
            ),
            path.join(__dirname, "../node_modules/jquery/jquery.min.js"),
            path.join(
              __dirname,
              "../node_modules/popper.js/dist/umd/popper.min.js"
            ),
          ],
          this.host,
          this.secret,
          (err) => {
            if (err) throw err;
            log("files uploaded successfully");

            log("connecting to bootstrap server");
            var bootstrap = new BootstrapClient(this.host);

            log("creating root node");
            var root = new Node(bootstrap, {
              requestTimeoutInMs: this.bootstrapTimeout * 1000, // ms
              peerOpts: {
                wrtc: wrtc,
                config: { iceServers: this.iceServers },
              },
              maxDegree: this.degree,
            }).becomeRoot(this.secret);

            this.processor = createProcessor(root, {
              batchSize: this.batchSize,
              bundle: !this.startIdle
                ? require(bundlePath)["/pando/1.0.0"]
                : function (x, cb) {
                    console.error(
                      "Internal error, bundle should not have been executed"
                    );
                  },
              globalMonitoring: this.globalMonitoring,
              reportingInterval: this.reportingInterval * 1000, // ms
              startProcessing: !this.startIdle,
            });

            this.processor.on("status", function (rootStatus) {
              var volunteers = {};

              // Adding volunteers connected over WebSockets
              for (var id in _this.wsVolunteersStatus) {
                volunteers[id] = _this.wsVolunteersStatus[id];
              }

              // Adding volunteers connected over WebRTC
              for (var id in rootStatus.children) {
                volunteers[id] = rootStatus.children[id];
              }

              var status = JSON.stringify({
                root: rootStatus,
                volunteers: volunteers,
                timestamp: new Date(),
              });

              logMonitoring(status);
              logMonitoringChildren(
                "children nb: " +
                  rootStatus.childrenNb +
                  " leaf nb: " +
                  rootStatus.nbLeafNodes
              );

              if (_this.statusSocket) {
                log("sending status to monitoring page");
                _this.statusSocket.send(status);
              }
            });

            const close = () => {
              log("closing");
              if (this.server) {
                this.server.close();
              }
              if (root) root.close();
              if (bootstrap) bootstrap.close();
              if (wrtc) wrtc.close();
              if (this.processor) this.processor.close();
            }

            var io = {
              source: this.items,
              sink: pull.drain(
                function (x) {
                  process.stdout.write(String(x) + "\n");
                },
                function (err) {
                  log("drain:done(" + err + ")");
                  if (err) {
                    console.error(err.message);
                    console.error(err);
                    close();
                    process.exit(1);
                  } else {
                    close();
                    process.exit(0);
                  }
                }
              ),
            };

            if (this.syncStdio) {
              io = sync(io);
            }

            pull(
              io,
              pull.through(log),
              probe("pando:input"),
              this.processor,
              probe("pando:result"),
              pull.through(log),
              io
            );
          }
        );
      }
    };
  }


module.exports = {
  getIPAddresses,
  Project
}

// const allowedIPs = ['1::1'];

// // Middleware to check request IP against the allowed IPs
// const checkIP = (req, res, next) => {
//   const requestIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

//   // Check if the request IP is in the allowed IPs
//   if (!allowedIPs.includes(requestIP)) {
//     return res.status(403).json({ message: 'Forbidden' });
//   }

//   // If IP is allowed, proceed with the request
//   next();
// };

// const run = (calcreateProcessorlback) => {
//   portfinder.getPort(function (err, port) {
//     if (err) throw err;

//     const project = new Project({
//       port,
//       module: "examples/square-no-delay.js",
//       items: [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 9],
//     }) 
//     project.start();
//     // Pass the port value to the callback function
//     callback(port);
//   });
// }

// app.get('/number', checkIP, (req, res) => {
//   // Call the run function and pass a callback function
//   run((port) => {
//     // Send back the port as the response
//     res.send(`The port is: ${port}`);
//   });
// });

// app.listen(3000, () => {
//   console.log(`Server is running on port `)
// });
