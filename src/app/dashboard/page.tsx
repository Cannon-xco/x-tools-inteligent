'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BusinessListing, OutreachDraft, EnrichmentData } from '@/types';
import type { DeepEnrichResult } from '@/types/deep-enrich';
import { DeepEnrichButton } from './components/DeepEnrichButton';
import { DeepEnrichPanel } from './components/DeepEnrichPanel';

interface ScrapedLeadResponse {
  name: string;
  maps_url: string;
  website: string;
  emails: string[];
  phones: string[];
  technologies: string[];
  socials: string[];
}

// ── Types ─────────────────────────────────────────────────────

interface LogLine {
  ts: string;
  level: 'info' | 'warn' | 'error';
  msg: string;
}

// ── Helpers ───────────────────────────────────────────────────

function scoreColor(score?: number) {
  if (score === undefined) return { text: 'text-gray-500', bg: 'bg-gray-800', border: 'border-gray-700' };
  if (score >= 60) return { text: 'text-red-400', bg: 'bg-red-950/50', border: 'border-red-800/50' };
  if (score >= 30) return { text: 'text-amber-400', bg: 'bg-amber-950/50', border: 'border-amber-800/50' };
  return { text: 'text-emerald-400', bg: 'bg-emerald-950/50', border: 'border-emerald-800/50' };
}

function scoreBadge(score?: number) {
  if (score === undefined) return null;
  if (score >= 60) return { label: 'Hot', emoji: '🔥', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' };
  if (score >= 30) return { label: 'Warm', emoji: '🌡', cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' };
  return { label: 'Cold', emoji: '❄', cls: 'bg-sky-500/20 text-sky-400 border border-sky-500/30' };
}

function starRating(r?: number) {
  if (!r) return null;
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  return { full, half, empty: 5 - full - (half ? 1 : 0), value: r };
}

function leadPipelineStep(lead: BusinessListing): 0 | 1 | 2 | 3 | 4 {
  if (lead.outreach) return 4;
  if (lead.score !== undefined) return 3;
  if (lead.enrichment?.final_url) return 2;
  if (lead.id) return 1;
  return 0;
}

const PIPELINE_STEPS = [
  { label: 'Sourced', icon: '📍', desc: 'Found on Google Maps' },
  { label: 'Enriched', icon: '🔍', desc: 'Website data extracted' },
  { label: 'Scored', icon: '📊', desc: 'Lead score calculated' },
  { label: 'Outreach', icon: '✉️', desc: 'Email draft ready' },
];

// ── Spinner ───────────────────────────────────────────────────

function Spinner({ size = 'sm', color = 'white' }: { size?: 'sm' | 'md'; color?: string }) {
  const s = size === 'sm' ? 'w-3 h-3 border' : 'w-5 h-5 border-2';
  return <span className={`inline-block ${s} border-current/30 border-t-current rounded-full animate-spin`} style={{ color }} />;
}

// ── Signal Badge ──────────────────────────────────────────────

function SignalBadge({ ok, label, tooltip }: { ok: boolean; label: string; tooltip?: string }) {
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium cursor-default ${
        ok
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'bg-red-500/10 text-red-400 border border-red-500/20'
      }`}
    >
      <span className="text-[10px]">{ok ? '✓' : '✗'}</span>
      {label}
    </span>
  );
}

// ── Pipeline Bar (per lead) ───────────────────────────────────

function PipelineBar({ step }: { step: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center gap-0.5">
      {PIPELINE_STEPS.map((s, i) => (
        <div
          key={i}
          title={`${s.label}: ${s.desc}`}
          className={`h-1 flex-1 rounded-full transition-all ${
            i < step ? 'bg-violet-500' : i === step - 1 ? 'bg-violet-400' : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

// ── Stats Card ────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string | number; sub?: string; color: string; icon: string;
}) {
  return (
    <div className={`bg-[#131624] border rounded-xl p-4 flex items-start gap-3 ${color}`}>
      <div className="text-2xl mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-white leading-none">{value}</div>
        <div className="text-xs text-gray-400 mt-1">{label}</div>
        {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Outreach Modal ────────────────────────────────────────────

function OutreachModal({ lead, outreach, onClose }: { lead: BusinessListing; outreach: OutreachDraft; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(`Subject: ${outreach.subject}\n\n${outreach.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${outreach.source === 'ai' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'}`}>
                {outreach.source === 'ai' ? '✦ AI Generated' : '📄 Template'}
              </span>
              {outreach.model && <span className="text-xs text-gray-600">{outreach.model}</span>}
            </div>
            <h3 className="text-white font-semibold text-base">{lead.name}</h3>
            <p className="text-gray-500 text-xs mt-0.5">{lead.address}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors text-xl leading-none p-1">✕</button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {lead.maps_url && (
            <div className="rounded-xl bg-black/30 border border-white/5 p-4 flex items-center justify-between">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Google Maps</p>
              <a href={lead.maps_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:text-cyan-300 transition-colors flex items-center gap-1 font-medium">
                View Listing <span className="text-lg leading-none">↗</span>
              </a>
            </div>
          )}
          <div className="rounded-xl bg-black/30 border border-white/5 p-4">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-2">Subject Line</p>
            <p className="text-white font-medium text-sm">{outreach.subject}</p>
          </div>
          <div className="rounded-xl bg-black/30 border border-white/5 p-4">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-2">Email Body</p>
            <p className="text-gray-300 text-sm whitespace-pre-line leading-relaxed">{outreach.body}</p>
            <p className="text-gray-700 text-xs mt-3 border-t border-white/5 pt-3">
              Generated {new Date(outreach.generated_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={copy}
            className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all ${
              copied ? 'bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            {copied ? '✓ Copied!' : '📋 Copy Subject + Body'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lead Detail Panel ─────────────────────────────────────────

function LeadDetailPanel({ lead, onClose, onEnrich, onScore, onOutreach, onDelete, onDeepEnrichComplete, enriching, scoring, generating, niche }: {
  lead: BusinessListing; onClose: () => void;
  onEnrich: () => void; onScore: () => void; onOutreach: () => void; onDelete: () => void;
  onDeepEnrichComplete: (result: DeepEnrichResult) => void;
  enriching: boolean; scoring: boolean; generating: boolean; niche: string;
}) {
  const e = lead.enrichment;
  const step = leadPipelineStep(lead);
  const badge = scoreBadge(lead.score);
  const sc = scoreColor(lead.score);
  const stars = starRating(lead.rating);

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-md bg-[#10131f] border-l border-white/5 h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div className="sticky top-0 bg-[#10131f]/95 backdrop-blur border-b border-white/5 px-5 py-4 flex items-start justify-between z-10">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-white font-semibold text-base leading-snug">{lead.name}</h2>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">{lead.address}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors text-lg leading-none shrink-0 mt-0.5">✕</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Pipeline progress */}
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-3">Pipeline Progress</p>
            <div className="flex items-center gap-1 mb-2">
              {PIPELINE_STEPS.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm border transition-all ${
                    i < step ? 'bg-violet-600 border-violet-500' : i === step ? 'bg-violet-600/30 border-violet-500 animate-pulse' : 'bg-white/5 border-white/10'
                  }`}>
                    {i < step ? '✓' : s.icon}
                  </div>
                  <span className={`text-[9px] font-medium ${i < step ? 'text-violet-400' : i === step ? 'text-gray-400' : 'text-gray-700'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Actions</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onEnrich}
                disabled={enriching}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-sm font-medium transition-all disabled:opacity-50"
              >
                {enriching ? <Spinner color="#22d3ee" /> : '🔍'} {enriching ? 'Scanning…' : lead.website ? 'Enrich Site' : 'Discover Site'}
              </button>
              <button
                onClick={onScore}
                disabled={scoring}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-sm font-medium transition-all disabled:opacity-50"
              >
                {scoring ? <Spinner color="#fbbf24" /> : '📊'} {scoring ? 'Scoring…' : 'Score Lead'}
              </button>
              <DeepEnrichButton
                leadId={lead.id!}
                leadName={lead.name}
                isEnriched={!!lead.deepEnrichment}
                onComplete={onDeepEnrichComplete}
              />
              <button
                onClick={onOutreach}
                disabled={generating}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 text-sm font-medium transition-all disabled:opacity-50 col-span-2"
              >
                {generating ? <Spinner color="#a78bfa" /> : '✉️'} {generating ? 'Generating…' : lead.outreach ? 'Regenerate Outreach' : 'Generate Outreach'}
              </button>
            </div>
          </div>

          {/* Deep Enrichment Panel */}
          <DeepEnrichPanel
            leadId={lead.id!}
            data={lead.deepEnrichment || null}
          />

          {/* Lead info */}
          <div className="space-y-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Business Info</p>
            <div className="bg-black/20 rounded-xl border border-white/5 divide-y divide-white/5">
              {lead.phone && (
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Phone</span>
                  <a href={`tel:${lead.phone}`} className="text-white text-xs hover:text-cyan-400 transition-colors font-medium">{lead.phone}</a>
                </div>
              )}
              {lead.maps_url && (
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-gray-500 text-xs shrink-0">Google Maps</span>
                  <a href={lead.maps_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:text-cyan-300 transition-colors truncate">View on Maps</a>
                </div>
              )}
              {lead.website && (
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-gray-500 text-xs shrink-0">Website</span>
                  <div className="flex items-center gap-1.5 truncate">
                    {lead.enrichment?.raw_url?.startsWith('<discovered>') && (
                      <span title="Auto-discovered via search engine" className="cursor-help">✨</span>
                    )}
                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:text-cyan-300 transition-colors truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, '')}</a>
                  </div>
                </div>
              )}
              {lead.rating !== undefined && (
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Google Rating</span>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {stars && Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-xs ${i < stars.full ? 'text-amber-400' : 'text-gray-700'}`}>★</span>
                      ))}
                    </div>
                    <span className="text-white text-xs font-semibold">{lead.rating?.toFixed(1)}</span>
                    {lead.review_count !== undefined && (
                      <span className="text-gray-600 text-xs">({lead.review_count})</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Score */}
          {lead.score !== undefined && (
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-3">Lead Score</p>
              <div className={`rounded-xl border p-4 ${sc.bg} ${sc.border}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-3xl font-bold ${sc.text}`}>{lead.score}</span>
                  {badge && (
                    <span className={`text-sm px-3 py-1 rounded-full font-semibold ${badge.cls}`}>
                      {badge.emoji} {badge.label}
                    </span>
                  )}
                </div>
                {/* Score bar */}
                <div className="h-1.5 bg-black/30 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${lead.score >= 60 ? 'bg-red-500' : lead.score >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, (lead.score / 130) * 100)}%` }}
                  />
                </div>
                {lead.reasons && lead.reasons.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Issues Found</p>
                    {lead.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enrichment data */}
          {e && (
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-3">Website Analysis</p>
              <div className="space-y-3">
                {/* Signals grid */}
                <div className="grid grid-cols-2 gap-2">
                  <SignalBadge ok={e.website?.has_ssl?.value ?? false} label="SSL / HTTPS" tooltip="Secure connection (https://)" />
                  <SignalBadge ok={e.website?.has_contact_form?.value ?? false} label="Contact Form" tooltip="Form or WhatsApp link found" />
                  <SignalBadge ok={e.website?.has_booking?.value ?? false} label="Booking System" tooltip="Online booking or appointment feature" />
                  <SignalBadge ok={e.website?.has_social?.value ?? false} label="Social Media" tooltip="Links to social platforms" />
                  <SignalBadge ok={e.website?.has_phone_on_page?.value ?? false} label="Phone Listed" tooltip="Phone number visible on page" />
                  <SignalBadge ok={(e.website?.emails?.value?.length ?? 0) > 0} label="Email Listed" tooltip="Email address found on page" />
                </div>

                {/* Social links */}
                {(e.website?.social_links?.value?.length ?? 0) > 0 && (
                  <div className="bg-black/20 rounded-xl border border-white/5 px-4 py-3">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-2">Social Platforms</p>
                    <div className="flex flex-wrap gap-1.5">
                      {e.website!.social_links!.value!.map((s) => (
                        <span key={s} className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-gray-300 capitalize">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emails */}
                {(e.website?.emails?.value?.length ?? 0) > 0 && (
                  <div className="bg-black/20 rounded-xl border border-white/5 px-4 py-3">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-2">Emails Found</p>
                    {e.website!.emails!.value!.map((em) => (
                      <a key={em} href={`mailto:${em}`} className="block text-xs text-cyan-400 hover:text-cyan-300 transition-colors">{em}</a>
                    ))}
                  </div>
                )}

                {/* Tech stack */}
                {(e.tech?.detected_tech?.value?.length ?? 0) > 0 && (
                  <div className="bg-black/20 rounded-xl border border-white/5 px-4 py-3">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-2">Tech Stack</p>
                    <div className="flex flex-wrap gap-1.5">
                      {e.tech!.detected_tech!.value!.map((t) => (
                        <span key={t} className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${
                          t === e.tech?.cms?.value ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-white/5 text-gray-400 border-white/10'
                        }`}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* SEO */}
                {e.seo?.title?.value && (
                  <div className="bg-black/20 rounded-xl border border-white/5 px-4 py-3">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-2">SEO</p>
                    <p className="text-amber-300 text-xs font-medium">{e.seo.title.value}</p>
                    {e.seo.meta_description?.value && (
                      <p className="text-gray-500 text-xs mt-1 leading-relaxed">{e.seo.meta_description.value}</p>
                    )}
                    <div className="flex gap-3 mt-2">
                      <SignalBadge ok={e.seo.has_viewport?.value ?? false} label="Mobile Ready" />
                      {e.seo.h1?.value && <span className="text-xs text-gray-600 truncate">H1: {e.seo.h1.value}</span>}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-gray-700">Enriched {e.enriched_at ? new Date(e.enriched_at).toLocaleString() : ''} · {e.duration_ms}ms · {e.final_url ? new URL(e.final_url).hostname : ''}</p>
              </div>
            </div>
          )}

          {/* Delete */}
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={onDelete}
              className="w-full py-2 rounded-xl text-red-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-sm transition-all"
            >
              🗑 Delete Lead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────

export default function DashboardPage() {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(10);
  const [leads, setLeads] = useState<BusinessListing[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<Set<number>>(new Set());
  const [scoringIds, setScoringIds] = useState<Set<number>>(new Set());
  const [outreachIds, setOutreachIds] = useState<Set<number>>(new Set());
  const [deepEnrichingIds, setDeepEnrichingIds] = useState<Set<number>>(new Set());
  const [selectedLead, setSelectedLead] = useState<BusinessListing | null>(null);
  const [selectedOutreach, setSelectedOutreach] = useState<{ lead: BusinessListing; outreach: OutreachDraft } | null>(null);
  const [niche, setNiche] = useState('');
  const [sortField, setSortField] = useState<'score' | 'rating' | 'created_at'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterTier, setFilterTier] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((level: LogLine['level'], msg: string) => {
    setLogs((p) => [...p.slice(-199), { ts: new Date().toLocaleTimeString(), level, msg }]);
    setShowLog(true);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);
  useEffect(() => { loadLeads(); }, []);

  // Keep selectedLead synced
  useEffect(() => {
    if (selectedLead) {
      const fresh = leads.find((l) => l.id === selectedLead.id);
      if (fresh) setSelectedLead(fresh);
    }
  }, [leads]);

  // Auto-trigger deep enrichment for Cold/Warm leads missing core fields
  useEffect(() => {
    if (leads.length === 0) return;

    const candidates = leads.filter((l) =>
      l.id &&
      l.score !== undefined &&
      l.score < 60 &&                                        // Warm (30-59) or Cold (<30)
      !(l.enrichment?.website?.emails?.value?.length) &&      // Missing email from basic enrichment
      !(l.deepEnrichment?.emails?.length) &&                 // Not already deep-enriched email
      !l.deepEnrichment         // Not yet enriched
    );

    if (candidates.length === 0) return;

    addLog('info', `🤖 Auto-enriching ${candidates.length} Cold/Warm lead(s) missing contact info`);

    candidates.forEach((lead, i) => {
      setTimeout(() => {
        if (!lead.id) return;
        fetch(`/api/leads/${lead.id}/enrich`, { method: 'POST' })
          .then(() => {
            addLog('info', `🔄 Auto-enrich started for ${lead.name}`);
          })
          .catch(() => {
            addLog('warn', `⚠️ Auto-enrich failed for ${lead.name}`);
          });
      }, i * 3000); // 3s stagger to avoid queue flooding
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length]);

  async function loadLeads() {
    try {
      const res = await fetch('/api/leads?limit=500');
      const j = await res.json() as { success: boolean; data: { leads: BusinessListing[] } };
      if (j.success) setLeads(j.data.leads);
    } catch { /* silent */ }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setIsSearching(true);
    setLogs([]);
    addLog('info', `🔍 Deep Scraping "${keyword}" in "${location}" — limit ${limit}`);
    addLog('warn', '⏳ This is a deep scrape. It will parse Google Maps AND crawl all websites. This may take 1-3 minutes. PLEASE DO NOT REFRESH.');

    try {
      const res = await fetch('/api/scrape-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, location, limit }),
      });
      const j = await res.json() as { success: boolean; data?: ScrapedLeadResponse[]; metrics?: any; error?: string };

      if (j.success && j.data) {
        const total = j.metrics?.total_found || j.data.length;
        const ms = j.metrics?.duration_ms || 0;
        addLog('info', `✅ Extracted ${total} businesses in ${(ms / 1000).toFixed(1)}s`);
        // Reload leads from DB since the UI relies on the full structured DB representation
        await loadLeads();
        if (!niche) setNiche(keyword);
      } else {
        addLog('error', `Search failed: ${j.error}`);
      }
    } catch (err) {
      addLog('error', `Error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleEnrich(lead: BusinessListing) {
    if (!lead.id) return;
    setEnrichingIds((s) => new Set(s).add(lead.id!));
    addLog('info', `🔍 Scanning ${lead.name} (${lead.website || 'auto-discovering...'})`);

    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, url: lead.website || '' }),
      });
      const j = await res.json() as { success: boolean; data?: EnrichmentData; error?: string };

      if (j.success && j.data) {
        const e = j.data;
        addLog('info', `✅ ${lead.name} — SSL:${e.website?.has_ssl?.value ? '✓' : '✗'} Social:${e.website?.has_social?.value ? '✓' : '✗'} Emails:${e.website?.emails?.value?.length ?? 0}`);
        const updated = { ...lead, enrichment: e };
        setLeads((p) => p.map((l) => l.id === lead.id ? updated : l));
        await handleScore(updated);
      } else {
        addLog('error', `Enrichment failed: ${j.error}`);
      }
    } catch (err) {
      addLog('error', `Enrich error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setEnrichingIds((s) => { const n = new Set(s); n.delete(lead.id!); return n; });
    }
  }

  async function handleScore(lead: BusinessListing) {
    if (!lead.id) return;
    setScoringIds((s) => new Set(s).add(lead.id!));

    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id }),
      });
      const j = await res.json() as { success: boolean; data?: { score: number; reasons: string[] }; error?: string };

      if (j.success && j.data) {
        const { score, reasons } = j.data;
        const badge = scoreBadge(score);
        addLog('info', `📊 ${lead.name}: ${score}pts ${badge?.emoji ?? ''} — ${reasons.length} issue(s)`);
        setLeads((p) => p.map((l) => l.id === lead.id ? { ...l, score, reasons } : l));
      }
    } catch (err) {
      addLog('error', `Score error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setScoringIds((s) => { const n = new Set(s); n.delete(lead.id!); return n; });
    }
  }

  async function handleOutreach(lead: BusinessListing) {
    if (!lead.id) return;
    setOutreachIds((s) => new Set(s).add(lead.id!));
    addLog('info', `✉️ Generating outreach for ${lead.name}…`);

    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, niche: niche || keyword }),
      });
      const j = await res.json() as { success: boolean; data?: OutreachDraft; error?: string };

      if (j.success && j.data) {
        addLog('info', `✅ Outreach ready [${j.data.source}] for ${lead.name}`);
        const updated = { ...lead, outreach: j.data };
        setLeads((p) => p.map((l) => l.id === lead.id ? updated : l));
        setSelectedOutreach({ lead: updated, outreach: j.data });
      } else {
        addLog('error', `Outreach failed: ${j.error}`);
      }
    } catch (err) {
      addLog('error', `Outreach error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setOutreachIds((s) => { const n = new Set(s); n.delete(lead.id!); return n; });
    }
  }

  async function handleEnrichAll() {
    const targets = leads.filter((l) => !l.enrichment);
    if (!targets.length) { addLog('warn', 'All leads already enriched'); return; }
    addLog('info', `🚀 Bulk enriching/discovering ${targets.length} leads…`);
    for (const l of targets) await handleEnrich(l);
    addLog('info', '✅ Bulk enrichment done');
  }

  async function handleScoreAll() {
    const targets = leads.filter((l) => l.score === undefined);
    if (!targets.length) { addLog('warn', 'All leads already scored'); return; }
    addLog('info', `📊 Scoring ${targets.length} leads…`);
    for (const l of targets) await handleScore(l);
    addLog('info', '✅ Bulk scoring done');
  }

  function handleDelete(lead: BusinessListing) {
    if (!lead.id) return;
    fetch(`/api/leads?id=${lead.id}`, { method: 'DELETE' });
    setLeads((p) => p.filter((l) => l.id !== lead.id));
    if (selectedLead?.id === lead.id) setSelectedLead(null);
    addLog('info', `Deleted: ${lead.name}`);
  }

  function handleDeleteAll() {
    if (!window.confirm("Are you sure you want to delete ALL leads? This cannot be undone.")) return;
    fetch(`/api/leads?all=true`, { method: 'DELETE' });
    setLeads([]);
    setSelectedLead(null);
    setSelectedOutreach(null);
    addLog('info', `🗑 Deleted ALL leads`);
  }

  // ── Stats ──────────────────────────────────────────────────
  const hot = leads.filter((l) => (l.score ?? 0) >= 60).length;
  const warm = leads.filter((l) => (l.score ?? 0) >= 30 && (l.score ?? 0) < 60).length;
  const cold = leads.filter((l) => l.score !== undefined && (l.score ?? 0) < 30).length;
  const enriched = leads.filter((l) => l.enrichment?.final_url).length;
  const withOutreach = leads.filter((l) => l.outreach).length;
  const noWebsite = leads.filter((l) => !l.website).length;

  // ── Sort + filter ──────────────────────────────────────────
  const sortedLeads = [...leads]
    .filter((l) => {
      if (filterTier === 'hot') return (l.score ?? 0) >= 60;
      if (filterTier === 'warm') return (l.score ?? 0) >= 30 && (l.score ?? 0) < 60;
      if (filterTier === 'cold') return l.score !== undefined && (l.score ?? 0) < 30;
      return true;
    })
    .sort((a, b) => {
      const av = (a[sortField] as number | string | undefined) ?? 0;
      const bv = (b[sortField] as number | string | undefined) ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });

  const handleSortToggle = (f: typeof sortField) => {
    if (sortField === f) setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(f); setSortDir('desc'); }
  };

  const SortTh = ({ field, label }: { field: typeof sortField; label: string }) => (
    <th
      className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:text-white transition-colors"
      onClick={() => handleSortToggle(field)}
    >
      {label} {sortField === field ? (sortDir === 'desc' ? '↓' : '↑') : <span className="text-gray-700">↕</span>}
    </th>
  );

  const isEmpty = leads.length === 0 && !isSearching;

  return (
    <div className="min-h-screen bg-[#0a0c15] text-white font-sans">

      {/* ── TOP NAV ── */}
      <header className="border-b border-white/[0.06] bg-[#0d1020]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mr-4">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-sm font-black text-black">
              X
            </div>
            <span className="font-bold text-sm tracking-tight text-white hidden sm:block">xtools</span>
          </div>

          {/* Niche + location label */}
          {leads.length > 0 && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-gray-600 text-xs shrink-0">Outreach niche:</span>
              <input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder={keyword || 'e.g. dental clinic'}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white placeholder-gray-700 text-xs focus:outline-none focus:border-violet-500 transition-colors max-w-[200px]"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {leads.length > 0 && (
              <>
                <button
                  onClick={handleEnrichAll}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-medium transition-all"
                >
                  🔍 Enrich All
                </button>
                <button
                  onClick={handleScoreAll}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-medium transition-all"
                >
                  📊 Score All
                </button>
                <button
                  onClick={() => { window.open('/api/export', '_blank'); addLog('info', '📤 CSV export'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-medium transition-all"
                >
                  ↓ Export CSV
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 text-xs font-medium transition-all ml-1"
                >
                  🗑 Clear All
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-5 space-y-5">

        {/* ── SEARCH PANEL ── */}
        <section className="bg-gradient-to-br from-[#131827] to-[#0f1320] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🗺</span>
            <h1 className="font-semibold text-white">Source Local Businesses</h1>
            <span className="text-gray-600 text-sm">from Google Maps</span>
          </div>

          <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔑</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Keyword  (e.g. dentist, spa, lawyer)"
                className="w-full bg-black/30 border border-white/10 focus:border-violet-500 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-700 text-sm focus:outline-none transition-colors"
                required
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">📍</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location  (e.g. Bali, Jakarta)"
                className="w-full bg-black/30 border border-white/10 focus:border-violet-500 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-700 text-sm focus:outline-none transition-colors"
                required
              />
            </div>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              {[5, 10, 20, 30, 50].map((n) => <option key={n} value={n}>{n} results</option>)}
            </select>
            <button
              type="submit"
              disabled={isSearching}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl px-6 py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-violet-500/20"
            >
              {isSearching ? <><Spinner size="sm" /> Searching…</> : '▶  Run Search'}
            </button>
          </form>

          {/* Pipeline legend */}
          <div className="mt-4 pt-4 border-t border-white/[0.05] flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="font-medium text-gray-500">Pipeline:</span>
            {PIPELINE_STEPS.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px]">{s.icon}</span>
                <span>{i + 1}. {s.label}</span>
                <span className="text-gray-700">— {s.desc}</span>
              </span>
            ))}
          </div>
        </section>

        {/* ── STATS ── */}
        {leads.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon="📋" label="Total Leads" value={leads.length} color="border-white/[0.07]" />
            <StatCard icon="🔥" label="Hot Leads" value={hot} sub="Score ≥ 60" color="border-red-900/30" />
            <StatCard icon="🌡" label="Warm Leads" value={warm} sub="Score 30–59" color="border-amber-900/30" />
            <StatCard icon="🌐" label="Enriched" value={enriched} sub={`${leads.length - enriched - noWebsite} pending`} color="border-cyan-900/30" />
            <StatCard icon="✉️" label="Outreach" value={withOutreach} sub="drafts ready" color="border-violet-900/30" />
            <StatCard icon="⚠️" label="No Website" value={noWebsite} sub="direct contact" color="border-orange-900/30" />
          </div>
        )}

        {/* ── LOG ── */}
        {logs.length > 0 && (
          <div className="bg-[#080a12] border border-white/[0.05] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLog((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-gray-400 font-medium font-mono">Activity Log</span>
                <span className="text-xs text-gray-700">({logs.length} entries)</span>
              </div>
              <span className="text-gray-700 text-xs">{showLog ? '▲ collapse' : '▼ expand'}</span>
            </button>
            {showLog && (
              <div ref={logRef} className="px-4 pb-3 max-h-44 overflow-y-auto space-y-1 font-mono text-xs">
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-gray-700 shrink-0 pt-0.5">{l.ts}</span>
                    <span className={l.level === 'error' ? 'text-red-400' : l.level === 'warn' ? 'text-yellow-400' : 'text-gray-400'}>
                      {l.msg}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LEADS TABLE ── */}
        {leads.length > 0 && (
          <section className="bg-[#0f1220] border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="px-5 py-3 border-b border-white/[0.05] flex flex-wrap items-center gap-3">
              <h2 className="font-semibold text-white text-sm flex-1">
                Leads <span className="text-gray-600 font-normal ml-1">{sortedLeads.length} shown</span>
              </h2>

              {/* Tier filter tabs */}
              <div className="flex rounded-lg bg-black/30 border border-white/[0.06] p-0.5 gap-0.5 text-xs">
                {(['all', 'hot', 'warm', 'cold'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterTier(t)}
                    className={`px-3 py-1 rounded-md font-medium transition-all capitalize ${
                      filterTier === t
                        ? t === 'hot' ? 'bg-red-600 text-white'
                        : t === 'warm' ? 'bg-amber-600 text-white'
                        : t === 'cold' ? 'bg-sky-700 text-white'
                        : 'bg-violet-600 text-white'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {t === 'hot' ? '🔥' : t === 'warm' ? '🌡' : t === 'cold' ? '❄' : ''} {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-600 uppercase tracking-wider border-b border-white/[0.04]">
                    <SortTh field="created_at" label="#" />
                    <th className="text-left px-4 py-3 font-medium">Business</th>
                    <SortTh field="rating" label="Rating" />
                    <th className="text-left px-4 py-3 font-medium">Maps</th>
                    <th className="text-left px-4 py-3 font-medium">Website</th>
                    <th className="text-left px-4 py-3 font-medium">Signals</th>
                    <SortTh field="score" label="Score" />
                    <th className="text-left px-4 py-3 font-medium">Pipeline</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeads.map((lead, idx) => {
                    const enriching = enrichingIds.has(lead.id!);
                    const scoring = scoringIds.has(lead.id!);
                    const generating = outreachIds.has(lead.id!);
                    const e = lead.enrichment;
                    const step = leadPipelineStep(lead);
                    const badge = scoreBadge(lead.score);
                    const sc = scoreColor(lead.score);
                    const isSelected = selectedLead?.id === lead.id;

                    return (
                      <tr
                        key={lead.id ?? lead.hash}
                        className={`border-b border-white/[0.03] transition-colors cursor-pointer ${
                          isSelected ? 'bg-violet-500/5 border-l-2 border-l-violet-500' : 'hover:bg-white/[0.02]'
                        }`}
                        onClick={() => setSelectedLead(isSelected ? null : lead)}
                      >
                        {/* Index */}
                        <td className="px-4 py-3">
                          <span className="text-gray-700 font-mono">{idx + 1}</span>
                        </td>

                        {/* Business */}
                        <td className="px-4 py-3 max-w-[220px]">
                          <div className="font-semibold text-white text-xs leading-snug truncate">{lead.name}</div>
                          <div className="text-gray-600 text-[10px] mt-0.5 truncate" title={lead.address}>{lead.address}</div>
                          {lead.phone && <div className="text-gray-700 text-[10px] mt-0.5">{lead.phone}</div>}
                        </td>

                        {/* Rating */}
                        <td className="px-4 py-3">
                          {lead.rating ? (
                            <div>
                              <div className="flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <span key={i} className={`text-[10px] ${i < Math.floor(lead.rating!) ? 'text-amber-400' : 'text-gray-800'}`}>★</span>
                                ))}
                              </div>
                              <div className="text-gray-500 text-[10px] mt-0.5">{lead.rating.toFixed(1)} · {lead.review_count ?? '?'} reviews</div>
                            </div>
                          ) : <span className="text-gray-800">—</span>}
                        </td>

                        {/* Maps */}
                        <td className="px-4 py-3">
                          {lead.maps_url ? (
                            <a href={lead.maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-cyan-500 hover:text-cyan-300 transition-colors" onClick={(ev) => ev.stopPropagation()}>
                              <span>📍</span> <span className="underline decoration-cyan-500/30 underline-offset-2">View</span>
                            </a>
                          ) : (
                            <span className="text-gray-800">—</span>
                          )}
                        </td>

                        {/* Website */}
                        <td className="px-4 py-3 max-w-[160px]">
                          {lead.website ? (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-500 hover:text-cyan-300 transition-colors block truncate"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                            </a>
                          ) : (
                            <span className="text-red-600/70 flex items-center gap-1">
                              <span>✗</span> No website
                            </span>
                          )}
                        </td>

                        {/* Signals */}
                        <td className="px-4 py-3">
                          {e ? (
                            <div className="flex flex-wrap gap-1">
                              <SignalBadge ok={e.website?.has_ssl?.value ?? false} label="SSL" tooltip="HTTPS / SSL certificate" />
                              <SignalBadge ok={e.website?.has_booking?.value ?? false} label="Book" tooltip="Booking system detected" />
                              <SignalBadge ok={e.website?.has_social?.value ?? false} label="Social" tooltip="Social media links found" />
                              <SignalBadge ok={e.website?.has_contact_form?.value ?? false} label="Form" tooltip="Contact form or WhatsApp" />
                              {(e.website?.emails?.value?.length ?? 0) > 0 && (
                                <span className="text-[10px] text-cyan-600" title={e.website!.emails!.value!.join('\n')}>
                                  ✉ {e.website!.emails!.value!.length}
                                </span>
                              )}
                              {e.tech?.cms?.value && (
                                <span className="text-[10px] text-violet-500 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-md">
                                  {e.tech.cms.value}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-800 text-[10px]">
                              {lead.website ? '─ not enriched' : '─'}
                            </span>
                          )}
                        </td>

                        {/* Score */}
                        <td className="px-4 py-3">
                          {lead.score !== undefined ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-base font-bold ${sc.text}`}>{lead.score}</span>
                              {badge && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${badge.cls}`}>
                                  {badge.emoji} {badge.label}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-800">—</span>
                          )}
                        </td>

                        {/* Pipeline */}
                        <td className="px-4 py-3 min-w-[100px]">
                          <div className="mb-1">
                            <PipelineBar step={step} />
                          </div>
                          <div className="text-[10px] text-gray-700">
                            Step {step}/{PIPELINE_STEPS.length}: {PIPELINE_STEPS[step - 1]?.label ?? 'Sourced'}
                          </div>
                        </td>

                        {/* Quick actions */}
                        <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEnrich(lead)}
                              disabled={enriching}
                              title={lead.website ? "Enrich website" : "Auto-discover website"}
                              className="w-7 h-7 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 flex items-center justify-center transition-all disabled:opacity-50"
                            >
                              {enriching ? <Spinner color="#22d3ee" /> : '🔍'}
                            </button>
                            <button
                              onClick={() => handleScore(lead)}
                              disabled={scoring}
                              title="Score lead"
                              className="w-7 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 flex items-center justify-center transition-all disabled:opacity-50"
                            >
                              {scoring ? <Spinner color="#fbbf24" /> : '📊'}
                            </button>
                            <button
                              onClick={() => lead.outreach ? setSelectedOutreach({ lead, outreach: lead.outreach }) : handleOutreach(lead)}
                              disabled={generating}
                              title="Generate / view outreach"
                              className="w-7 h-7 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 flex items-center justify-center transition-all disabled:opacity-50"
                            >
                              {generating ? <Spinner color="#a78bfa" /> : lead.outreach ? '📩' : '✉️'}
                            </button>
                            <button
                              onClick={() => setSelectedLead(isSelected ? null : lead)}
                              title="View details"
                              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${isSelected ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'}`}
                            >
                              ›
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sortedLeads.length === 0 && (
              <div className="text-center py-10 text-gray-700">
                <p>No leads match the current filter.</p>
              </div>
            )}
          </section>
        )}

        {/* ── EMPTY STATE ── */}
        {isEmpty && (
          <div className="py-16 px-4 text-center">
            <div className="text-6xl mb-5">🗺️</div>
            <h2 className="text-xl font-semibold text-white mb-2">No leads yet</h2>
            <p className="text-gray-500 text-sm mb-8">Search for a keyword and location above to start collecting businesses</p>

            <div className="max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PIPELINE_STEPS.map((s, i) => (
                <div key={i} className="bg-[#131624] border border-white/[0.07] rounded-xl p-4 text-left">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className="text-white text-xs font-semibold mb-1">Step {i + 1}: {s.label}</div>
                  <div className="text-gray-600 text-[11px]">{s.desc}</div>
                </div>
              ))}
            </div>

            <p className="text-gray-700 text-xs mt-8">
              💡 Try: keyword <span className="text-gray-500">dentist</span> + location <span className="text-gray-500">Bali</span>
            </p>
          </div>
        )}
      </div>

      {/* ── SIDE PANEL ── */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onEnrich={() => handleEnrich(selectedLead)}
          onScore={() => handleScore(selectedLead)}
          onOutreach={() => selectedLead.outreach ? setSelectedOutreach({ lead: selectedLead, outreach: selectedLead.outreach }) : handleOutreach(selectedLead)}
          onDelete={() => handleDelete(selectedLead)}
          onDeepEnrichComplete={(result) => {
            setLeads((p) => p.map((l) => l.id === selectedLead.id ? { ...l, deepEnrichment: result } : l));
          }}
          enriching={enrichingIds.has(selectedLead.id!)}
          scoring={scoringIds.has(selectedLead.id!)}
          generating={outreachIds.has(selectedLead.id!)}
          niche={niche}
        />
      )}

      {/* ── OUTREACH MODAL ── */}
      {selectedOutreach && (
        <OutreachModal
          lead={selectedOutreach.lead}
          outreach={selectedOutreach.outreach}
          onClose={() => setSelectedOutreach(null)}
        />
      )}

      {/* ── FOOTER ── */}
      <footer className="w-full py-6 text-center text-[10px] text-gray-600/60 font-mono tracking-widest border-t border-white/[0.04] mt-8">
        MADE WITH ❤️ BY AZM-TEAM MEMBER WIDI, YASTIKA, AMMULIA, PRAYOGA, DEKRES
      </footer>
    </div>
  );
}
