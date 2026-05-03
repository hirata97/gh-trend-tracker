/**
 * 構造化ログユーティリティ
 * Cloudflare Workers環境向けの軽量ロガー
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  level: LogLevel;
  timestamp: string;
  message: string;
  [key: string]: unknown;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 本番環境では 'info' 以上のみ出力
const currentLevel: LogLevel = 'info';

function createEntry(level: LogLevel, message: string, fields?: Record<string, unknown>): LogEntry {
  return {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...fields,
  };
}

function output(level: LogLevel, entry: LogEntry): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, fields?: Record<string, unknown>): void {
    output('debug', createEntry('debug', message, fields));
  },
  info(message: string, fields?: Record<string, unknown>): void {
    output('info', createEntry('info', message, fields));
  },
  warn(message: string, fields?: Record<string, unknown>): void {
    output('warn', createEntry('warn', message, fields));
  },
  error(message: string, fields?: Record<string, unknown>): void {
    output('error', createEntry('error', message, fields));
  },
};
