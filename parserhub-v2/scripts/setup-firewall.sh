#!/bin/bash

echo "ParserHub v2 방화벽 설정 스크립트"
echo "==============================="
echo ""
echo "다음 포트를 열어야 합니다:"
echo "- 8445 (API)"
echo "- 8446 (Socket.io)"
echo ""
echo "sudo 권한이 필요합니다."
echo ""

# 방화벽 상태 확인
echo "현재 방화벽 상태 확인 중..."
sudo ufw status

echo ""
echo "포트 8445, 8446 열기..."

# 포트 열기
sudo ufw allow 8445/tcp comment 'ParserHub v2 API'
sudo ufw allow 8446/tcp comment 'ParserHub v2 Socket.io'

echo ""
echo "현재 열린 포트 확인:"
sudo ufw status numbered

echo ""
echo "✅ 방화벽 설정 완료!"
echo ""
echo "외부에서 접근 테스트:"
echo "curl http://mkt.techb.kr:8445/health"