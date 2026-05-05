'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VENDORS } from '@/lib/vendors';

type FileField = 'qb_file' | 'stmt_file';

export default function UploadPage() {
  const router = useRouter();
  const vendorKeys = Object.keys(VENDORS);

  const [vendorKey, setVendorKey]   = useState(vendorKeys[0]);
  const [qbFile, setQbFile]         = useState<File | null>(null);
  const [stmtFile, setStmtFile]     = useState<File | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  function handleFile(field: FileField, files: FileList | null) {
    const file = files?.[0] ?? null;
    if (field === 'qb_file') setQbFile(file);
    else setStmtFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qbFile || !stmtFile) return;

    setLoading(true);
    setError(null);

    const body = new FormData();
    body.append('vendor_key', vendorKey);
    body.append('qb_file', qbFile);
    body.append('stmt_file', stmtFile);

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

  const canSubmit = !!qbFile && !!stmtFile && !loading;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Statement Reconciler</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a QuickBooks export and vendor statement to generate a reconciliation report.
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

          {/* QuickBooks file */}
          <FileInput
            id="qb_file"
            label="QuickBooks Export"
            accept=".xlsx"
            hint="Transactions export from QuickBooks Desktop (.xlsx)"
            file={qbFile}
            onChange={files => handleFile('qb_file', files)}
          />

          {/* Statement PDF */}
          <FileInput
            id="stmt_file"
            label="Vendor Statement"
            accept=".pdf"
            hint="Statement PDF from the vendor"
            file={stmtFile}
            onChange={files => handleFile('stmt_file', files)}
          />

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

function FileInput({
  id, label, accept, hint, file, onChange,
}: {
  id: string;
  label: string;
  accept: string;
  hint: string;
  file: File | null;
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
        {file ? (
          <>
            <span className="text-sm font-medium text-blue-700">{file.name}</span>
            <span className="mt-0.5 text-xs text-gray-400">
              {(file.size / 1024).toFixed(0)} KB · click to change
            </span>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-500">Click to select a file</span>
            <span className="mt-0.5 text-xs text-gray-400">{hint}</span>
          </>
        )}
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={e => onChange(e.target.files)}
        />
      </label>
    </div>
  );
}
