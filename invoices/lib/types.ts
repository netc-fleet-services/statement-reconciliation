export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface ReconciliationJob {
  id: string;
  vendor_key: string;
  status: JobStatus;
  qb_file_path: string | null;
  stmt_file_path: string | null;
  result_file_path: string | null;
  result_json_path: string | null;
  matched_count: number | null;
  mismatch_count: number | null;
  stmt_only_count: number | null;
  qb_only_count: number | null;
  stmt_total: number | null;
  qb_total: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  /** Populated by the API route when status === 'done' */
  result_url?: string;
  result_data?: ReconciliationData;
}

// ── Detailed reconciliation result (loaded from result.json) ─────────────────

export interface MatchedRecord {
  invoice_no: string;
  stmt_date: string | null;
  qb_date: string | null;
  stmt_amount: number;
  qb_amount: number;
  delta: number;
  date_drift_days: number;
  reason: string | null; // null | "amount" | "date" | "amount+date"
}

export interface UnmatchedRecord {
  invoice_no: string;
  date: string | null;
  amount: number;
  type: string;
  po_ref?: string | null;
  source: 'statement' | 'qb';
}

export interface ReconciliationData {
  vendor: string;
  statement_mode: string; // "open_only" | "all_activity"
  stmt_total: number | null;
  qb_total: number;
  stmt_record_count: number;
  qb_record_count: number;
  matched: MatchedRecord[];
  discrepancies: MatchedRecord[];
  stmt_only: UnmatchedRecord[];
  qb_only: UnmatchedRecord[];
}
