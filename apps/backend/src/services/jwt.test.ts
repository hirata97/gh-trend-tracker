/**
 * JWTサービスのテスト
 */

import { describe, it, expect } from 'vitest';
import { generateJwt, verifyJwt } from './jwt';

describe('JWT Service', () => {
  const testSecret = 'test-secret-key';

  describe('generateJwt', () => {
    it('JWTを正常に生成できる', async () => {
      const payload = {
        userId: 'test-user-id',
        username: 'testuser',
      };

      const jwt = await generateJwt(payload, testSecret);

      expect(jwt).toBeDefined();
      expect(typeof jwt).toBe('string');
      expect(jwt.split('.')).toHaveLength(3);
    });

    it('カスタム有効期限を設定できる', async () => {
      const payload = {
        userId: 'test-user-id',
        username: 'testuser',
      };
      const expiresIn = 3600; // 1時間

      const jwt = await generateJwt(payload, testSecret, { expiresIn });
      const result = await verifyJwt(jwt, testSecret);

      expect(result.valid).toBe(true);
      if (result.valid) {
        const now = Math.floor(Date.now() / 1000);
        expect(result.payload.exp).toBeGreaterThan(now);
        expect(result.payload.exp).toBeLessThanOrEqual(now + expiresIn + 1);
      }
    });
  });

  describe('verifyJwt', () => {
    it('有効なJWTを検証できる', async () => {
      const payload = {
        userId: 'test-user-id',
        username: 'testuser',
      };

      const jwt = await generateJwt(payload, testSecret);
      const result = await verifyJwt(jwt, testSecret);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.userId).toBe(payload.userId);
        expect(result.payload.username).toBe(payload.username);
        expect(result.payload.iat).toBeDefined();
        expect(result.payload.exp).toBeDefined();
      }
    });

    it('不正な署名のJWTを拒否する', async () => {
      const payload = {
        userId: 'test-user-id',
        username: 'testuser',
      };

      const jwt = await generateJwt(payload, testSecret);
      const result = await verifyJwt(jwt, 'wrong-secret');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Invalid signature');
      }
    });

    it('期限切れのJWTを拒否する', async () => {
      const payload = {
        userId: 'test-user-id',
        username: 'testuser',
      };

      // 有効期限を過去に設定
      const jwt = await generateJwt(payload, testSecret, { expiresIn: -1 });
      const result = await verifyJwt(jwt, testSecret);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Token expired');
      }
    });

    it('不正なフォーマットのJWTを拒否する', async () => {
      const result = await verifyJwt('invalid.token', testSecret);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Invalid token format');
      }
    });
  });
});
