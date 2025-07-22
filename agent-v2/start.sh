#!/bin/bash
INSTANCES=${1:-1}

# Create logs directory if it doesn't exist
mkdir -p logs

if [ "$INSTANCES" -eq 1 ]; then
    node src/index.js 3001 1
else
    for i in $(seq 1 $INSTANCES); do
        echo "Starting agent instance $i..."
        nohup node src/index.js $((3000 + i)) $i > logs/agent_$i.log 2>&1 &
        echo "Instance $i started with PID $!"
        sleep 2
    done
fi