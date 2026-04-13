// ============================================================
// COMPONENT: ConfidenceBadge
// Menampilkan confidence score dengan visual indicator
// ============================================================

'use client';

/**
 * Props untuk ConfidenceBadge component
 */
interface ConfidenceBadgeProps {
  /** Confidence score dari 0.0 sampai 1.0 */
  value: number;
  /** Optional text label */
  label?: string;
  /** Optional ukuran variant */
  size?: 'sm' | 'md';
}

/**
 * Konfigurasi visual berdasarkan score range
 */
interface BadgeConfig {
  colorClass: string;
  bgClass: string;
  borderClass: string;
  icon: string;
  label: string;
}

/**
 * Get visual configuration berdasarkan confidence score
 *
 * @param value - Confidence score 0-1
 * @returns Badge configuration
 */
function getBadgeConfig(value: number): BadgeConfig {
  if (value >= 0.75) {
    return {
      colorClass: 'text-emerald-400',
      bgClass: 'bg-emerald-500/10',
      borderClass: 'border-emerald-500/20',
      icon: '✅',
      label: 'High',
    };
  }

  if (value >= 0.5) {
    return {
      colorClass: 'text-amber-400',
      bgClass: 'bg-amber-500/10',
      borderClass: 'border-amber-500/20',
      icon: '⚠️',
      label: 'Low',
    };
  }

  return {
    colorClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/20',
    icon: '❌',
    label: 'Unreliable',
  };
}

/**
 * Format confidence score ke percentage string
 *
 * @param value - Confidence score 0-1
 * @returns Formatted percentage string
 */
function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Confidence Badge Component
 *
 * Menampilkan confidence score dengan icon dan color coding.
 * Score ≥ 0.75 = hijau (High), 0.50-0.74 = kuning (Low), < 0.50 = merah (Unreliable)
 *
 * @example
 * ```tsx
 * <ConfidenceBadge value={0.92} />
 * // Output: ✅ 92%
 *
 * <ConfidenceBadge value={0.63} label />
 * // Output: ⚠️ 63% Low
 * ```
 */
export function ConfidenceBadge({
  value,
  label,
  size = 'sm',
}: ConfidenceBadgeProps) {
  // Clamp value between 0 and 1
  const clampedValue = Math.max(0, Math.min(1, value));
  const config = getBadgeConfig(clampedValue);

  const sizeClasses = size === 'sm'
    ? 'text-xs px-2 py-0.5'
    : 'text-sm px-3 py-1';

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-md font-medium
        ${sizeClasses}
        ${config.bgClass}
        ${config.colorClass}
        ${config.borderClass}
        border
      `}
      title={`Confidence: ${config.label} (${formatConfidence(clampedValue)})`}
      data-confidence={clampedValue}
      data-confidence-level={config.label.toLowerCase()}
    >
      <span className="text-[10px]">{config.icon}</span>
      <span>{formatConfidence(clampedValue)}</span>
      {label && (
        <span className="opacity-75">{config.label}</span>
      )}
    </span>
  );
}

/**
 * Simplified confidence indicator (icon only)
 *
 * @param value - Confidence score 0-1
 * @returns Icon element
 */
export function ConfidenceIcon({ value }: { value: number }) {
  const clampedValue = Math.max(0, Math.min(1, value));
  const config = getBadgeConfig(clampedValue);

  return (
    <span
      className={config.colorClass}
      title={`Confidence: ${config.label} (${formatConfidence(clampedValue)})`}
    >
      {config.icon}
    </span>
  );
}

export default ConfidenceBadge;
