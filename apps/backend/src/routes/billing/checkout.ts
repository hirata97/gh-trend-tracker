/**
 * Stripe Checkoutセッション生成エンドポイント
 * POST /api/billing/checkout
 * Related: fun-049 (Stripe Checkoutセッション生成・リダイレクト), bac-009
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { createCheckoutSession } from '../../services/stripe';
import type { AppEnv } from '../../types/app';
import type { AuthVariables } from '../../middleware/auth';
import type { PlanType } from '../../services/stripe';

const billingCheckout = new Hono<AppEnv & { Variables: AuthVariables }>();

billingCheckout.post('/', authMiddleware, async (c) => {
  const user = c.get('user');

  let body: { plan?: string };
  try {
    body = await c.req.json<{ plan?: string }>();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const plan = body.plan as PlanType | undefined;
  if (!plan || !['PRO', 'ENTERPRISE'].includes(plan)) {
    return c.json({ error: 'Invalid plan. Must be PRO or ENTERPRISE' }, 400);
  }

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  const stripePriceProId = c.env.STRIPE_PRICE_PRO;
  const stripePriceEnterpriseId = c.env.STRIPE_PRICE_ENTERPRISE;
  const frontendUrl = c.env.FRONTEND_URL ?? 'http://localhost:4321';

  if (!stripeSecretKey) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  const stripePriceId = plan === 'PRO' ? stripePriceProId : stripePriceEnterpriseId;
  if (!stripePriceId) {
    return c.json({ error: `Stripe price ID for ${plan} plan not configured` }, 500);
  }

  try {
    const session = await createCheckoutSession({
      userId: user.userId,
      plan,
      stripeSecretKey,
      stripePriceId,
      successUrl: `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/billing/cancel`,
    });

    return c.json({ url: session.url, sessionId: session.sessionId });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return c.json(
      {
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default billingCheckout;
