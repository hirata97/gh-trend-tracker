/**
 * Stripeサービス
 * Stripe APIとの連携処理
 * Related: fun-049, fun-050, fun-051
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';

export type PlanType = 'PRO' | 'ENTERPRISE';

export interface CheckoutSessionParams {
  userId: string;
  plan: PlanType;
  stripeSecretKey: string;
  stripePriceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

/**
 * Stripe Checkoutセッションを生成する
 * fun-049: Stripe Checkoutセッション生成・リダイレクト
 */
export async function createCheckoutSession(
  params: CheckoutSessionParams
): Promise<CheckoutSessionResult> {
  const { userId, stripeSecretKey, stripePriceId, successUrl, cancelUrl } = params;

  const body = new URLSearchParams({
    'line_items[0][price]': stripePriceId,
    'line_items[0][quantity]': '1',
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    'metadata[user_id]': userId,
    'metadata[plan]': params.plan,
  });

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: { message?: string } };
    throw new Error(`Stripe API error: ${error.error?.message ?? response.statusText}`);
  }

  const session = await response.json() as { id: string; url: string };
  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Stripe Webhookの署名を検証する
 * fun-050: Stripe Webhookによる決済イベント受信
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): Promise<boolean> {
  // Stripe署名フォーマット: t=タイムスタンプ,v1=署名
  const parts = signature.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return false;
  }

  const timestamp = timestampPart.split('=')[1];
  const expectedSignature = signaturePart.split('=')[1];

  // HMAC-SHA256で署名を生成
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // タイミング安全な比較
  if (computedSignature.length !== expectedSignature.length) {
    return false;
  }

  let isValid = true;
  for (let i = 0; i < computedSignature.length; i++) {
    if (computedSignature[i] !== expectedSignature[i]) {
      isValid = false;
    }
  }

  // 5分以内のリクエストのみ受け付ける（リプレイ攻撃対策）
  const webhookTimestamp = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - webhookTimestamp) > 300) {
    return false;
  }

  return isValid;
}

/**
 * 決済成功時にユーザープランを更新する
 * fun-051: 決済成功時のユーザー課金プラン有効化処理
 */
export async function activateUserPlan(
  db: DrizzleD1Database,
  userId: string,
  plan: PlanType,
  stripeCustomerId: string
): Promise<void> {
  // サブスクリプション有効期限を1ヶ月後に設定
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  await db
    .update(users)
    .set({
      plan,
      stripeCustomerId,
      subscriptionExpiresAt: expiresAt.toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId))
    .run();
}

/**
 * サブスクリプションキャンセル時にユーザーをFREEプランに戻す
 */
export async function deactivateUserPlan(
  db: DrizzleD1Database,
  stripeCustomerId: string
): Promise<void> {
  await db
    .update(users)
    .set({
      plan: 'FREE',
      subscriptionExpiresAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.stripeCustomerId, stripeCustomerId))
    .run();
}
