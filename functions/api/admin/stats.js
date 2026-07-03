// GET /api/admin/stats — 系统统计（管理员）
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!await context.data.requireAdmin(request)) return context.data.error('无权限', 403);

  const totalUsers = (await env.DB.prepare('SELECT COUNT(*) as c FROM users').first()).c;
  const activeKeys = (await env.DB.prepare('SELECT COUNT(*) as c FROM api_keys WHERE is_active=1').first()).c;
  const totalRequests = (await env.DB.prepare('SELECT COUNT(*) as c FROM usage_logs').first()).c;
  const totalTokens = (await env.DB.prepare('SELECT COALESCE(SUM(tokens_total),0) as c FROM usage_logs').first()).c;
  const totalCost = (await env.DB.prepare('SELECT COALESCE(SUM(cost),0) as c FROM usage_logs').first()).c;

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const dailyRows = await env.DB.prepare(
    "SELECT date(created_at) as d, COUNT(*) as cnt, COALESCE(SUM(tokens_total),0) as tok FROM usage_logs WHERE created_at>=? GROUP BY d ORDER BY d"
  ).bind(since).all();

  const modelRows = await env.DB.prepare(
    "SELECT model, COALESCE(SUM(tokens_total),0) as tok, COUNT(*) as cnt FROM usage_logs GROUP BY model ORDER BY tok DESC LIMIT 10"
  ).all();

  return context.data.json({
    total_users: totalUsers,
    active_keys: activeKeys,
    total_requests: totalRequests,
    total_tokens: totalTokens,
    total_cost: Math.round(totalCost * 10000) / 10000,
    daily_trend: dailyRows.results.map(r => ({ date: r.d, requests: r.cnt, tokens: r.tok })),
    model_ranking: modelRows.results.map(r => ({ model: r.model, tokens: r.tok, count: r.cnt })),
  });
}
