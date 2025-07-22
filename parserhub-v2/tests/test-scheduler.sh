#!/bin/bash

ADMIN_KEY="YOUR_API_KEY"
BASE_URL="http://mkt.techb.kr:8445"

echo "Testing ParserHub v2 Scheduler API..."
echo ""

# Check scheduler status
echo "1. Scheduler Status:"
curl -s -H "X-API-Key: $ADMIN_KEY" "$BASE_URL/api/v2/scheduler/status" | jq .
echo ""

# Get monitoring keywords
echo "2. Monitoring Keywords:"
curl -s -H "X-API-Key: $ADMIN_KEY" "$BASE_URL/api/v2/scheduler/keywords" | jq .
echo ""

# Get keywords due for crawl
echo "3. Keywords Due for Crawl:"
curl -s -H "X-API-Key: $ADMIN_KEY" "$BASE_URL/api/v2/scheduler/keywords/due" | jq .
echo ""

# Add new monitoring keyword
echo "4. Add New Monitoring Keyword:"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"gaming laptop","platform":"coupang","priority":2,"intervalHours":2}' \
  "$BASE_URL/api/v2/scheduler/keywords" | jq .
echo ""

# Get scheduler logs
echo "5. Recent Scheduler Logs:"
curl -s -H "X-API-Key: $ADMIN_KEY" "$BASE_URL/api/v2/scheduler/logs?limit=5" | jq .
echo ""

# Trigger manual ranking crawl
echo "6. Trigger Manual Ranking Crawl:"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" "$BASE_URL/api/v2/scheduler/trigger/ranking-crawl" | jq .
echo ""

# Wait a bit for the crawl to start
echo "Waiting 5 seconds for crawl to process..."
sleep 5

# Check logs again
echo "7. Updated Scheduler Logs:"
curl -s -H "X-API-Key: $ADMIN_KEY" "$BASE_URL/api/v2/scheduler/logs?jobType=ranking_crawl&limit=5" | jq .
echo ""