#!/bin/bash

echo "================================"
echo "ParserHub v2 Quick Test Examples"
echo "================================"
echo ""

echo "### 1. 공개 API - 브라우저에서 직접 열기 ###"
echo "아래 URL을 브라우저에 복사하여 붙여넣으세요:"
echo ""
echo "쿠팡 노트북 검색:"
echo "http://localhost:8447/api/v2/public/ranking/coupang?key=YOUR_TEST_API_KEY&keyword=%EB%85%B8%ED%8A%B8%EB%B6%81&code=12345"
echo ""

echo "### 2. 공개 API - cURL 테스트 ###"
echo "터미널에서 실행:"
echo ""
echo "curl -X GET \"http://localhost:8447/api/v2/public/ranking/coupang?key=YOUR_TEST_API_KEY&keyword=%EB%85%B8%ED%8A%B8%EB%B6%81&code=12345\""
echo ""

echo "### 3. 워크플로우 API - cURL 테스트 ###"
echo "검색 워크플로우 실행:"
echo ""
cat << 'EOF'
curl -X POST "http://localhost:8447/api/v2/workflows/coupang/execute" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "search",
    "params": {
      "keyword": "노트북",
      "pages": 1,
      "limit": 10
    }
  }'
EOF

echo ""
echo "================================"
echo "한글 URL 인코딩 참고:"
echo "노트북 = %EB%85%B8%ED%8A%B8%EB%B6%81"
echo "마우스 = %EB%A7%88%EC%9A%B0%EC%8A%A4"
echo "키보드 = %ED%82%A4%EB%B3%B4%EB%93%9C"
echo "================================"