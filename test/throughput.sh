#!/usr/bin/env bash
DIRNAME=$(dirname $0);
DIR=$DIRNAME/results/throughput/$(date '+%Y-%m-%dT%H:%M:%S');
COUNT=$DIRNAME/count;
PANDO="node $DIRNAME/../bin/index.js --stdin "$@;
EXPECT_SQUARE=$DIRNAME/expect-square;
MEASURE_THROUGHPUT=$DIRNAME/measure-throughput;
LOG="tee $DIR/throughput-measurements.jsonl"
SETTINGS="$DIR/throughput-settings.json"

FUNCTION="$DIRNAME/../examples/square.js";
DELEGATION_FACTOR=1;
MAX_DEGREE=10;
INTERVAL=3000;

mkdir -p $DIR;
echo 'Saving experiment settings in ' $DIR
echo '{ "maxDegree": '$MAX_DEGREE', "function": "'$FUNCTION'", "delegationFactor":'$DELEGATION_FACTOR' }' > $SETTINGS
$COUNT | $PANDO $FUNCTION | $EXPECT_SQUARE | $MEASURE_THROUGHPUT $INTERVAL | $LOG
