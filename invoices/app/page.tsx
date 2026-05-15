'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VENDORS } from '@/lib/vendors';

export default function UploadPage() {
  const router = useRouter();
  const vendorKeys = Object.keys(VENDORS);

  const [vendorKey, setVendorKey]   = useState(vendorKeys[0]);
  const [qbFiles, setQbFiles]       = useState<File[]>([]);
  const [stmtFiles, setStmtFiles]   = useState<File[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qbFiles.length || !stmtFiles.length) return;

    setLoading(true);
    setError(null);

    const body = new FormData();
    body.append('vendor_key', vendorKey);
    qbFiles.forEach(f => body.append('qb_files', f));
    stmtFiles.forEach(f => body.append('stmt_files', f));

    try {
      const res = await fetch('/api/reconcile', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unknown error');
      router.push(`/results/${json.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setLoading(false);
    }
  }

  const canSubmit = qbFiles.length > 0 && stmtFiles.length > 0 && !loading;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Statement Reconciler</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload one or more QuickBooks exports and a vendor statement to generate a reconciliation report.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          {/* Vendor */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Vendor
            </label>
            <select
              value={vendorKey}
              onChange={e => setVendorKey(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {vendorKeys.map(key => (
                <option key={key} value={key}>{VENDORS[key]}</option>
              ))}
            </select>
          </div>

          {/* QuickBooks files — multi-select */}
          <MultiFileInput
            id="qb_files"
            label="QuickBooks Export(s)"
            accept=".xlsx"
            hint="One or more transaction exports from QuickBooks Desktop (.xlsx)"
            files={qbFiles}
            onChange={files => setQbFiles(files ? Array.from(files) : [])}
          />

          {/* Vendor statement PDFs — multi-select */}
          <MultiFileInput
            id="stmt_files"
            label="Vendor Statement(s)"
            accept=".pdf,.xlsx"
            hint="PDF for most vendors · XLSX for Cummins"
            files={stmtFiles}
            onChange={files => setStmtFiles(files ? Array.from(files) : [])}
          />
          <p className="text-xs text-gray-400">
            Most vendors send statements as <strong>PDF</strong>. Cummins (ONEBMS) sends <strong>XLSX</strong> — if you only have a printed copy, export to PDF first and the parser will do its best.
          </p>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Uploading…' : 'Run Reconciliation'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          Reconciliation runs via GitHub Actions — results typically arrive in 30–90 seconds.
        </p>
      </div>
    </main>
  );
}

function MultiFileInput({
  id, label, accept, hint, files, onChange,
}: {
  id: string;
  label: string;
  accept: string;
  hint: string;
  files: File[];
  onChange: (files: FileList | null) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50"
      >
        {files.length > 0 ? (
          <>
            <span className="text-sm font-medium text-blue-700">
              {files.length === 1 ? files[0].name : `${files.length} files selected`}
            </span>
            <span className="mt-0.5 text-xs text-gray-400">click to change</span>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-500">Click to select file(s)</span>
            <span className="mt-0.5 text-xs text-gray-400">{hint}</span>
          </>
        )}
        <input
          id={id}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={e => onChange(e.target.files)}
        />
      </label>
      {files.length > 1 && (
        <ul className="mt-2 space-y-0.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="inline-block w-4 text-right text-gray-400">{i + 1}.</span>
              <span>{f.name}</span>
              <span className="text-gray-300">·</span>
              <span>{(f.size / 1024).toFixed(0)} KB</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
