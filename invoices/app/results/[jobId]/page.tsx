'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ReconciliationData, ReconciliationJob, MatchedRecord, UnmatchedRecord } from '@/lib/types';
import { VENDORS } from '@/lib/vendors';

const POLL_MS = 4000;

// ── Polling + shell ───────────────────────────────────────────────────────────

export default function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<ReconciliationJob | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function poll(): Promise<boolean> {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error('Job not found');
        const data: ReconciliationJob = await res.json();
        if (active) setJob(data);
        return data.status === 'done' || data.status === 'error';
      } catch (err) {
        if (active) setFetchError(err instanceof Error ? err.message : 'Unknown error');
        return true;
      }
    }

    poll().then(done => {
      if (done || !active) return;
      const id = setInterval(async () => {
        if (await poll()) clearInterval(id);
      }, POLL_MS);
      return () => clearInterval(id);
    });

    return () => { active = false; };
  }, [jobId]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <button onClick={() => router.push('/')} className="mb-6 text-sm text-blue-600 hover:underline">
        ← New reconciliation
      </button>

      {fetchError && <ErrorBanner message={fetchError} />}

      {!job && !fetchError && <Spinner label="Looking up job…" />}

      {job && (
        <>
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">
              {VENDORS[job.vendor_key] ?? job.vendor_key}
            </h1>
            <p className="text-xs text-gray-400">Job {job.id}</p>
          </div>

          <StatusTimeline status={job.status} />

          {(job.status === 'pending' || job.status === 'running') && (
            <div className="mt-8 text-center">
              <Spinner label={
                job.status === 'pending'
                  ? 'Waiting for GitHub Actions to start…'
                  : 'Reconciliation running in GitHub Actions…'
              } />
              <p className="mt-2 text-xs text-gray-400">Typically 30–90 seconds. This page polls automatically.</p>
            </div>
          )}

          {job.status === 'error' && (
            <ErrorBanner message={job.error_message ?? 'An unknown error occurred.'} />
          )}

          {job.status === 'done' && <ResultsView job={job} />}
        </>
      )}
    </main>
  );
}

// ── Status timeline ───────────────────────────────────────────────────────────

function StatusTimeline({ status }: { status: ReconciliationJob['status'] }) {
  const steps = [
    { key: 'pending', label: 'Files uploaded' },
    { key: 'running', label: 'Running' },
    { key: 'done',    label: 'Complete' },
  ] as const;

  const order = ['pending', 'running', 'done', 'error'];
  const currentIdx = order.indexOf(status);

  return (
    <ol className="mb-8 flex items-start">
      {steps.map((step, i) => {
        const stepIdx = order.indexOf(step.key);
        const done    = status === 'done' ? true : currentIdx > stepIdx;
        const active  = currentIdx === stepIdx && status !== 'error';
        const isLast  = i === steps.length - 1;

        return (
          <li key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                done   ? 'bg-blue-600 text-white'
                : active ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500'
                : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`mt-1 whitespace-nowrap text-xs ${active ? 'font-medium text-blue-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`mb-4 h-0.5 flex-1 ${currentIdx > stepIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Results view (done state) ────────────────────────────────────────────────

function ResultsView({ job }: { job: ReconciliationJob }) {
  const data = job.result_data;
  const [tab, setTab] = useState<'discrepancies' | 'matched' | 'unmatched'>('discrepancies');

  const matched  = job.matched_count  ?? 0;
  const mismatch = job.mismatch_count ?? 0;
  const stmtOnly = job.stmt_only_count ?? 0;
  const qbOnly   = job.qb_only_count   ?? 0;
  const total    = matched + mismatch + stmtOnly;
  const matchPct = total > 0 ? Math.round((matched / total) * 100) : 0;

  const isActivityMode = data?.statement_mode === 'all_activity';

  return (
    <div className="space-y-6">
      {/* Activity mode notice */}
      {isActivityMode && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <strong>Activity mode:</strong> This vendor's statement lists all activity (bills + payments), not just open items.
          The stated total is the current balance — it won't equal the sum of all records. Line-by-line matching is unaffected.
        </div>
      )}

      {/* Period total comparison */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Period Total Comparison</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400">Statement Total</p>
            <p className="text-lg font-bold text-gray-900">
              {job.stmt_total != null ? fmtCurrency(job.stmt_total) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">QB Records Total</p>
            <p className="text-lg font-bold text-gray-900">
              {job.qb_total != null ? fmtCurrency(job.qb_total) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Difference</p>
            {job.stmt_total != null && job.qb_total != null ? (() => {
              const diff = job.stmt_total - job.qb_total;
              return (
                <p className={`text-lg font-bold ${Math.abs(diff) < 0.02 ? 'text-green-600' : 'text-red-600'}`}>
                  {diff >= 0 ? '+' : ''}{fmtCurrency(diff)}
                </p>
              );
            })() : <p className="text-lg font-bold text-gray-400">—</p>}
          </div>
        </div>
      </div>

      {/* Record count metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Match Rate"    value={`${matchPct}%`}          ok={matchPct === 100} />
        <Metric label="Clean Matches" value={String(matched)} />
        <Metric label="Discrepancies" value={String(mismatch)}         warn={mismatch > 0} />
        <Metric label="Unmatched"     value={String(stmtOnly + qbOnly)} warn={stmtOnly + qbOnly > 0} />
      </div>

      {/* Excel download */}
      {job.result_url && (
        <a
          href={job.result_url}
          download={`reconciliation_${job.vendor_key}.xlsx`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          ⬇ Download Full Report (.xlsx)
        </a>
      )}

      {/* Detail tabs */}
      {data && (
        <div>
          <div className="flex border-b border-gray-200">
            {([
              ['discrepancies', `Discrepancies (${data.discrepancies.length})`],
              ['matched',       `Matched (${data.matched.length})`],
              ['unmatched',     `Unmatched (${data.stmt_only.length + data.qb_only.length})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === 'discrepancies' && <DiscrepanciesTable rows={data.discrepancies} />}
            {tab === 'matched'       && <MatchedTable rows={data.matched} />}
            {tab === 'unmatched'     && <UnmatchedTable stmtOnly={data.stmt_only} qbOnly={data.qb_only} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tables ────────────────────────────────────────────────────────────────────

function DiscrepanciesTable({ rows }: { rows: MatchedRecord[] }) {
  if (!rows.length) return <EmptyState message="No discrepancies — all matched invoices agree on amount and date." success />;
  return (
    <ScrollTable>
      <thead>
        <Th>Invoice No</Th>
        <Th>Stmt Date</Th>
        <Th>QB Date</Th>
        <Th right>Date Drift</Th>
        <Th right>Stmt Amount</Th>
        <Th right>QB Amount</Th>
        <Th right>Delta</Th>
        <Th>Reason</Th>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-gray-100 bg-red-50">
            <Td mono>{r.invoice_no}</Td>
            <Td>{r.stmt_date ?? '—'}</Td>
            <Td>{r.qb_date ?? '—'}</Td>
            <Td right>{r.date_drift_days > 0 ? `${r.date_drift_days}d` : '—'}</Td>
            <Td right>{fmtCurrency(r.stmt_amount)}</Td>
            <Td right>{fmtCurrency(r.qb_amount)}</Td>
            <Td right className={r.delta !== 0 ? 'font-semibold text-red-700' : ''}>
              {r.delta > 0 ? '+' : ''}{fmtCurrency(r.delta)}
            </Td>
            <Td>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {r.reason ?? ''}
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  );
}

function MatchedTable({ rows }: { rows: MatchedRecord[] }) {
  if (!rows.length) return <EmptyState message="No clean matches found." />;
  return (
    <ScrollTable>
      <thead>
        <Th>Invoice No</Th>
        <Th>Stmt Date</Th>
        <Th>QB Date</Th>
        <Th right>Date Drift</Th>
        <Th right>Amount</Th>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`border-t border-gray-100 ${r.date_drift_days > 0 ? 'bg-amber-50' : ''}`}>
            <Td mono>{r.invoice_no}</Td>
            <Td>{r.stmt_date ?? '—'}</Td>
            <Td>{r.qb_date ?? '—'}</Td>
            <Td right className={r.date_drift_days > 0 ? 'text-amber-700 font-medium' : ''}>
              {r.date_drift_days > 0 ? `${r.date_drift_days}d` : '—'}
            </Td>
            <Td right>{fmtCurrency(r.stmt_amount)}</Td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  );
}

function UnmatchedTable({ stmtOnly, qbOnly }: { stmtOnly: UnmatchedRecord[]; qbOnly: UnmatchedRecord[] }) {
  const all = [...stmtOnly, ...qbOnly];
  if (!all.length) return <EmptyState message="All records matched on both sides." success />;
  return (
    <ScrollTable>
      <thead>
        <Th>Invoice No</Th>
        <Th>Date</Th>
        <Th right>Amount</Th>
        <Th>Type</Th>
        <Th>Source</Th>
      </thead>
      <tbody>
        {all.map((r, i) => (
          <tr key={i} className="border-t border-gray-100 bg-orange-50">
            <Td mono>{r.invoice_no}</Td>
            <Td>{r.date ?? '—'}</Td>
            <Td right>{fmtCurrency(r.amount)}</Td>
            <Td>{r.type}</Td>
            <Td>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                r.source === 'statement'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {r.source === 'statement' ? 'Statement' : 'QB'}
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  );
}

// ── Small shared components ───────────────────────────────────────────────────

function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`bg-gray-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, right, mono, className = '' }: {
  children: React.ReactNode; right?: boolean; mono?: boolean; className?: string;
}) {
  return (
    <td className={`px-4 py-2.5 text-gray-700 ${right ? 'text-right tabular-nums' : ''} ${mono ? 'font-mono text-xs' : ''} ${className}`}>
      {children}
    </td>
  );
}

function Metric({ label, value, ok, warn }: { label: string; value: string; ok?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${ok ? 'text-green-600' : warn ? 'text-amber-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-gray-500">
      <svg className="h-4 w-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
      </svg>
      {label}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
      <strong>Error:</strong> {message}
    </div>
  );
}

function EmptyState({ message, success }: { message: string; success?: boolean }) {
  return (
    <div className={`rounded-lg px-4 py-6 text-center text-sm ${success ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
      {message}
    </div>
  );
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
