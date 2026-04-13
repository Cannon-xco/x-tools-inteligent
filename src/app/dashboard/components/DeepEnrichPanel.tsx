// ============================================================
// COMPONENT: DeepEnrichPanel
// Panel expandable untuk menampilkan hasil deep enrichment
// ============================================================

'use client';

import React, { useState } from 'react';
import { ConfidenceBadge } from './ConfidenceBadge';
import type {
  DeepEnrichEmail,
  DeepEnrichPhone,
  DeepEnrichSocials,
  DeepEnrichPerson,
} from '@/types/deep-enrich';

/**
 * Props untuk DeepEnrichPanel component
 */
interface DeepEnrichPanelProps {
  /** Lead ID */
  leadId: number;
  /** Deep enrichment data */
  data: {
    emails: DeepEnrichEmail[];
    phones: DeepEnrichPhone[];
    socials: DeepEnrichSocials;
    people: DeepEnrichPerson[];
    overallConfidence: number;
    sources_used: string[];
    enriched_at: string;
  } | null;
}

/**
 * Format source string ke display label
 */
function formatSource(source: string): string {
  return source
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format date string ke readable format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Icon untuk social platform
 */
function getSocialIcon(platform: string): string {
  const icons: Record<string, string> = {
    linkedin: '💼',
    instagram: '📸',
    facebook: '📘',
    twitter: '🐦',
    youtube: '📺',
    tiktok: '🎵',
    pinterest: '📌',
    github: '💻',
  };
  return icons[platform.toLowerCase()] ?? '🔗';
}

/**
 * Section header component
 */
function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count: number;
}): React.ReactElement {
  return (
    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
      <span>{icon}</span>
      <span>{title}</span>
      {count > 0 && (
        <span className="text-gray-500">({count})</span>
      )}
    </h4>
  );
}

/**
 * Source tag component
 */
function SourceTag({ source }: { source: string }): React.ReactElement {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
      {source}
    </span>
  );
}

/**
 * Deep Enrich Panel Component
 *
 * Panel expandable yang menampilkan semua hasil deep enrichment.
 * Collapsible dengan header + overall confidence badge.
 *
 * @example
 * ```tsx
 * <DeepEnrichPanel
 *   leadId={123}
 *   data={{
 *     emails: [...],
 *     phones: [...],
 *     socials: { linkedin: '...' },
 *     people: [...],
 *     overallConfidence: 0.82,
 *     sources_used: ['website', 'serp'],
 *     enriched_at: '2025-04-10T14:30:00.000Z',
 *   }}
 * />
 * ```
 */
export function DeepEnrichPanel({ leadId, data }: DeepEnrichPanelProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const hasData = data !== null && data !== undefined;
  const hasAnyContent = hasData && (
    data.emails.length > 0 ||
    data.phones.length > 0 ||
    Object.keys(data.socials).length > 0 ||
    data.people.length > 0
  );

  const toggleOpen = (): void => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      className="border border-white/10 rounded-lg overflow-hidden"
      data-lead-id={leadId}
      data-has-enrichment={hasData}
    >
      {/* Header - Always visible */}
      <button
        onClick={toggleOpen}
        className="w-full px-4 py-2.5 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
        aria-expanded={isOpen}
        aria-controls={`deep-enrich-content-${leadId}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">🔍 Deep Enrichment</span>
          {hasData && (
            <span className="text-xs text-gray-500">
              {formatDate(data.enriched_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <ConfidenceBadge value={data.overallConfidence} size="sm" />
          )}
          <span className="text-gray-400 text-xs">
            {isOpen ? '▾' : '▸'}
          </span>
        </div>
      </button>

      {/* Content - Collapsible */}
      {isOpen && (
        <div
          id={`deep-enrich-content-${leadId}`}
          className="px-4 py-3 space-y-4 bg-black/20"
        >
          {!hasData ? (
            /* Empty State */
            <div className="py-6 text-center">
              <p className="text-sm text-gray-400">
                No deep enrichment data yet.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Click &quot;Deep Enrich&quot; button to start.
              </p>
            </div>
          ) : !hasAnyContent ? (
            /* No Results State */
            <div className="py-4 text-center">
              <p className="text-sm text-gray-400">
                No contacts found during enrichment.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Sources checked: {data.sources_used.join(', ')}
              </p>
            </div>
          ) : (
            /* Content Sections */
            <>
              {/* Emails Section */}
              {data.emails.length > 0 && (
                <div className="space-y-2">
                  <SectionHeader
                    icon="📧"
                    title="Emails"
                    count={data.emails.length}
                  />
                  <div className="space-y-1.5">
                    {data.emails.map((email, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-white/5"
                      >
                        <span className="text-sm text-gray-300 font-mono">
                          {email.value}
                        </span>
                        <div className="flex items-center gap-2">
                          <ConfidenceBadge value={email.confidence} size="sm" />
                          <div className="flex gap-1">
                            {email.sources.map((source, sidx) => (
                              <SourceTag key={sidx} source={source} />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phones Section */}
              {data.phones.length > 0 && (
                <div className="space-y-2">
                  <SectionHeader
                    icon="📞"
                    title="Phones"
                    count={data.phones.length}
                  />
                  <div className="space-y-1.5">
                    {data.phones.map((phone, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-white/5"
                      >
                        <span className="text-sm text-gray-300 font-mono">
                          {phone.value}
                        </span>
                        <div className="flex items-center gap-2">
                          <ConfidenceBadge value={phone.confidence} size="sm" />
                          <div className="flex gap-1">
                            {phone.sources.map((source, sidx) => (
                              <SourceTag key={sidx} source={source} />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Social Profiles Section */}
              {Object.keys(data.socials).length > 0 && (
                <div className="space-y-2">
                  <SectionHeader
                    icon="🌐"
                    title="Social Profiles"
                    count={Object.keys(data.socials).length}
                  />
                  <div className="space-y-1.5">
                    {Object.entries(data.socials).map(([platform, url], idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span>{getSocialIcon(platform)}</span>
                          <span className="text-sm text-gray-400 capitalize">
                            {platform}
                          </span>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-violet-400 hover:text-violet-300 underline truncate max-w-[200px]"
                        >
                          {url.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* People Section */}
              {data.people.length > 0 && (
                <div className="space-y-2">
                  <SectionHeader
                    icon="👤"
                    title="People"
                    count={data.people.length}
                  />
                  <div className="space-y-1.5">
                    {data.people.map((person, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-300">
                            {person.name}
                          </span>
                          {person.title && (
                            <span className="text-xs text-gray-500">
                              — {person.title}
                            </span>
                          )}
                        </div>
                        <ConfidenceBadge value={person.confidence} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-3 border-t border-white/10 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium">Sources:</span>
                  <span>{data.sources_used.join(', ')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium">Enriched:</span>
                  <span>{formatDate(data.enriched_at)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default DeepEnrichPanel;
