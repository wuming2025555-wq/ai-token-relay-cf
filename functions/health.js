// GET /health — 健康检查
export async function onRequestGet(context) {
  const { env } = context;
  let dbStatus = 'ok';
  try {
    await env.DB.prepare('SELECT 1').run();
  } catch {
    dbStatus = 'error';
  }
  return context.data.json({
    status: 'ok',
    version: '1.0.0',
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
}
