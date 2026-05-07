import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { triggerReconcileWorkflow } from '@/lib/github';
import { VENDORS } from '@/lib/vendors';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[reconcile] Supabase init error:', msg);
    return NextResponse.json({ error: `Configuration error: ${msg}` }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const vendorKey = formData.get('vendor_key') as string | null;
  const qbFiles   = formData.getAll('qb_files') as File[];
  const stmtFile  = formData.get('stmt_file') as File | null;

  if (!vendorKey || !VENDORS[vendorKey]) {
    return NextResponse.json({ error: 'Invalid vendor key' }, { status: 400 });
  }
  if (!qbFiles.length || !stmtFile) {
    return NextResponse.json({ error: 'At least one QuickBooks file and a vendor statement are required' }, { status: 400 });
  }

  // Create the job record
  const { data: job, error: jobError } = await supabase
    .from('reconciliation_jobs')
    .insert({ vendor_key: vendorKey, status: 'pending', qb_file_count: qbFiles.length })
    .select('id')
    .single();

  if (jobError || !job) {
    console.error('[reconcile] insert error:', jobError);
    return NextResponse.json(
      { error: `Failed to create job: ${jobError?.message ?? 'no data returned'}` },
      { status: 500 }
    );
  }

  const jobId = job.id as string;
  const bucket = 'reconciliation-files';
  const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  // Upload all QB files and the statement in parallel
  const qbBuffers  = await Promise.all(qbFiles.map(f => f.arrayBuffer().then(Buffer.from)));
  const stmtBuffer = await stmtFile.arrayBuffer().then(Buffer.from);

  const uploads = await Promise.all([
    ...qbBuffers.map((buf, i) =>
      supabase.storage.from(bucket).upload(`${jobId}/qb_${i}.xlsx`, buf, { contentType: xlsx })
    ),
    supabase.storage.from(bucket).upload(`${jobId}/statement.pdf`, stmtBuffer, { contentType: 'application/pdf' }),
  ]);

  const uploadErr = uploads.find(r => r.error)?.error;
  if (uploadErr) {
    console.error('[reconcile] storage upload error:', uploadErr.message);
    await supabase.from('reconciliation_jobs').update({ status: 'error', error_message: `File upload failed: ${uploadErr.message}` }).eq('id', jobId);
    return NextResponse.json({ error: `File upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  // Mark files uploaded
  await supabase.from('reconciliation_jobs').update({
    qb_file_path:   `${jobId}/qb_0.xlsx`,
    stmt_file_path: `${jobId}/statement.pdf`,
    status: 'pending',
  }).eq('id', jobId);

  // Trigger GitHub Actions — if this fails, the job stays pending and can be retried
  try {
    await triggerReconcileWorkflow(jobId, vendorKey, qbFiles.length);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[reconcile] GitHub dispatch error:', detail);
    await supabase.from('reconciliation_jobs').update({
      status: 'error',
      error_message: `Failed to trigger workflow: ${detail}`,
    }).eq('id', jobId);
    return NextResponse.json({ error: `Failed to trigger reconciliation workflow: ${detail}` }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
