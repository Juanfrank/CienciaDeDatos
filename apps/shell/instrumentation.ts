/** Arranque del proceso del shell. */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { backgroundWorkerStart } = await import('./src/server/worker');
  backgroundWorkerStart();
}
