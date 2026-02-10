/**
 * MetricsBadge コンポーネント (COM-006)
 * スター増加数/増加率を色付きバッジとして表示する。
 * 使用箇所: TrendList, RepositoryListItem
 */

interface MetricsBadgeProps {
  value: number;
  period: '7d' | '30d';
  type?: 'increase' | 'rate';
}

function getVariant(value: number): 'positive' | 'negative' | 'zero' {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'zero';
}

function getArrow(value: number): string {
  if (value > 0) return '↑';
  if (value < 0) return '↓';
  return '→';
}

function formatValue(value: number, type: 'increase' | 'rate'): string {
  if (type === 'rate') {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString()}`;
}

export default function MetricsBadge({ value, period, type = 'increase' }: MetricsBadgeProps) {
  const variant = getVariant(value);

  return (
    <span className={`metrics-badge metrics-badge--${variant}`}>
      <span className="metrics-badge__arrow">{getArrow(value)}</span>
      <span className="metrics-badge__value">{formatValue(value, type)}</span>
      <span className="metrics-badge__period">/{period}</span>
    </span>
  );
}
