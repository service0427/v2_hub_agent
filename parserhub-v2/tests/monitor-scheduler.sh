#!/bin/bash

echo "Monitoring scheduler logs in real-time..."
echo "The scheduler should run every 5 minutes (*/5 * * * *)"
echo "Waiting for scheduled crawls..."
echo "========================================"
echo ""

# Follow logs and highlight scheduler-related messages
docker compose logs -f api | grep -E --color=always "(scheduler|Scheduler|crawl|Crawl|keyword|ranking_crawl)"