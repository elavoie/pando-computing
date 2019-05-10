# pando-computing

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

More detail and worked out examples are available in the [handbook](https://github.com/elavoie/pando-handbook).
Detailed explanations of the motivation, design, and experiments are available in the following publications:
* [Personal Volunteer Computing](https://arxiv.org/abs/1804.01482)
* [Pando: Personal Volunteer Computing in Browsers](https://arxiv.org/abs/1803.08426)
* [Genet: A Quickly Scalable Fat-Tree Overlay for Personal Volunteer Computing using WebRTC](https://arxiv.org/abs/1904.11402) 

# Install 

    npm install -g pando-computing

# Example

    git clone git@github.com:elavoie/pando-computing
    cd pando-computing
    npm install        # To install examples/square.js dependencies
    pando examples/square.js 1 2 3 4 5 6 7 8 9 10
    open http://localhost:5000

## Infinite stream

    cd pando-computing
    test/count | pando examples/square.js --stdin

## Separate server

    npm install -g pando-server
    pando-server

    # Separate process
    test/count | pando examples/square.js --host='localhost:5000'

# Usage

    usage: pando MODULE [OPTIONS] ITEM1, ITEM2, ...

    MODULE is the file path to a Node.js module. The module must export an object
    with a property '/pando/1.0.0'. This property must be a function that takes a
    single value and a callback as arguments.

    OPTIONS (default?):
        --headless  (false, Boolean)
                    Start electron-wrtc without access to a graphical environment

        --host=HOST (true, HOST='localhost', String)
                    Hostname of the bootstrap server. Can be supplied as
                    'hostname' or 'ipaddr:port'. If `--host` is not provided
                    (HOST=null), the pando-server is started within the same
                    process.

        --port=PORT (true, PORT=5000, Number) 
                    Port used by pando-server when HOST=null.

        --local     (false, Boolean)
                    Does not open to volunteers but loads the module, and directly
                    processes items one-by-one.  Useful for testing the module
                    on a few sample items.

        --start-idle (false, Boolean)
                    Whether items should be processed while waiting for
                    volunteers to connect. Set to true for idle waiting.

        --stdin     (false, Boolean)
                    Read items from standard input instead, one item per line

        --secret=S  (true, S='INSECURE-SECRET', String)
                    Alphanumeric string used to connect to the bootstrap server
                    as root (and only root). Should be the same as the one
                    supplied to pando-server.  Does not matter when not
                    communicating with a public server.

    ADVANCED (used for testing, development, and optimization):

        --bootstrap-timeout=T (true, T=60, Number)
                    Maximum time allowed for a new volunteer to establish a
                    successful connection (in seconds).

        --degree=D  (true, D=10, Number)
                    Maximum degree of the root (started by this command) and
                    each other connected volunteer. When new volunteers request
                    a connection to a node that has reached the maximum degree,
                    the connection is delegated to one of its children.

        --global-monitoring (false)
                    Each volunteer maintains an additional WebSocket connection to
                    the pando-server to report its status. All statuses are
                    combined and reported as additional information on the
                    monitoring page.

        --reporting-interval=I (true, I=3, Number)
                    Interval in seconds between the status updates given by nodes.

        --seed=SEED (true, SEED=RandomInt, Number) 
                    Seed used to assign identifiers to the node channels with
                    which they communicate. Providing an integer makes the identifiers
                    deterministic and replicable.

    ITEMS can be numbers, or strings:
        * Numbers are mapped to JavaScript numbers;
        * Otherwise the literal item is mapped to a JavaScript string.

# Enable volunteers to connect from a public http server (on Heroku)

See the [pando-server](https://github.com/elavoie/pando-server) repository
for information on how to deploy to heroku.

# Storing commonly used arguments in a config.json file

You may create a 'config.json' in the '$HOME/.pando' directory to avoid
typing `--host=... --secret=...`, when invoking pando on the commandline. It should be
a valid json file. Currently the following options are supported:

````
    {
        "seed": <number to initialize the pando server when the public server is not used>,
        "secret": "alphanumeric string for connecting as root",
        "host": "pando-server hostname or ipaddr:port",
        "
    }
````

# Perform experiments on Grid5000

## Connect to Grid5000

    ssh <username>@access.grid5000.fr
    oarsub -I

## Setup Pando

    <install pando-computing>
    <install pando-server>
    pando-server
    # Separate process
    pando

## Connecting to Grid5000 with VPN

Setup VPN https://www.grid5000.fr/mediawiki/index.php/VPN

## Setup host in $HOME/.pando/config.json

    host: "http://<node>.<site>.grid5000.fr:<port>"

# Log Monitoring Information

Pando continuously monitors the contributions of each volunteer, the real-time updates are displayed on the monitoring url. Each device sends its current status periodically, every 3 seconds by default. These status are collected by Pando, that then produce a report will all status obtained in the last period. There is therefore an inherent latency in displaying the status of participating devices.

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
