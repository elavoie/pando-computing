var express = require('express')
// var cors = require('cors')
var portfinder = require('portfinder');
const {Project} = require('../bin/index')

const app = express();

const allowedIPs = ['::ffff:127.0.0.1'];

// Middleware to check request IP against the allowed IPs
const checkIP = (req, res, next) => {
  const requestIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(requestIP);

  // Check if the request IP is in the allowed IPs
  if (!allowedIPs.includes(requestIP)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // If IP is allowed, proceed with the request
  next();
};

const run = (projectID, callback) => {
  portfinder.getPort(function (err, port) {
    if (err) throw err;

    const project = new Project({
      port,
      module: "examples/square-no-delay.js",
      items: [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      projectID: projectID
    }) 
    project.start();
    // Pass the port value to the callback function
    callback(port);
  });
}

app.post('/createProject/:id', checkIP, (req, res) => {
  projectID = req.params.id;
  // Call the run function and pass a callback function
  run(projectID, (port) => {
    // Send back the port as the response
    res.send(`New port opened: ${port} with id ${projectID}`);
  });
});

app.listen(3000, () => {
  console.log(`Server is running on http://localhost:3000`);
});
