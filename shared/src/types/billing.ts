/**
 * 課金関連の型定義
 * Related: fun-049, fun-050, fun-051
 */

/** 利用可能なプランの種類 */
export type PlanType = 'FREE' | 'PRO' | 'ENTERPRISE';

/** Checkout セッション生成リクエスト */
export type CheckoutRequest = {
  plan: 'PRO' | 'ENTERPRISE';
};

/** Checkout セッション生成レスポンス */
export type CheckoutResponse = {
  url: string;
  sessionId: string;
};

/** プランの詳細情報 */
export type PlanDetail = {
  id: 'PRO' | 'ENTERPRISE';
  name: string;
  priceLabel: string;
  features: string[];
};
