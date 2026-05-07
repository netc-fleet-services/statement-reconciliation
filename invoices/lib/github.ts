/** Trigger the reconcile GitHub Actions workflow via repository_dispatch. */
export async function triggerReconcileWorkflow(jobId: string, vendorKey: string, qbFileCount: number): Promise<void> {
  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_PAT;

  if (!owner || !repo || !token) {
    throw new Error('GITHUB_OWNER, GITHUB_REPO, and GITHUB_PAT must be set');
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'reconcile',
        client_payload: { job_id: jobId, vendor_key: vendorKey, qb_file_count: qbFileCount },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub dispatch failed (${res.status}): ${body}`);
  }
}
