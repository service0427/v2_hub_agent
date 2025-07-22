#!/bin/bash

API_KEY="YOUR_API_KEY"
BASE_URL="http://localhost:8447"

echo "================================"
echo "Agent Pool Management Test"
echo "================================"
echo ""

# 1. Pool 상태 확인
echo "### 1. Agent Pool Status ###"
curl -k -s -X GET -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/v2/agents/pool/status" | jq '.'

echo ""
echo "### 2. All Agents ###"
curl -k -s -X GET -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/v2/agents" | jq '.'

echo ""
echo "### 3. Specific Host Status (10.0.1.1) ###"
curl -k -s -X GET -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/v2/agents/host/10.0.1.1" | jq '.'

echo ""
echo "### 4. Simulating Task Assignment ###"
# 여러 개의 작업을 연속으로 할당하여 순차적 할당 테스트
for i in {1..5}; do
  echo "Task $i:"
  curl -k -s -X POST -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"keyword\":\"test-task-$i\",\"limit\":10}" \
    "$BASE_URL/api/v2/search/coupang" | jq -r '.success'
  sleep 1
done

echo ""
echo "### 5. Pool Status After Tasks ###"
curl -k -s -X GET -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/v2/agents/pool/status" | jq '.data | {
    totalHosts: .totalHosts,
    totalInstances: .totalInstances,
    availableInstances: .availableInstances,
    busyInstances: .busyInstances,
    recentAllocations: .allocationSequence
  }'

echo ""
echo "### 6. Active Tasks ###"
curl -k -s -X GET -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/v2/agents/tasks/all?status=processing" | jq '.'

echo ""
echo "================================"
echo "Test completed!"
echo "================================"