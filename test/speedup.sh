#!/usr/bin/env bash
DIRNAME=$(dirname $0);
DIR=$DIRNAME/results/speedup/$(date '+%Y-%m-%dT%H:%M:%S'); 
COUNT_NB=$1;
shift 1;
COUNT="$DIRNAME/count $COUNT_NB";
PANDO="node $DIRNAME/../bin/index.js --stdin ";
EXPECT_SQUARE=$DIRNAME/expect-square;
SETTINGS="$DIR/speedup-settings.json"
TIMING="$DIR/timings.txt"
TIME="time"

FUNCTION="$DIRNAME/../examples/square.js";
DELEGATION_FACTOR=1;
MAX_DEGREE=10;
INTERVAL=3000;

mkdir -p $DIR;
echo 'Saving experiment settings in ' $DIR >&2
echo '{ "countNb":'$COUNT_NB', "maxDegree": '$MAX_DEGREE', "function": "'$FUNCTION'", "delegationFactor":'$DELEGATION_FACTOR' }' > $SETTINGS
$COUNT | $PANDO $FUNCTION $@ | $TIME $EXPECT_SQUARE 2> >(tee $TIMING >&2)
