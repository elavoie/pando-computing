[ ] Fix closing bug by adding a close method on lenders
[ ] Plan demo and talk
    * Demo a few unixy processing pipelines
    * Demo scaling to 10-100 nodes
    * Explain the proposal for scaling up
[ ] Refactor to clarify newer abstractions
[ ] Add a scalable connectivity scheme
[ ] Create a pull module for requesting values and producing results 
    outside of a stream
[ ] Add option to specify the functor argument using simply the npm package name
[ ] Add support for starting on additional cores on the same machine (--cores=N (true, N=1)) 
[ ] Add support for grid5k (--grid5k=N (false, N=0))
[ ] Add integration with Twitter to enable volunteers to connect automatically to newer streams produced by a specific user
[ ] File paths or urls should mapped to JavaScript ArrayBuffers. It is
    the responsibility of the module to convert that ArrayBuffer to an
    appropriate format for processing;
[ ] Add support for WebTorrent to distribute input files
[ ] Create pull-request for adding path option to pull-ws
[x] Add support for WebRTC with a direct connection to the client
    * Adapt heroku code to enable WebRTC signaling
[x] Add support for stdin
