#!/usr/bin/env bash
DIRNAME=$(dirname $0);
DIR=$DIRNAME/results/$(date '+%Y-%M-%dT%H:%M:%S'); 
COUNT=$DIRNAME/count;
PANDO="node $DIRNAME/../bin/index.js --stdin --start-idle --headless --global-monitoring";
EXPECT_SQUARE=$DIRNAME/expect-square;
MEASURE_THROUGHPUT=$DIRNAME/measure-throughput;
LOG="tee $DIR/throughput.jsonl"

FUNCTION="$DIRNAME/../examples/square.js";
DELEGATION_FACTOR=$2;
MAX_DEGREE=$3;

mkdir -p $DIR;
echo 'Saving experiment results in ' $DIR
$COUNT | $PANDO $FUNCTION | $EXPECT_SQUARE | $MEASURE_THROUGHPUT 3000 | $LOG



