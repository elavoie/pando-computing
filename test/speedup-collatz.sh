#!/usr/bin/env bash
DIRNAME=$(dirname $0);
DIR=$DIRNAME/results/speedup/$(date '+%Y-%m-%dT%H:%M:%S'); 
DIR=$DIRNAME/results/speedup-collatz/$(date '+%Y-%m-%dT%H:%M:%S'); 
COUNT_NB=$1;
shift 1;
COUNT="$DIRNAME/count-range-bignum 175 3179389980591125407167";
PANDO="node $DIRNAME/../bin/index.js --stdin ";
SETTINGS="$DIR/speedup-settings.json"
TIMING="$DIR/timings.txt"
TIME="time"

FUNCTION="$DIRNAME/../examples/collatz-range-bignum.js";
DELEGATION_FACTOR=1;
MAX_DEGREE=10;
INTERVAL=3000;

mkdir -p $DIR;
echo 'Saving experiment settings in ' $DIR >&2
echo '{ "countNb":'$COUNT_NB', "maxDegree": '$MAX_DEGREE', "function": "'$FUNCTION'", "delegationFactor":'$DELEGATION_FACTOR' }' > $SETTINGS
$COUNT | head -n $COUNT_NB | $PANDO $FUNCTION $@ | pv -l
