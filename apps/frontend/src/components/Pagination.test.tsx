/**
 * Pagination コンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from './Pagination';

describe('Pagination', () => {
  describe('レンダリング', () => {
    it('totalPagesが1以下の場合は何も表示しない', () => {
      const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />);

      expect(container.firstChild).toBeNull();
    });

    it('totalPagesが0の場合は何も表示しない', () => {
      const { container } = render(<Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />);

      expect(container.firstChild).toBeNull();
    });

    it('7ページ以下の場合、全ページ番号を表示する', () => {
      render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('前へ・次へボタンが表示される', () => {
      render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);

      expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
      expect(screen.getByLabelText('Next page')).toBeInTheDocument();
    });
  });

  describe('ボタンの有効/無効', () => {
    it('1ページ目では前へボタンが無効になる', () => {
      render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);

      expect(screen.getByLabelText('Previous page')).toBeDisabled();
    });

    it('最終ページでは次へボタンが無効になる', () => {
      render(<Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />);

      expect(screen.getByLabelText('Next page')).toBeDisabled();
    });

    it('中間ページでは前へ・次へボタンが有効になる', () => {
      render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);

      expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
      expect(screen.getByLabelText('Next page')).not.toBeDisabled();
    });
  });

  describe('ページ変更', () => {
    it('ページ番号ボタンをクリックするとonPageChangeが呼ばれる', () => {
      const onPageChange = vi.fn();
      render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);

      fireEvent.click(screen.getByText('3'));

      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('前へボタンをクリックするとcurrentPage-1が渡される', () => {
      const onPageChange = vi.fn();
      render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);

      fireEvent.click(screen.getByLabelText('Previous page'));

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('次へボタンをクリックするとcurrentPage+1が渡される', () => {
      const onPageChange = vi.fn();
      render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);

      fireEvent.click(screen.getByLabelText('Next page'));

      expect(onPageChange).toHaveBeenCalledWith(4);
    });
  });

  describe('aria-current属性', () => {
    it('現在のページにaria-current="page"が設定される', () => {
      render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);

      const currentButton = screen.getByText('2').closest('button');
      expect(currentButton).toHaveAttribute('aria-current', 'page');
    });

    it('他のページにはaria-currentが設定されない', () => {
      render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);

      const otherButton = screen.getByText('1').closest('button');
      expect(otherButton).not.toHaveAttribute('aria-current');
    });
  });

  describe('省略記号（8ページ以上）', () => {
    it('8ページある場合、省略記号が表示される', () => {
      render(<Pagination currentPage={5} totalPages={10} onPageChange={vi.fn()} />);

      const ellipses = screen.getAllByText('…');
      expect(ellipses.length).toBeGreaterThan(0);
    });

    it('先頭・末尾ページは常に表示される', () => {
      render(<Pagination currentPage={5} totalPages={10} onPageChange={vi.fn()} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });
});
