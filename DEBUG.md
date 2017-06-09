# Personal notes for debugging Pando

When an external library is buggy it may be useful to use a segfault handler to debug. If needed add the following lines in bin/index.js:

var SegfaultHandler = require('segfault-handler')
SegfaultHandler.registerHandler('crash.log') // With no argument, SegfaultHandler will generate a generic log file name

However, by default it is not used because the library cannot be installed on Travis-CI, which we use for continuous integration.
