import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ReconciliationData } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('reconciliation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  let result_url: string | null = null;
  let result_data: ReconciliationData | null = null;

  if (data.status === 'done') {
    // Generate a 1-hour signed download URL for the Excel file
    if (data.result_file_path) {
      const { data: signed } = await supabase.storage
        .from('reconciliation-files')
        .createSignedUrl(data.result_file_path, 3600);
      result_url = signed?.signedUrl ?? null;
    }

    // Fetch and inline the JSON result so the UI can display the comparison
    if (data.result_json_path) {
      try {
        const { data: jsonBlob } = await supabase.storage
          .from('reconciliation-files')
          .download(data.result_json_path);
        if (jsonBlob) {
          const text = await jsonBlob.text();
          result_data = JSON.parse(text) as ReconciliationData;
        }
      } catch {
        // Non-fatal — the Excel download still works without the JSON
      }
    }
  }

  return NextResponse.json({ ...data, result_url, result_data });
}
