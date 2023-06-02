var browserify = require('browserify')
var path = require('path')
var fs = require('fs')

module.exports = function (modulePath, cb) {
  var outputPath = path.join(__dirname, '..', 'public', 'bundle.js');

  browserify(fs.createReadStream(modulePath), {
    basedir: process.cwd(),
    standalone: 'bundle'
  })
  .bundle()
  .pipe(fs.createWriteStream(outputPath))
  .on('close', function () {

    cb(null, outputPath)
  })
  .on('error', function (err) {
    cb(err)
  })
}

// const AWS = require('aws-sdk');
// const fs = require('fs');
// const path = require('path');
// const browserify = require('browserify');

// AWS.config.update({
//   region: 'ap-southeast-2',
//   accessKeyId: 'AKIAV6JUFBZ7HTPRPCRR',
//   secretAcesssKey: '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'
// })

// module.exports = function (modulePath, cb) {
//   const outputPath = path.join(__dirname, '..', 'public', 'bundle.js');
  
//   const s3 = new AWS.S3();
//   const bucketName = 'mybucketforpando';
//   const fileKey = 'bundle.js';

//   const bundleStream = browserify(fs.createReadStream(modulePath), {
//     basedir: process.cwd(),
//     standalone: 'bundle'
//   })
//     .bundle();

//   bundleStream.pipe(fs.createWriteStream(outputPath))
//     .on('close', function () {

//       fs.readFile(outputPath, (err, data) => {
//         if (err) {
//           console.error('Error reading file:', err);
//           return;
//         }
      
//         // Set up the S3 upload parameters
//         const params = {
//           Bucket: bucketName,
//           Key: fileKey, // Name of the file in the S3 bucket
//           Body: data,
//           ContentType: 'application/javascript'
//         };
      
//         // Upload the file to the specified S3 bucket
//         s3.upload(params, (err, result) => {
//           if (err) {
//             console.error('Error uploading file:', err);
//             return;
//           }
      
//           console.log('File uploaded successfully:', result.Location);
//         });
//       });
//     })
//     .on('error', function (err) {
//       cb(err);
//     });
// }

