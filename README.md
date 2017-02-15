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
        --http=PORT (true, PORT=5000) 
                    Serve volunteer code through http.
                    (volunteers will connect back through a websocket)

        --public    (false)           
                    Serve volunteer code through http on a public server.
                    (volunteers will connect back through a websocket)

        --local     (false)
                    Does not open to volunteers but loads the module, and directly
                    processes items one-by-one.
                    Useful for testing the module on a few sample items.

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

