/**
 * PrimaryButton Component (COM-005)
 * Reusable primary action button with loading state
 */

interface PrimaryButtonProps {
  label: string;
  onClick: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
}

export default function PrimaryButton({
  label,
  onClick,
  type = 'button',
  disabled = false,
  loading = false,
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className={`primary-button ${loading ? 'primary-button--loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <span className="primary-button__spinner" aria-hidden="true" />}
      {label}
    </button>
  );
}
