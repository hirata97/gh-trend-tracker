/**
 * Sentryマスキング処理のユニットテスト
 */
import { describe, it, expect } from 'vitest';
import { maskSensitiveData, createBeforeSend, createSentryConfig } from './sentry';
import type { ErrorEvent } from '@sentry/cloudflare';

function buildEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    timestamp: 1000000,
    ...overrides,
  };
}

describe('maskSensitiveData', () => {
  it('Authorizationヘッダーをマスクする', () => {
    const event = buildEvent({
      request: {
        headers: {
          Authorization: 'Bearer ghp_supersecrettoken123',
          'Content-Type': 'application/json',
        },
      },
    });

    const result = maskSensitiveData(event, []);

    expect(JSON.stringify(result)).not.toContain('ghp_supersecrettoken123');
    expect(JSON.stringify(result)).toContain('[MASKED]');
  });

  it('小文字のauthorizationヘッダーもマスクする', () => {
    const event = buildEvent({
      request: {
        headers: {
          authorization: 'Bearer ghp_secrettoken',
        },
      },
    });

    const result = maskSensitiveData(event, []);

    expect(JSON.stringify(result)).not.toContain('ghp_secrettoken');
    expect(JSON.stringify(result)).toContain('[MASKED]');
  });

  it('sensitiveValuesに含まれる値をマスクする', () => {
    const githubToken = 'ghp_realGithubToken123456789';
    const internalToken = 'internal-secret-token-xyz';

    const event = buildEvent({
      message: `Error with token ${githubToken} and ${internalToken}`,
    });

    const result = maskSensitiveData(event, [githubToken, internalToken]);

    expect(JSON.stringify(result)).not.toContain(githubToken);
    expect(JSON.stringify(result)).not.toContain(internalToken);
  });

  it('メールアドレスをマスクする', () => {
    const event = buildEvent({
      message: 'User user@example.com logged in',
      extra: {
        email: 'admin@company.org',
      },
    });

    const result = maskSensitiveData(event, []);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('user@example.com');
    expect(serialized).not.toContain('admin@company.org');
    expect(serialized).toContain('***@***.***');
  });

  it('機密情報が含まれない場合はイベントをそのまま返す', () => {
    const event = buildEvent({
      message: 'Normal error occurred',
      extra: { code: 500 },
    });

    const result = maskSensitiveData(event, []);

    expect(result?.message).toBe('Normal error occurred');
  });

  it('空のsensitiveValuesは無視する', () => {
    const event = buildEvent({ message: 'test' });

    const result = maskSensitiveData(event, ['', '   '.trim()]);

    expect(result).not.toBeNull();
    expect(result?.message).toBe('test');
  });
});

describe('createBeforeSend', () => {
  it('GITHUB_TOKENをマスクする', () => {
    const beforeSend = createBeforeSend({ GITHUB_TOKEN: 'ghp_mytoken' });
    const event = buildEvent({ message: 'token: ghp_mytoken in message' });

    const result = beforeSend(event);

    expect(JSON.stringify(result)).not.toContain('ghp_mytoken');
  });

  it('INTERNAL_API_TOKENをマスクする', () => {
    const beforeSend = createBeforeSend({ INTERNAL_API_TOKEN: 'my-internal-token' });
    const event = buildEvent({ message: 'called with my-internal-token' });

    const result = beforeSend(event);

    expect(JSON.stringify(result)).not.toContain('my-internal-token');
  });

  it('環境変数が未設定の場合でもクラッシュしない', () => {
    const beforeSend = createBeforeSend({});
    const event = buildEvent({ message: 'normal error' });

    expect(() => beforeSend(event)).not.toThrow();
  });
});

describe('createSentryConfig', () => {
  it('SENTRY_DSNを設定に含める', () => {
    const config = createSentryConfig({ SENTRY_DSN: 'https://key@sentry.io/123' });

    expect(config.dsn).toBe('https://key@sentry.io/123');
  });

  it('ENVIRONMENTが未設定の場合はdevelopmentを使用する', () => {
    const config = createSentryConfig({});

    expect(config.environment).toBe('development');
  });

  it('ENVIRONMENTを設定に反映する', () => {
    const config = createSentryConfig({ ENVIRONMENT: 'production' });

    expect(config.environment).toBe('production');
  });

  it('beforeSendが関数として返される', () => {
    const config = createSentryConfig({});

    expect(typeof config.beforeSend).toBe('function');
  });
});
