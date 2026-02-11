/**
 * JWTサービス
 */

import type { JwtPayload } from '@gh-trend-tracker/shared';

/**
 * JWT生成オプション
 */
type JwtOptions = {
  /** 有効期限（秒）デフォルト: 30日 */
  expiresIn?: number;
};

/**
 * JWT検証結果
 */
export type JwtVerifyResult =
  | { valid: true; payload: JwtPayload }
  | { valid: false; error: string };

/**
 * JWTを生成する（HS256）
 *
 * @param payload - JWTペイロード（userId, usernameなど）
 * @param secret - JWT署名用シークレット
 * @param options - オプション（有効期限など）
 * @returns JWT文字列
 */
export async function generateJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  options: JwtOptions = {}
): Promise<string> {
  const { expiresIn = 30 * 24 * 60 * 60 } = options; // デフォルト30日

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const message = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHmacSha256(message, secret);
  const encodedSignature = base64UrlEncode(signature);

  return `${message}.${encodedSignature}`;
}

/**
 * JWTを検証する
 *
 * @param token - JWT文字列
 * @param secret - JWT署名用シークレット
 * @returns 検証結果
 */
export async function verifyJwt(token: string, secret: string): Promise<JwtVerifyResult> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const message = `${encodedHeader}.${encodedPayload}`;

    // 署名検証
    const expectedSignature = await signHmacSha256(message, secret);
    const expectedEncodedSignature = base64UrlEncode(expectedSignature);

    if (encodedSignature !== expectedEncodedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    // ペイロード検証
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;

    // 有効期限チェック
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: `Verification failed: ${error}` };
  }
}

/**
 * HMAC-SHA256署名を生成する
 *
 * @param message - 署名対象のメッセージ
 * @param secret - 署名用シークレット
 * @returns 署名バイナリ
 */
async function signHmacSha256(message: string, secret: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  return await crypto.subtle.sign('HMAC', key, messageData);
}

/**
 * Base64 URL エンコード
 *
 * @param data - 文字列またはバイナリ
 * @returns Base64 URL エンコードされた文字列
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;

  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    const uint8Array = new Uint8Array(data);
    const binaryString = String.fromCharCode(...uint8Array);
    base64 = btoa(binaryString);
  }

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64 URL デコード
 *
 * @param data - Base64 URL エンコードされた文字列
 * @returns デコードされた文字列
 */
function base64UrlDecode(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(paddedBase64);
}
