/**
 * Cloudflare Turnstile ウィジェットコンポーネント
 *
 * Phase 3（GitHub OAuth ログイン）で利用予定。
 * 現時点では未配置（Phase 2 末時点での準備のみ）。
 *
 * 使用方法（Phase 3で配置する際）:
 *   import TurnstileWidget from '@/components/TurnstileWidget';
 *
 *   <TurnstileWidget
 *     siteKey={import.meta.env.PUBLIC_TURNSTILE_SITE_KEY}
 *     onSuccess={(token) => setTurnstileToken(token)}
 *     onError={() => setError('Bot確認に失敗しました')}
 *   />
 *
 * 設置箇所候補（Phase 3）:
 *   - GitHub OAuth ログインボタンの手前
 *   - お問い合わせフォーム（未実装）
 *
 * テストモード:
 *   - サイトキー: 1x00000000000000000000AA（常に成功）
 *   - サイトキー: 2x00000000000000000000AB（常に失敗）
 *   - サイトキー: 3x00000000000000000000FF（インタラクションを要求）
 *
 * 参考: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 */

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpired?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

/**
 * Cloudflare Turnstile ウィジェット
 * Turnstile スクリプトを動的にロードし、ウィジェットをレンダリングする
 */
export default function TurnstileWidget({
  siteKey,
  onSuccess,
  onError,
  onExpired,
  theme = 'auto',
  size = 'normal',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const SCRIPT_ID = 'cf-turnstile-script';

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      // 既存ウィジェットをリセット
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onSuccess,
        'error-callback': onError,
        'expired-callback': onExpired,
        theme,
        size,
      });
    };

    // スクリプトが既にロード済みなら即レンダリング
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // スクリプトを動的にロード
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      // スクリプトタグは存在するが window.turnstile 未初期化（ロード中）
      const checkInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkInterval);
          renderWidget();
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    return () => {
      // クリーンアップ: ウィジェットを削除
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onSuccess, onError, onExpired, theme, size]);

  return <div ref={containerRef} />;
}
