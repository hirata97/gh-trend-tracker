/**
 * 認証関連の型定義
 */

/**
 * JWTペイロード
 */
export type JwtPayload = {
  /** ユーザーID (UUID) */
  userId: string;
  /** GitHubユーザー名 */
  username: string;
  /** 発行日時（UNIX timestamp） */
  iat: number;
  /** 有効期限（UNIX timestamp） */
  exp: number;
};

/**
 * GitHubユーザー情報（GitHub APIレスポンス）
 */
export type GitHubUser = {
  id: number;
  login: string;
  email?: string | null;
  avatar_url?: string;
  name?: string | null;
};

/**
 * GitHubトークン交換レスポンス
 */
export type GitHubTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
};

/**
 * 認証コールバックエラー
 */
export type AuthCallbackError = {
  error: string;
  error_description?: string;
};
