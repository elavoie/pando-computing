# README: To build this Docker image, save this file in any directory, then do:
#   docker build -t elavoie/pando-middleware19 .

# Use node version 10. This is the long-term support version at the time of writing 
FROM node:10

# Install Linux dependencies for Xvfb (to run Pando headless without a display)
RUN apt-get update && apt-get install -y xvfb libxtst6 libxss1 libgconf-2-4 libnss3 libasound2 

# This is where all the git repositories will reside
WORKDIR /usr/src

# Retrieve the Middleware version of the code
RUN git clone https://github.com/elavoie/pando-computing
WORKDIR /usr/src/pando-computing
RUN git checkout Middleware-2019

# Install dependencies
RUN npm install

# Make sure the volunteer code is built
RUN npm run postinstall

# Make 'pando' globally available
RUN npm link

# Retrieve examples
WORKDIR /usr/src/
RUN git clone https://github.com/elavoie/pando-handbook
WORKDIR /usr/src/pando-handbook
RUN git checkout Middleware-2019

# Setup throughput analysis script
WORKDIR /usr/src/pando-handbook/middleware-2019/analysis
RUN npm install

# Setup examples 
# -- Link to pando-computing to avoid wasteful copies

# Square (Test Example)
WORKDIR /usr/src/pando-handbook/examples/square
RUN npm link /usr/src/pando-computing 
RUN npm install

# Arxiv
WORKDIR /usr/src/pando-handbook/examples/arxiv
RUN npm install

# Collatz 
WORKDIR /usr/src/pando-handbook/examples/collatz
RUN npm link /usr/src/pando-computing 
RUN npm install

# Crypto-Mining
WORKDIR /usr/src/pando-handbook/examples/crypto-mining
RUN npm link /usr/src/pando-computing 
RUN npm install

# Photo-Batch-Processing, metainfo will download the required
# from two different locations
WORKDIR /usr/src/pando-handbook/examples/photo-batch-processing
RUN npm link /usr/src/pando-computing 
RUN npm install
RUN ./metainfo
RUN ./metainfo --path=196 --row=28

# Random Testing
WORKDIR /usr/src/pando-handbook/examples/random-testing
RUN npm link /usr/src/pando-computing 
RUN npm install

# Raytracer
WORKDIR /usr/src/pando-handbook/examples/raytracer
RUN npm link /usr/src/pando-computing 
RUN npm install

# RLNetwork
WORKDIR /usr/src/pando-handbook/examples/rlnetwork
RUN npm link /usr/src/pando-computing 
RUN npm install

# These are the ports that Pando uses,
# 5000 HTTP Server to connect volunteers
# 5001 HTTP Server to monitor performance
# 8080 HTTP File Server for Photo-Batch-Processing
EXPOSE 5000 5001 8080

WORKDIR  /usr/src/pando-handbook/middleware-2019/run
CMD ./square
