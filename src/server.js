require('dotenv').config()
var express = require("express");
// var cors = require('cors')
var portfinder = require("portfinder");
const { Project } = require("../bin/index");
const AWS = require("aws-sdk");
var allSettled = require("promise.allsettled");

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded bodies

const allowedIPs = ["::ffff:127.0.0.1"];

function getInput(projectID) {
  const s3 = new AWS.S3();
  const bucketName = "mybucketforpando";

  const params = {
    Bucket: bucketName,
    Prefix: projectID,
  };

  return new Promise((resolve, reject) => {
    const listInput = {};

    s3.listObjects(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const getObjectPromises = data.Contents.map((object) => {
          const getObjectParams = {
            Bucket: bucketName,
            Key: object.Key,
          };

          if (object.Key.includes("input")) {
            return new Promise((resolve, reject) => {
              s3.getObject(getObjectParams, (getObjectErr, getObjectData) => {
                if (getObjectErr) {
                  console.error("Error retrieving object:", getObjectErr);
                  reject(getObjectErr);
                } else {
                  const parts = object.Key.split("/"); // Split the string into an array
                  const key = parts[1];
                  listInput[key] = getObjectData.Body.toString().split("\n");
                  resolve();
                }
              });
            });
          } else {
            return Promise.resolve();
          }
        });

        allSettled(getObjectPromises)
          .then(() => {
            resolve(listInput);
          })
          .catch((error) => {
            reject(error);
          });
      }
    });
  });
}

// Middleware to check request IP against the allowed IPs
const checkIP = (req, res, next) => {
  const requestIP =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  // Check if the requestlistInput IP is in the allowed IPs
  // if (!allowedIPs.includes(requestIP)) {
  //   return res.status(403).json({ message: 'Forbidden' });
  // }

  // If IP is allowed, proceed with the request
  next();
};

const run = (projectID, input, callback) => {
  portfinder.getPort(function (err, port) {
    if (err) throw err;

    console.log(`Running with input: ${input}`);
    const project = new Project({
      port,
      // module: "examples/square-no-delay.js",
      items: input,
      projectID: projectID,
    });
    project.start();
    // Pass the port value to the callback function
    callback(port);
  });
};

app.post("/api/createProject", checkIP, (req, res) => {
  projectID = req.body.projectID;

  getInput(projectID)
    .then((inputList) => {
      input = inputList["input.txt"];

      // Call the run function and pass a callback function
      run(projectID, input, (port) => {
        // Send back the port as the response
        res.send({ port: port });
      });
    })
    .catch((error) => {
      // Handle any errors that occur during the getInput operation
      console.log("Error:", error);
      res
        .status(500)
        .send({ error: "An error occurred while fetching input data." });
    });
});

app.listen(5500, () => {
  console.log(`Server is running on http://localhost:5500`);
  console.log(
    "create new project with: http://localhost:5500/api/createProject"
  );
});
