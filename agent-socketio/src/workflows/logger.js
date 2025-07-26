/**
 * 워크플로우용 로거 모듈
 * 타임스탬프와 함께 로그를 출력
 */

class Logger {
  constructor(prefix = '') {
    this.prefix = prefix;
  }

  // 현재 시간을 포맷팅
  getTimestamp() {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8); // HH:MM:SS
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `[${time}.${ms}]`;
  }

  // 기본 로그
  log(...args) {
    console.log(this.getTimestamp(), this.prefix, ...args);
  }

  // 정보 로그 (파란색)
  info(...args) {
    console.log('\x1b[34m' + this.getTimestamp(), this.prefix, ...args, '\x1b[0m');
  }

  // 성공 로그 (초록색)
  success(...args) {
    console.log('\x1b[32m' + this.getTimestamp(), this.prefix, '✓', ...args, '\x1b[0m');
  }

  // 경고 로그 (노란색)
  warn(...args) {
    console.log('\x1b[33m' + this.getTimestamp(), this.prefix, '⚠️', ...args, '\x1b[0m');
  }

  // 에러 로그 (빨간색)
  error(...args) {
    console.log('\x1b[31m' + this.getTimestamp(), this.prefix, '❌', ...args, '\x1b[0m');
  }

  // 디버그 로그 (회색)
  debug(...args) {
    console.log('\x1b[90m' + this.getTimestamp(), this.prefix, '[DEBUG]', ...args, '\x1b[0m');
  }

  // 구분선
  separator() {
    console.log(this.getTimestamp(), '─'.repeat(50));
  }
}

// 팩토리 함수
function createLogger(prefix) {
  return new Logger(prefix);
}

module.exports = { Logger, createLogger };