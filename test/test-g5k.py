#!/usr/bin/env python
import execo
import execo_g5k
import argparse
from cmd import Cmd
import signal
import sys

parser = argparse.ArgumentParser(
        description='Run the spawn-node/volunteer test on Grid5000')
parser.add_argument(
        'volunteers',
        metavar='N',
        type=int,
        help='number of volunteer nodes to use (8 cores per node)',
        default=1)
parser.add_argument(
        'host',
        type=str,
        help='host to connect to',
        default='localhost:5000')
parser.add_argument(
        'nb_tabs',
        type=int,
        help='number of browser tabs to open on each core',
        default=1)

parser.add_argument(
        'nb_cores',
        type=int,
        help='number of cores to use on each node',
        default=1)

args = parser.parse_args()

nb_nodes = (args.volunteers)
print 'Submitting job request for %i nodes (%i cores)' % (nb_nodes, nb_nodes*8)
[(jobid, site)] = execo_g5k.oarsub([
    (execo_g5k.OarSubmission(
        resources="nodes=%i" % nb_nodes,
        job_type="allow_classic_ssh"),
        "grenoble")
])

# workers_cmd = '. pando-computing/test/setup-grid5k.sh ' + \
#              ' && electron pando-computing/test/volunteer-tabs %s %s' % \
#              (args.nb_tabs, args.host)
setup_cmd = ". ~/pando-computing/test/setup-grid5k.sh"

# workers_cmd = 'electron pando-computing/test/volunteer-tabs %s %s' % \
#               (args.nb_tabs, args.host)
#workers_cmd = "Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &" + \
#              "export DISPLAY=':99.0'; " + \
#              'electron pando-computing/test/volunteer-tabs %s %s' % \
#               (args.nb_tabs, args.host)
workers_cmd = 'pando-computing/test/chromium-tabs %s %s' % \
               (args.nb_tabs, args.host)


params = execo_g5k.default_oarsh_oarcp_params

interrupted = False


def signal_handler(signal, frame):
    global interrupted, workers, jobid, site
    if interrupted:
        print('\n Releasing nodes')
        execo_g5k.oardel([(jobid, site)])
        sys.exit(1)
    else:
        print('\n  Press Ctrl+C again to exit')
        interrupted = True
        if workers is not None:
            workers.kill()

signal.signal(signal.SIGINT, signal_handler)


class App(Cmd):
    def default(self, line):
        global interrupted, workers, cores
        interrupted = False
        print 'interrupting previous command'
        workers.kill()
        execo.sleep(1)
        print 'sending command: ' + line
        workers = execo.Remote(
                line,
                cores).start()

app = App()

if jobid:
    try:
        print 'Waiting for job to start'
        execo_g5k.wait_oar_job_start(jobid, site)
        print 'Retrieving nodes'
        nodes = execo_g5k.get_oar_job_nodes(jobid, site)
        # Setup nodes
        print 'Preparing workers with cmd: ' + setup_cmd
        workers = execo.Remote(
                setup_cmd,
                nodes).start()
        workers.expect('Worker Setup Completed')
        workers.kill()
        # Possibly open more than one connection per machine
        cores = nodes * args.nb_cores
        print cores
        print 'Example cmd: %s' % (workers_cmd)
        app.prompt = '%s (%d node(s), %d core(s)/node)> ' % (site, args.volunteers, args.nb_cores)
	app.cmdloop()
        # execo.sleep(600)
        # print 'Workers done'

    finally:
        execo_g5k.oardel([(jobid, site)])
