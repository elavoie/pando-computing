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

# Install 

    git clone git@github.com:elavoie/pando
    cd pando
    npm install
    npm link

# Example

    cd <pando-repository>
    pando examples/square.js 1 2 3 4
    open http://localhost:5000

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
                    'hostname' or 'ipaddr:port'. If HOST is set to null,
                    the pando-server is started within the same process.

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

        --degree=D  (true, D=10, Number)
                    Maximum degree of the root (started by this command) and
                    each other connected volunteer. When new volunteers request
                    a connection to a node that has reached the maximum degree,
                    the connection is delegated to one of its children.

        --seed=SEED (true, SEED=RandomInt, Number) 
                    Seed used to assign identifiers to the node channels with
                    which they communicate. Providing an integer makes the identifiers
                    deterministic and replicable.

    ITEMS can be numbers, or strings:
        * Numbers are mapped to JavaScript numbers;
        * Otherwise the literal item is mapped to a JavaScript string.

# Enable volunteers to connect from a public http server (on Heroku)

## Generate a unique client ID

This will restrict who can update to the code served to volunteers on the
heroku server.

    cd <pando-repository>/public-server
    cp config.example.json config.json
    # Modify 'clientId' property to use a randomly generated alphanumeric value
    

## Launch the heroku server

    cd <pando-repository>/public-server
    heroku login
    git init .
    git add *
    git commit -m "Initial commit"
    heroku create
    # Modify the 'host' property in config.json
    # to use the hostname provided by heroku
    git push heroku master

# Create a server on Grid5000

## Connect to Grid5000

    ssh <username>@access.grid5000.fr
    oarsub -I

## Setup Pando
    <install pando>
    cd pando/public-server
    npm install
    node index.js

## Connecting to Grid5000 with VPN

Setup VPN https://www.grid5000.fr/mediawiki/index.php/VPN

## Setup host in public-server/config.json

    host: "http://<node>.<site>.grid5000.fr:<port>"

# Storing commonly used arguments in a config.json file

You may create a 'config.json' in the '$HOME/.pando' directory to avoid
typing hostname, secrets, when invoking pando on the commandline. It should be
a valid json file. Currently the following options are supported:

````
    {
        "seed": <number to initialize the pando server when the public server is not used>,
        "secret": "alphanumeric string for connecting as root",
        "host": "pando-server hostname or ipaddr:port",
        "
    }
````

