/**
 * Stripe Webhookエンドポイント
 * POST /api/webhook/stripe
 * Related: fun-050 (Stripe Webhookによる決済イベント受信), fun-051, bac-010
 */

import { Hono } from 'hono';
import { verifyWebhookSignature, activateUserPlan, deactivateUserPlan } from '../../services/stripe';
import type { AppEnv } from '../../types/app';
import type { PlanType } from '../../services/stripe';

const stripeWebhook = new Hono<AppEnv>();

stripeWebhook.post('/', async (c) => {
  const stripeSignature = c.req.header('stripe-signature');
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSignature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  if (!webhookSecret) {
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  const rawBody = await c.req.text();

  // 署名検証
  const isValid = await verifyWebhookSignature(rawBody, stripeSignature, webhookSecret);
  if (!isValid) {
    return c.json({ error: 'Invalid webhook signature' }, 400);
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  const db = c.get('db');

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // 決済成功：ユーザープランを有効化
        const session = event.data.object as {
          metadata?: { user_id?: string; plan?: string };
          customer?: string;
          payment_status?: string;
        };

        if (session.payment_status !== 'paid') {
          break;
        }

        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan as PlanType | undefined;
        const stripeCustomerId = session.customer;

        if (!userId || !plan || !stripeCustomerId) {
          console.error('Webhook: missing metadata in checkout.session.completed', {
            userId,
            plan,
            stripeCustomerId,
          });
          break;
        }

        await activateUserPlan(db, userId, plan, stripeCustomerId);
        console.log(`プラン有効化: userId=${userId}, plan=${plan}`);
        break;
      }

      case 'customer.subscription.deleted': {
        // サブスクリプションキャンセル：FREEプランに戻す
        const subscription = event.data.object as { customer?: string };
        const stripeCustomerId = subscription.customer;

        if (!stripeCustomerId) {
          console.error('Webhook: missing customer in customer.subscription.deleted');
          break;
        }

        await deactivateUserPlan(db, stripeCustomerId);
        console.log(`プラン無効化: stripeCustomerId=${stripeCustomerId}`);
        break;
      }

      default:
        // 未処理のイベントは無視
        break;
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

export default stripeWebhook;
