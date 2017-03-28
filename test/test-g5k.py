#!/usr/bin/env python
import execo
import execo_g5k
import argparse

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

args = parser.parse_args()

nb_nodes = (args.volunteers)
print 'Submitting job request for %i nodes (%i cores)' % (nb_nodes, nb_nodes*8)
[(jobid, site)] = execo_g5k.oarsub([
    (execo_g5k.OarSubmission(
        resources="nodes=%i" % nb_nodes,
        job_type="allow_classic_ssh"),
        "grenoble")
])

workers_cmd = '. pando-computing/test/setup-grid5k.sh ' + \
              ' && electron pando-computing/test/volunteer-tabs 1 %s'
params = execo_g5k.default_oarsh_oarcp_params

if jobid:
    try:
        print 'Waiting for job to start'
        execo_g5k.wait_oar_job_start(jobid, site)
        print 'Retrieving nodes'
        nodes = execo_g5k.get_oar_job_nodes(jobid, site)
        # Open one connection per core (there are 8 cores per node in grenoble)
        cores = nodes * 8
        print 'Starting workers with cmd: ' + workers_cmd % (args.host)
        workers = execo.TaktukRemote(
                workers_cmd % (args.host),
                cores).start()
        # workers.expect('.*loading window.*')
        execo.sleep(90)
        print 'Workers done'

    finally:
        execo_g5k.oardel([(jobid, site)])
