#!/bin/bash

set -e
#set -x


NVM=/dvl/nvm/nvm.sh
VERSIONS="0.10 0.12 iojs-v1 iojs-v2 iojs-v3 4.0 4.1"

source $NVM

for V in $VERSIONS; do
  echo "using node version $V"
  rm -rf node_modules
  nvm use $V
  npm install
  npm run test
done
