#!/usr/bin/env bash
DIR=$(date '+%Y-%M-%dT%H:%M:%S'); 
DIRNAME=$(dirname $0);
COUNT=$DIRNAME/count;
PANDO="node $DIRNAME/../bin/index.js --stdin --start-idle";
EXPECT_SQUARE=$DIRNAME/expect-square;
MEASURE_THROUGHPUT=$DIRNAME/measure-throughput;
LOG="tee $DIR/throughput.jsonl"

FUNCTION="$DIRNAME/../examples/square.js";
DELEGATION_FACTOR=$2;
MAX_DEGREE=$3;

mkdir $DIR;
$COUNT | $PANDO $FUNCTION | $EXPECT_SQUARE | $MEASURE_THROUGHPUT 1000 | $LOG



