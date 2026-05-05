import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const url  = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ghPat   = process.env.GITHUB_PAT;
  const ghOwner = process.env.GITHUB_OWNER;
  const ghRepo  = process.env.GITHUB_REPO;

  const envCheck = {
    SUPABASE_URL:              url  ? `${url.slice(0, 30)}…` : '❌ NOT SET',
    SUPABASE_SERVICE_ROLE_KEY: key  ? `set (${key.length} chars)` : '❌ NOT SET',
    GITHUB_PAT:                ghPat   ? `set (${ghPat.length} chars)` : '❌ NOT SET',
    GITHUB_OWNER:              ghOwner ?? '❌ NOT SET',
    GITHUB_REPO:               ghRepo  ?? '❌ NOT SET',
  };

  let supabaseStatus = 'untested';
  let supabaseError: string | null = null;

  try {
    const sb = getSupabaseAdmin();
    // Lightweight ping — just check the table exists
    const { error } = await sb.from('reconciliation_jobs').select('id').limit(1);
    supabaseStatus = error ? `❌ query error: ${error.message}` : '✅ connected';
  } catch (err) {
    supabaseStatus = '❌ exception';
    supabaseError  = err instanceof Error ? err.message : String(err);
  }

  // GitHub PAT check
  let githubStatus = 'untested';
  if (ghPat && ghOwner && ghRepo) {
    try {
      const res = await fetch(`https://api.github.com/repos/${ghOwner}/${ghRepo}`, {
        headers: {
          Authorization: `Bearer ${ghPat}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      const body = await res.json();
      if (res.ok) {
        githubStatus = `✅ repo found: ${body.full_name}`;
      } else {
        githubStatus = `❌ ${res.status}: ${body.message ?? JSON.stringify(body)}`;
      }
    } catch (err) {
      githubStatus = `❌ exception: ${err instanceof Error ? err.message : String(err)}`;
    }
  } else {
    githubStatus = '❌ missing env vars';
  }

  return NextResponse.json({ env: envCheck, supabase: supabaseStatus, supabaseError, github: githubStatus });
}
