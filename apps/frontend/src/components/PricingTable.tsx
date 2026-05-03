/**
 * PricingTable Component (scr-008)
 * プラン比較表と課金ボタン
 * Related: fun-049 (Stripe Checkoutセッション生成・リダイレクト)
 */

import { useState } from 'react';
import type { PlanDetail } from '@gh-trend-tracker/shared';

const PLANS: PlanDetail[] = [
  {
    id: 'PRO',
    name: 'PRO',
    priceLabel: '¥500 / 月',
    features: [
      'AIリポジトリ要約（無制限）',
      'トレンドランキング全件表示',
      '週別・月別詳細分析',
      'メールサポート',
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'ENTERPRISE',
    priceLabel: '¥2,000 / 月',
    features: [
      'PROプランの全機能',
      'チーム共有機能',
      'API外部アクセス',
      '優先サポート',
    ],
  },
];

interface PricingTableProps {
  isAuthenticated: boolean;
  currentPlan?: string;
}

export default function PricingTable({ isAuthenticated, currentPlan }: PricingTableProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = (import.meta as { env: Record<string, string> }).env.PUBLIC_API_URL || 'http://localhost:8787';

  async function handlePlanSelect(planId: 'PRO' | 'ENTERPRISE') {
    if (!isAuthenticated) {
      window.location.href = `${API_BASE}/api/auth/login/github`;
      return;
    }

    setLoading(planId);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: planId }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'チェックアウトの開始に失敗しました');
      }

      const data = await response.json() as { url: string };
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
      setLoading(null);
    }
  }

  return (
    <div className="pricing-table">
      {error && (
        <div className="pricing-table__error" role="alert">
          {error}
        </div>
      )}
      <div className="pricing-table__plans">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isLoading = loading === plan.id;

          return (
            <div
              key={plan.id}
              className={`pricing-card ${plan.id === 'PRO' ? 'pricing-card--featured' : ''}`}
            >
              <div className="pricing-card__header">
                <h2 className="pricing-card__name">{plan.name}</h2>
                <p className="pricing-card__price">{plan.priceLabel}</p>
              </div>
              <ul className="pricing-card__features">
                {plan.features.map((feature) => (
                  <li key={feature} className="pricing-card__feature">
                    <span className="pricing-card__check" aria-hidden="true">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="pricing-card__action">
                {isCurrent ? (
                  <span className="pricing-card__badge">現在のプラン</span>
                ) : (
                  <button
                    className={`pricing-card__button ${plan.id === 'PRO' ? 'pricing-card__button--primary' : 'pricing-card__button--secondary'}`}
                    onClick={() => handlePlanSelect(plan.id)}
                    disabled={isLoading || loading !== null}
                  >
                    {isLoading ? '処理中...' : isAuthenticated ? 'このプランを選択' : 'GitHubでログインして開始'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
