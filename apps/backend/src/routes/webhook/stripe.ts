/**
 * Stripe Webhookエンドポイント
 * POST /api/webhook/stripe
 * Related: fun-050 (Stripe Webhookによる決済イベント受信), fun-051, bac-010
 */

import { Hono } from 'hono';
import { logger } from '../../utils/logger';
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
          logger.error('webhook_checkout_missing_metadata', {
            userId,
            plan,
            stripeCustomerId,
          });
          break;
        }

        await activateUserPlan(db, userId, plan, stripeCustomerId);
        logger.info('webhook_plan_activated', { userId, plan });
        break;
      }

      case 'customer.subscription.deleted': {
        // サブスクリプションキャンセル：FREEプランに戻す
        const subscription = event.data.object as { customer?: string };
        const stripeCustomerId = subscription.customer;

        if (!stripeCustomerId) {
          logger.error('webhook_subscription_missing_customer', {});
          break;
        }

        await deactivateUserPlan(db, stripeCustomerId);
        logger.info('webhook_plan_deactivated', { stripeCustomerId });
        break;
      }

      default:
        // 未処理のイベントは無視
        break;
    }

    return c.json({ received: true });
  } catch (error) {
    const traceId = crypto.randomUUID();
    logger.error('webhook_processing_failed', {
      traceId,
      errorMessage: error instanceof Error ? error.message : 'unknown',
    });
    return c.json({ error: 'Webhook processing failed', traceId }, 500);
  }
});

export default stripeWebhook;
