/**
 * StarChart Component
 * Displays a line chart of star count history over time
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import ChartTooltip from './ChartTooltip';

interface ChartData {
  date: string;
  stars: number;
}

interface Props {
  data: ChartData[];
  loading?: boolean;
  error?: string | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatStars(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

export default function StarChart({ data, loading, error }: Props) {
  if (loading) {
    return <div className="star-chart-container star-chart-loading">Loading chart data...</div>;
  }

  if (error) {
    return (
      <div className="star-chart-container star-chart-error">Failed to load chart: {error}</div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="star-chart-container star-chart-empty">No history data available</div>;
  }

  const formattedData = data.map((item, index) => ({
    ...item,
    displayDate: formatDate(item.date),
    dailyIncrease: index > 0 ? item.stars - data[index - 1].stars : null,
  }));

  // Use React.createElement with type assertions to work around
  // recharts/React 18/19 type incompatibility issues
  return (
    <div className="star-chart-container">
      {React.createElement(
        ResponsiveContainer as unknown as AnyComponent,
        { width: '100%', height: 200 },
        React.createElement(
          LineChart as unknown as AnyComponent,
          { data: formattedData, margin: { top: 10, right: 30, left: 0, bottom: 0 } },
          React.createElement(CartesianGrid as unknown as AnyComponent, {
            strokeDasharray: '3 3',
            stroke: '#eee',
          }),
          React.createElement(XAxis as unknown as AnyComponent, {
            dataKey: 'displayDate',
            tick: { fontSize: 12 },
            tickLine: false,
          }),
          React.createElement(YAxis as unknown as AnyComponent, {
            tickFormatter: formatStars,
            tick: { fontSize: 12 },
            tickLine: false,
            axisLine: false,
            width: 50,
          }),
          React.createElement(Tooltip as unknown as AnyComponent, {
            content: React.createElement(ChartTooltip),
          }),
          React.createElement(Line as unknown as AnyComponent, {
            type: 'monotone',
            dataKey: 'stars',
            stroke: '#f0c14b',
            strokeWidth: 2,
            dot: false,
            activeDot: { r: 4, fill: '#f0c14b' },
          })
        )
      )}
    </div>
  );
}
