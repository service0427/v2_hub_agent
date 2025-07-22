#!/bin/bash

echo "================================"
echo "ParserHub v2 API Key Test"
echo "================================"
echo ""

# Test 1: Default Client
echo "### Test 1: Default Client (YOUR_TEST_API_KEY) ###"
echo "Rate limit: 1000/hour, Daily limit: 10000/day"
echo ""
curl -X GET "http://localhost:8447/api/v2/public/ranking/coupang?key=YOUR_TEST_API_KEY&keyword=%EB%85%B8%ED%8A%B8%EB%B6%81&code=12345" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Test 2: Test Client
echo "### Test 2: Test Client (YOUR_TEST_API_KEY_2) ###"
echo "Rate limit: 100/hour, Daily limit: 1000/day"
echo ""
curl -X GET "http://localhost:8447/api/v2/public/ranking/naver_store?key=YOUR_TEST_API_KEY_2&keyword=%EB%A7%88%EC%9A%B0%EC%8A%A4&code=67890" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Test 3: Demo Client
echo "### Test 3: Demo Client (YOUR_TEST_API_KEY_3) ###"
echo "Rate limit: 500/hour, Daily limit: 5000/day"
echo ""
curl -X GET "http://localhost:8447/api/v2/public/ranking/naver_compare?key=YOUR_TEST_API_KEY_3&keyword=%ED%82%A4%EB%B3%B4%EB%93%9C&code=54321" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Test 4: Invalid API Key
echo "### Test 4: Invalid API Key ###"
echo ""
curl -X GET "http://localhost:8447/api/v2/public/ranking/coupang?key=invalid_key_12345&keyword=%EB%85%B8%ED%8A%B8%EB%B6%81&code=12345" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Test 5: Missing API Key
echo "### Test 5: Missing API Key ###"
echo ""
curl -X GET "http://localhost:8447/api/v2/public/ranking/coupang?keyword=%EB%85%B8%ED%8A%B8%EB%B6%81&code=12345" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "================================"
echo "Test completed!"
echo "================================"