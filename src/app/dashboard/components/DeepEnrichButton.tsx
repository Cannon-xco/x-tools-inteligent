// ============================================================
// COMPONENT: DeepEnrichButton
// Button untuk trigger deep enrichment per lead di dashboard
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import type { DeepEnrichResult } from '@/types/deep-enrich';

/**
 * Props untuk DeepEnrichButton component
 */
interface DeepEnrichButtonProps {
  /** Lead ID yang akan di-enrich */
  leadId: number;
  /** Nama lead (untuk logging/display) */
  leadName: string;
  /** Apakah lead sudah pernah di deep enrich? */
  isEnriched: boolean;
  /** Callback setelah enrichment selesai */
  onComplete: (result: DeepEnrichResult) => void;
}

/**
 * State visual button
 */
type ButtonState = 'idle' | 'loading' | 'success' | 'error' | 'already_enriched';

/**
 * Spinner loading animation component
 */
function LoadingSpinner({ className = '' }: { className?: string }): JSX.Element {
  return (
    <span
      className={`inline-block w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin ${className}`}
    />
  );
}

/**
 * Deep Enrich Button Component
 *
 * Button dengan multiple visual states untuk trigger deep enrichment.
 * Menangani loading, success, error, dan already enriched states.
 *
 * @example
 * ```tsx
 * <DeepEnrichButton
 *   leadId={123}
 *   leadName="Acme Corp"
 *   isEnriched={false}
 *   onComplete={(result) => console.log(result)}
 * />
 * ```
 */
export function DeepEnrichButton({
  leadId,
  leadName,
  isEnriched,
  onComplete,
}: DeepEnrichButtonProps): JSX.Element {
  const [buttonState, setButtonState] = useState<ButtonState>(
    isEnriched ? 'already_enriched' : 'idle'
  );

  /**
   * Reset button state ke idle setelah delay
   */
  const resetToIdle = useCallback((): void => {
    setTimeout(() => {
      setButtonState(isEnriched ? 'already_enriched' : 'idle');
    }, 3000);
  }, [isEnriched]);

  /**
   * Handle button click - trigger deep enrichment API call
   */
  const handleClick = useCallback(async (): Promise<void> => {
    if (buttonState === 'loading') return;

    setButtonState('loading');

    try {
      const response = await fetch('/api/deep-enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: leadId,
          options: {
            force: isEnriched, // Force re-enrich jika sudah pernah di-enrich
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Deep enrichment failed');
      }

      // Success state
      setButtonState('success');
      onComplete(data.data as DeepEnrichResult);
      resetToIdle();
    } catch (err) {
      console.error(`Deep enrich failed for ${leadName}:`, err);
      setButtonState('error');
      resetToIdle();
    }
  }, [buttonState, leadId, leadName, isEnriched, onComplete, resetToIdle]);

  /**
   * Get button styling berdasarkan current state
   */
  const getButtonStyles = (): string => {
    const baseStyles =
      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5';

    switch (buttonState) {
      case 'loading':
        return `${baseStyles} bg-violet-800 opacity-50 cursor-not-allowed text-white`;

      case 'success':
        return `${baseStyles} bg-emerald-600 hover:bg-emerald-500 text-white`;

      case 'error':
        return `${baseStyles} bg-red-600 hover:bg-red-500 text-white`;

      case 'already_enriched':
        return `${baseStyles} bg-transparent border border-violet-500/50 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500`;

      case 'idle':
      default:
        return `${baseStyles} bg-violet-600 hover:bg-violet-500 text-white`;
    }
  };

  /**
   * Get button content berdasarkan current state
   */
  const getButtonContent = (): JSX.Element => {
    switch (buttonState) {
      case 'loading':
        return (
          <>
            <LoadingSpinner />
            <span>Enriching...</span>
          </>
        );

      case 'success':
        return (
          <>
            <span>✅</span>
            <span>Enriched</span>
          </>
        );

      case 'error':
        return (
          <>
            <span>❌</span>
            <span>Failed</span>
          </>
        );

      case 'already_enriched':
        return (
          <>
            <span>🔄</span>
            <span>Re-Enrich</span>
          </>
        );

      case 'idle':
      default:
        return (
          <>
            <span>🔍</span>
            <span>Deep Enrich</span>
          </>
        );
    }
  };

  /**
   * Get button title/tooltip berdasarkan current state
   */
  const getButtonTitle = (): string => {
    switch (buttonState) {
      case 'loading':
        return `Deep enriching ${leadName}...`;
      case 'success':
        return 'Deep enrichment completed!';
      case 'error':
        return 'Deep enrichment failed. Click to retry.';
      case 'already_enriched':
        return `${leadName} has been deep enriched. Click to re-enrich.`;
      case 'idle':
      default:
        return `Deep enrich ${leadName}`;
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={buttonState === 'loading'}
      title={getButtonTitle()}
      className={getButtonStyles()}
      aria-label={getButtonTitle()}
      data-lead-id={leadId}
      data-state={buttonState}
    >
      {getButtonContent()}
    </button>
  );
}

export default DeepEnrichButton;
