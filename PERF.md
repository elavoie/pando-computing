# Maximum number of concurrent connections

got 70 concurrent webrtc connections using 50% CPU and 160 Mo of memory
which would produce their 70 items/s

when trying quickly connection 100 volunteers (2X 50) could not reach 
100 items/s, somehow CPU saturates and the nubmer of items drops to about
30-40 items/s

After disconnecting 50 volunteers, number of items goes down to 2/s. The system
could not recover from a quick disconnection.

## EPIPE errors when the webrtc connections are established through heroku for signaling

# Maximum throughput 

## Single connection

Chrome, Macbook Air (Same-machine) ~1k items/s
Chrome, bobcat (linux) ~ 300 items/s


