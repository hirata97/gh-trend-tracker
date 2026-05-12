import { describe, it, expect } from 'vitest';
import { maskEmail, maskTokenValues, createBeforeSend } from './sentry';
import type { Event } from '@sentry/cloudflare';
import type { Bindings } from '../types/bindings';

describe('maskEmail', () => {
  it('メールアドレスをマスクする', () => {
    expect(maskEmail('user@example.com')).toBe('***@***.***');
  });

  it('文字列中に複数のメールアドレスが含まれる場合すべてマスクする', () => {
    const result = maskEmail('from: a@b.com to: c@d.org');
    expect(result).toBe('from: ***@***.*** to: ***@***.***');
  });

  it('メールアドレスが含まれない場合はそのまま返す', () => {
    expect(maskEmail('特に機密情報なし')).toBe('特に機密情報なし');
  });

  it('空文字列の場合はそのまま返す', () => {
    expect(maskEmail('')).toBe('');
  });
});

describe('maskTokenValues', () => {
  it('トークン値を[MASKED]に置換する', () => {
    expect(maskTokenValues('token=ghp_abc123', ['ghp_abc123'])).toBe('token=[MASKED]');
  });

  it('複数のトークンをすべてマスクする', () => {
    const result = maskTokenValues('key1=secret1 key2=secret2', ['secret1', 'secret2']);
    expect(result).toBe('key1=[MASKED] key2=[MASKED]');
  });

  it('空のトークンリストの場合は変更なし', () => {
    expect(maskTokenValues('no change', [])).toBe('no change');
  });

  it('トークンが複数箇所に出現した場合すべて置換する', () => {
    expect(maskTokenValues('abc secret abc secret', ['secret'])).toBe('abc [MASKED] abc [MASKED]');
  });

  it('空文字列のトークンは無視する', () => {
    expect(maskTokenValues('value', ['', 'value'])).toBe('[MASKED]');
  });
});

describe('createBeforeSend', () => {
  const makeEnv = (overrides: Partial<Bindings> = {}): Bindings => ({
    DB: {} as D1Database,
    GITHUB_TOKEN: 'ghp_test_token',
    INTERNAL_API_TOKEN: 'internal_secret',
    GITHUB_CLIENT_ID: '',
    GITHUB_CLIENT_SECRET: '',
    JWT_SECRET: 'jwt_secret',
    ...overrides,
  });

  it('Authorizationヘッダーを除去する', () => {
    const beforeSend = createBeforeSend(makeEnv());
    const event: Event = {
      request: {
        headers: {
          authorization: 'Bearer ghp_test_token',
          'content-type': 'application/json',
        },
      },
    };
    const result = beforeSend(event, {});
    expect(result?.request?.headers).not.toHaveProperty('authorization');
    expect(result?.request?.headers).toHaveProperty('content-type');
  });

  it('GITHUB_TOKENの値をイベント内でマスクする', () => {
    const beforeSend = createBeforeSend(makeEnv());
    const event: Event = {
      exception: {
        values: [
          {
            value: 'request failed with token ghp_test_token in header',
          },
        ],
      },
    };
    const result = beforeSend(event, {});
    expect(JSON.stringify(result)).not.toContain('ghp_test_token');
    expect(JSON.stringify(result)).toContain('[MASKED]');
  });

  it('INTERNAL_API_TOKENの値をイベント内でマスクする', () => {
    const beforeSend = createBeforeSend(makeEnv());
    const event: Event = {
      extra: {
        detail: 'called with internal_secret token',
      },
    };
    const result = beforeSend(event, {});
    expect(JSON.stringify(result)).not.toContain('internal_secret');
    expect(JSON.stringify(result)).toContain('[MASKED]');
  });

  it('メールアドレスをマスクする', () => {
    const beforeSend = createBeforeSend(makeEnv());
    const event: Event = {
      user: {
        email: 'user@example.com',
      },
      extra: {
        message: 'error for user@example.com',
      },
    };
    const result = beforeSend(event, {});
    expect(JSON.stringify(result)).not.toContain('user@example.com');
    expect(JSON.stringify(result)).toContain('***@***.***');
  });

  it('ヘッダーがない場合もエラーなく処理できる', () => {
    const beforeSend = createBeforeSend(makeEnv());
    const event: Event = {
      exception: {
        values: [{ value: 'some error' }],
      },
    };
    expect(() => beforeSend(event, {})).not.toThrow();
  });

  it('SENTRY_DSNが未設定の場合も機能する', () => {
    const beforeSend = createBeforeSend(makeEnv({ SENTRY_DSN: undefined }));
    const event: Event = { message: 'test' };
    expect(() => beforeSend(event, {})).not.toThrow();
  });
});
