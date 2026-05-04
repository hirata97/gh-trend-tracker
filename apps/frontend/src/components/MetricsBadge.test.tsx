/**
 * MetricsBadge コンポーネントのテスト
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricsBadge from './MetricsBadge';

describe('MetricsBadge', () => {
  describe('表示内容', () => {
    it('正の増加数をプラス記号付きで表示する', () => {
      render(<MetricsBadge value={1234} period="7d" type="increase" />);

      expect(screen.getByText('+1,234')).toBeInTheDocument();
      expect(screen.getByText('/7d')).toBeInTheDocument();
    });

    it('負の増加数をマイナス記号付きで表示する', () => {
      render(<MetricsBadge value={-500} period="30d" type="increase" />);

      expect(screen.getByText('-500')).toBeInTheDocument();
      expect(screen.getByText('/30d')).toBeInTheDocument();
    });

    it('ゼロの場合は符号なしで表示する', () => {
      render(<MetricsBadge value={0} period="7d" type="increase" />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('rate表示では小数点2桁のパーセント形式で表示する', () => {
      render(<MetricsBadge value={5.25} period="7d" type="rate" />);

      expect(screen.getByText('+5.25%')).toBeInTheDocument();
    });

    it('負のrateにはプラス記号を付けない', () => {
      render(<MetricsBadge value={-2.5} period="30d" type="rate" />);

      expect(screen.getByText('-2.50%')).toBeInTheDocument();
    });
  });

  describe('バリアントクラス', () => {
    it('正の値にはpositiveクラスが付く', () => {
      const { container } = render(<MetricsBadge value={100} period="7d" />);

      expect(container.querySelector('.metrics-badge--positive')).toBeInTheDocument();
    });

    it('負の値にはnegativeクラスが付く', () => {
      const { container } = render(<MetricsBadge value={-100} period="7d" />);

      expect(container.querySelector('.metrics-badge--negative')).toBeInTheDocument();
    });

    it('ゼロにはzeroクラスが付く', () => {
      const { container } = render(<MetricsBadge value={0} period="7d" />);

      expect(container.querySelector('.metrics-badge--zero')).toBeInTheDocument();
    });
  });

  describe('矢印アイコン', () => {
    it('正の値には上矢印が表示される', () => {
      render(<MetricsBadge value={10} period="7d" />);

      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    it('負の値には下矢印が表示される', () => {
      render(<MetricsBadge value={-10} period="7d" />);

      expect(screen.getByText('↓')).toBeInTheDocument();
    });

    it('ゼロには横矢印が表示される', () => {
      render(<MetricsBadge value={0} period="7d" />);

      expect(screen.getByText('→')).toBeInTheDocument();
    });
  });

  describe('デフォルトprops', () => {
    it('type省略時はincreaseとして動作する', () => {
      render(<MetricsBadge value={500} period="7d" />);

      expect(screen.getByText('+500')).toBeInTheDocument();
    });
  });
});
