[ ] Prepare Demo for Tuesday
  [x] Make the pando executable use the new topology
  [x] Commit changes
  [x] Repackage electron-tabs as 'pando-volunteer' executable to easily start multiple volunteers
  [ ] Disconnect the nodes when no status has been provided for more than 5 * status-refresh-interval
  [ ] Show the number of leaf nodes as a function of time (elasticity)
  [ ] Add more statistics about the tree topology (depth, total number of nodes, avg task time)
  [ ] Produce graphs of:
     [ ] Maximum number of connected nodes
     [ ] Connected number of nodes over time
     [ ] Normalized task completion rate (Task nb / Avg task time)
     [ ] Max throughput with various rate-adjustment strategies
     [ ] Recovery time during failure
     [ ] Max throughput after failure as a function of failure rate 
[ ] Add fault-tolerance for connected children that become unresponsive (close connection after 3avg_task_time)
[ ] Ensure the design is reversible (works while the number of nodes is growing or shrinking) and elastic (quickly adapts to a high number of nodes that joins or leave)
[ ] Fix bug where the pull-lend-stream does not end in some cases
[ ] Fix bug in which the same value is sent multiple times
[ ] Test scaling with volunteer-tabs
    * Identify bottlenecks (CPU, Memory, Bandwidth)
    * Optimal number of WebRTC connections (that maximizes the number of jobs that can be sent per second)
    * Latency tests between the various grid5k sites
[ ] Add option to specify the functor argument using simply the npm package name
[ ] Add support for starting on additional cores on the same machine (--cores=N (true, N=1)) 
[ ] Add support for grid5k (--grid5k=N (false, N=0))
[ ] Add integration with Twitter to enable volunteers to connect automatically to newer streams produced by a specific user
[ ] File paths or urls should mapped to JavaScript ArrayBuffers. It is
    the responsibility of the module to convert that ArrayBuffer to an
    appropriate format for processing;
[ ] Add support for WebTorrent to distribute input files
[ ] Create pull-request for adding path option to pull-ws
[ ] Fix closing bug by adding a close method on lenders
[ ] Rewrite pando tool for electron to remove the overhead of electron-webrtc
[ ] Refactor to clarify newer abstractions
[ ] Create a pull module for requesting values and producing results 
    outside of a stream
[x] Add support for WebRTC with a direct connection to the client
    * Adapt heroku code to enable WebRTC signaling
[x] Add support for stdin
[x] Migrate public-server into its own repository
[x] Add a scalable connectivity scheme
    [x] Make pull-limit dynamically adjustable
    [x] Add Ids
    [x] Add routing route to public-server
    [x] Add coordinator code
    [x] Add handling of coordinators
    [x] Stop processing once a child connects
[x] Add monitoring abstractions
[x] Design adaptative limit based on the rate of results vs rate of values
