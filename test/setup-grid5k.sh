#!/usr/bin/env bash
sudo-g5k -- apt-get -y install xvfb chromium
export DISPLAY=':99.0'
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
echo 'Worker Setup Completed'
