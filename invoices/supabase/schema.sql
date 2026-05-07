-- Run this in the Supabase SQL editor to set up the reconciliation schema.
-- If you already ran an earlier version, use the ALTER TABLE at the bottom
-- to add the new result_json_path column.

-- Job tracking table
create table if not exists reconciliation_jobs (
  id                uuid        default gen_random_uuid() primary key,
  vendor_key        text        not null,
  status            text        not null default 'pending',
    -- pending | running | done | error
  qb_file_path      text,
  stmt_file_path    text,
  result_file_path  text,          -- path to result.xlsx in storage
  result_json_path  text,          -- path to result.json in storage
  matched_count     integer,
  mismatch_count    integer,       -- discrepancies (amount or date)
  stmt_only_count   integer,
  qb_only_count     integer,
  stmt_total        numeric(12, 2),
  qb_total          numeric(12, 2),
  error_message     text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Auto-update updated_at on any row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reconciliation_jobs_updated_at
  before update on reconciliation_jobs
  for each row execute procedure set_updated_at();

-- Row Level Security: only service role can read/write (no anon access)
alter table reconciliation_jobs enable row level security;

-- ── If you already created the table without result_json_path ─────────────────
-- Run this separately
alter table reconciliation_jobs add column if not exists result_json_path text;

-- ── Add file counts for multi-file support ────────────────────────────────────
alter table reconciliation_jobs add column if not exists qb_file_count   integer not null default 1;
alter table reconciliation_jobs add column if not exists stmt_file_count integer not null default 1;

-- ── Storage ───────────────────────────────────────────────────────────────────
-- In the Supabase dashboard → Storage, create a bucket named:
--   reconciliation-files
-- with Public access set to OFF (private).
--
-- The service role key (used by Next.js API routes and GitHub Actions)
-- bypasses RLS and can read/write storage without additional policies.
