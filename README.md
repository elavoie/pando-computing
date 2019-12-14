# Pando

Pando is a decentralized computing commandline tool that enables a stream of
values to be processed collaboratively by volunteers on the web.

Processing happens on volunteer processes in a web browser on the same and on
other machines.  Volunteers may join at any time and will be given newer jobs
as long as they stay available.  They may stop before finishing a given job in
which case the incomplete job will be transparently reassigned to another
volunteer. Results are produced on the standard output in the same order as
their input values, making it convenient to pipe to other unix tools.

However, volunteers should be collaborative. If they produce a result it is
assumed that it is correct with regard to the code provided. No attempt is made
to invalidate results produced by malicious volunteers. Use at your own risks.

## Quick Start

Install Pando from sources:

    git clone https://github.com/elavoie/pando-computing
    cd pando-computing
    npm install
    
Start Pando with an example that squares the list of inputs, passed as arguments:

    cd pando-computing
    bin/index.js examples/square.js 1 2 3 4 5 6 7 8 9 10
    
Should print:

    Serving volunteer code at http://<your ip addr>:5000
    Serving monitoring page at http://<your ip addr>:5001
    
In the browser of a device on the same local network, open:

    http://<your ip addr>:5000

Type a device name, then click save. Once connected, you should see the results appear on the standard output at a rate of one per second:

    1
    4
    ...

Your installation works! You can modify ````examples/square.js```` to use a different processing function. The processing function passed to Pando is a JavaScript module that exports the ````/pando/1.0.0```` (the first version of the function procotol). That function takes a string value ````x```` as input, corresponding to the string value of one of the arguments on the commandline, and a callback ````cb(err, res)````, to either produce an error ````err```` or return a new result ````res````. Here is an example that doubles the input:

````
module.exports['/pando/1.0.0'] = function (x, cb) {
    x = Number.parseInt(JSON.parse(x))
    var r = x + x
    cb(null, String(r))
}
````

The module can use libraries that have been previously been installed by npm. On startup Pando transparently creates a bundle with [browserify](https://github.com/browserify/browserify) and serves it to volunteering browsers.

## Other Installation Methods

### NPM

You can alternatively install Pando from NPM:

    npm install -g pando-computing
    
You can then invoke Pando globally:

    pando --help
    
    
## Common Usage Examples

### Read from the standard input and process the output

Pando can be integrated in a Unix pipeline. The following example implements a map-reduce job, where inputs are squared in parallel in browsers, then the sum of numbers is done locally:

    seq 100 | pando examples/square.js --stdin | awk '{s+=$1} END {print s}'
    
### Connect Volunteers over WebRTC

In browsers, pass the ````#protocol=webrtc;```` option after the url. For example, open ````http://<your ip addr>:5000/#protocol=webrtc;````. Make sure to use the ````#```` at the beginning and the option separator ````;```` for proper parsing.

Note that WebRTC connections are slower to establish and rather finicky, they often fail with hard-to-debug causes. You can first ensure that a connection can indeed be made by using [webrtc-connection-testing](https://github.com/elavoie/webrtc-connection-testing):

````
git clone git@github.com:elavoie/webrtc-connection-testing
npm install
bin/participant https://webrtc-connection-testing.herokuapp.com/
````

Then open ````https://webrtc-connection-testing.herokuapp.com/```` in the browser you intend to use. If a line appears between ````electron-wrtc```` (the participant you started on the commandline, with an identical setup to Pando) and the browser you are testing, then it should work with Pando as well.

At the time of writing only Brave, which uses an older version of Chromium, works. The latest versions of Firefox and Chrome may fail to establish a connection.

### Connect Internet Volunteers using WebRTC and a Public Server  

To enable connections with volunteers outside of a local network, you need a [pando-server](https://github.com/elavoie/pando-server) with a publicly accessible address:

    npm install -g pando-server
    pando-server (On your Public Server)

    # Separate process
    test/count | pando examples/square.js --host='<remote server addr>' --secret='<secret>'
    
We successfully tested with Heroku, the installation instruction can be found [here](https://github.com/elavoie/pando-server#launch-on-heroku).

## Using a Pre-configured Docker Image with Built-in Examples

The repository contains a Dockerfile that builds an image with a number of examples to replicate our [published experiments](https://arxiv.org/abs/1803.08426). To build the image do:

````
  cd pando-computing
  docker build -t elavoie/pando-middleware19 .
````

You can alternatively download a pre-built image from Docker:

````
   docker pull elavoie/pando-middleware19
````

Once the image is ready you can run one of the examples from inside the image. The following example first runs the image in interactive mode (````-it````), maps the internal ports (````-p````) 5000 (for serving volunteer code), 5001 (for monitoring performance), and 8080 (for serving files in the photo-batch processing example), and open a bash prompt. Then it executes the raytracer example:

````
    docker run -it -p 5000:5000 -p 5001:5001 -p 8080:8080 elavoie/pando-middleware19 /bin/bash
    ./raytracer
````

You can connect a volunteer to the instance of Pando running inside docker by opening a browser with ````http://<ip addr of docker host>:5000````. 

Other example applications are available in the same directory:

````
    ls .
````


## Log Monitoring Information

Pando continuously monitors the contributions of each volunteer, the real-time updates are displayed on the monitoring url (````http://<ip addr>:5001````). Each device sends its current status periodically, every 3 seconds by default. These status are collected by Pando, that then produce a report will all status obtained in the last period. There is therefore an inherent latency in displaying the status of participating devices.

The monitoring information must be explicitly supplied by applications, which simply have to provide the number of items they have processed, as well as the time spent transferring data and performing computations. Pando handles the aggregation of multiple reports within the same reporting interval, the computation of statistics, and transparently transfer the report information. Example usage:

    var pando = require('pando-computing')

    // ... Application helper functions and global variables

    module.exports['/pando/1.0.0'] = function (x, cb) {
      var startTime = new Date()
      
      // ... Data Transfer (if applicable)

      var dataTransferTime = new Date() - startTime


      startTime = new Date()
      var nbItems = 0

      // ... Application code
      nbItems++

      var cpuTime = new Date() - startTime

      pando.report({
        cpuTime: cpuTime,
        dataTransferTime: dataTransferTime,
        nbItems: nbItems,
        units: 'Gizmos'
      })

      cb(null, result) 
    }

The reporting interval can be modified with the ````--reporting-interval=I```` command-line option, with ````I```` a number that specifies the number of seconds between reports.  Note that the reporting interval used for calculations is specific to each participating device. The exact duration between reports on a given device depends on other concurrent activities.

The raw information can be displayed on the standard error by using ````DEBUG='pando-computing:monitoring'````. The information can therefore be redirected to a log file in the following way:

    DEBUG='pando-computing:monitoring' pando test.js 2>log.txt

The information object contains the following properties:

    {
      "root": { ... } /* Internal information used for debugging */,
      "volunteers": {
        "5f7cfd73": { /* Volunteer information stored by ID*/
          "id": "5f7cfd73", /* Volunteer ID */
          "cpuTime": 3095,  /* Time (ms) spent performing CPU computations */
          "dataTransferTime": 0, /* Time (ms) spent transferring data */
          "nbItems": 700,        /* Number of items processed */
          "units": "BigNums",    /* Application-specific units */
          "deviceName": "MacBook Air 2011", /* Latest user-defined name associated with ID */
          "throughput": 225.2977148374638,  /* Throughput = nbItems / (Reporting Interval) */
          "throughputStats": {              /* Statistics about all previously reported throughput */
            "average": "242.23",            
            "standard-deviation": "39.00",  
            "maximum": "325.88",            
            "minimum": "166.14"
          },
          "cpuUsage": 99.61377534599292,    /* Cpu Usage = cpuTime / (Reporting Interval) */
          "cpuUsageStats": {                /* Statistics about all previously reported cpu usage data */
            "average": "89.06",
            "standard-deviation": "14.73",
            "maximum": "99.55",
            "minimum": "55.69"
          },
          "dataTransferLoad": 0,            /* Data Transfer Load = dataTransferTime / (Reporting Interval) */
          "dataTransferStats": {            /* Statistics about all previously reported data transfers */
            "average": "0.00",
            "standard-deviation": "0.00",
            "maximum": "0.00",
            "minimum": "0.00"
          },
          "lastReportInterval": 3107        /* Time (ms) since the last report was produced by Pando */
        }
      }
    }
    
## Documentation and Publications
 
More detail and worked out examples are available in the [handbook](https://github.com/elavoie/pando-handbook). You may also look at the [artifact instructions](http://ericklavoie.com/pubs/middleware19-artifact.pdf) for the [Middleware 2019 paper](https://dl.acm.org/citation.cfm?id=3361539).
Detailed explanations of the motivation, design, and experiments are available in the following publications:
* [Personal Volunteer Computing](https://arxiv.org/abs/1804.01482)
* [Pando: Personal Volunteer Computing in Browsers](https://arxiv.org/abs/1803.08426)
* [Genet: A Quickly Scalable Fat-Tree Overlay for Personal Volunteer Computing using WebRTC](https://arxiv.org/abs/1904.11402) 

