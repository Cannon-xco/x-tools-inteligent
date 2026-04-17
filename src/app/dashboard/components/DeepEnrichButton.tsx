// ============================================================
// COMPONENT: DeepEnrichButton
// Button untuk trigger deep enrichment per lead di dashboard
// ============================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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
type ButtonState = 'idle' | 'loading' | 'polling' | 'success' | 'error' | 'limit_reached' | 'already_enriched';

/**
 * Spinner loading animation component
 */
function LoadingSpinner({ className = '' }: { className?: string }) {
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
}: DeepEnrichButtonProps) {
  const [buttonState, setButtonState] = useState<ButtonState>(
    isEnriched ? 'already_enriched' : 'idle'
  );
  const [progressLabel, setProgressLabel] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isEnrichedRef = useRef(isEnriched);
  isEnrichedRef.current = isEnriched;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  /**
   * Reset button state ke idle setelah delay
   */
  const resetToIdle = useCallback((): void => {
    setTimeout(() => {
      setButtonState(isEnrichedRef.current ? 'already_enriched' : 'idle');
    }, 3000);
  }, []);  // intentionally no deps — reads isEnrichedRef.current at call time

  /**
   * Poll /api/leads/[id]/enrich/status until not 'processing'.
   */
  const startPolling = useCallback((): void => {
    setButtonState('polling');
    setProgressLabel('Processing...');

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/enrich/status`);
        const json = await res.json();
        const status: string = json?.data?.status ?? 'failed';

        if (status === 'processing') {
          setProgressLabel('Enriching...');
          return;
        }

        if (pollRef.current) clearInterval(pollRef.current);

        if (status === 'completed' && json?.data?.result) {
          setButtonState('success');
          onComplete(json.data.result);
          resetToIdle();
        } else if (status === 'limit_reached') {
          setButtonState('limit_reached');
          resetToIdle();
        } else {
          setButtonState('error');
          resetToIdle();
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        setButtonState('error');
        resetToIdle();
      }
    }, 2000);
  }, [leadId, onComplete, resetToIdle]);

  /**
   * Handle button click - trigger deep enrichment API call
   */
  const handleClick = useCallback(async (): Promise<void> => {
    if (buttonState === 'loading' || buttonState === 'polling') return;

    setButtonState('loading');

    try {
      // Fire-and-forget POST to new RESTful endpoint
      const response = await fetch(`/api/leads/${leadId}/enrich`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Deep enrichment failed');
      }

      // If result returned immediately (fast pipeline)
      if (data.data) {
        setButtonState('success');
        onComplete(data.data as DeepEnrichResult);
        resetToIdle();
      } else {
        // Fall back to polling for real-time status
        startPolling();
      }
    } catch (err) {
      console.error(`Deep enrich failed for ${leadName}:`, err);
      setButtonState('error');
      resetToIdle();
    }
  }, [buttonState, leadId, leadName, isEnriched, onComplete, resetToIdle, startPolling]);

  /**
   * Get button styling berdasarkan current state
   */
  const getButtonStyles = (): string => {
    const baseStyles =
      'w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5';

    switch (buttonState) {
      case 'polling':
        return `${baseStyles} bg-violet-700 opacity-75 cursor-not-allowed text-white`;

      case 'limit_reached':
        return `${baseStyles} bg-orange-600 hover:bg-orange-500 text-white`;

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
  const getButtonContent = () => {
    switch (buttonState) {
      case 'polling':
        return (
          <>
            <LoadingSpinner />
            <span>{progressLabel || 'Processing...'}</span>
          </>
        );

      case 'limit_reached':
        return (
          <>
            <span>⚠️</span>
            <span>No Data Found</span>
          </>
        );

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
      case 'polling':
        return `${progressLabel || 'Processing...'}`;
      case 'success':
        return 'Deep enrichment completed!';
      case 'limit_reached':
        return 'Enrichment reached limit — no data could be discovered for this lead.';
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
      disabled={buttonState === 'loading' || buttonState === 'polling'}
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
