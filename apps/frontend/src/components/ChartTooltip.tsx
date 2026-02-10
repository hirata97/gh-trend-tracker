/**
 * ChartTooltip Component
 * Custom Recharts tooltip for star history chart
 * Displays date, star count, and daily increase
 */

interface TooltipPayload {
  date: string;
  stars: number;
  dailyIncrease: number | null;
  displayDate: string;
}

interface Props {
  active?: boolean;
  payload?: Array<{
    payload: TooltipPayload;
  }>;
}

export default function ChartTooltip({ active, payload }: Props) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;
  const increaseText =
    data.dailyIncrease !== null
      ? `${data.dailyIncrease >= 0 ? '+' : ''}${data.dailyIncrease.toLocaleString()}`
      : '-';

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">{data.date}</p>
      <p className="chart-tooltip__stars">&#11088; {data.stars.toLocaleString()}</p>
      <p className="chart-tooltip__increase">前日比: {increaseText}</p>
    </div>
  );
}
