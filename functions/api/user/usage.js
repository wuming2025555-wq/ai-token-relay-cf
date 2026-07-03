// GET /api/user/usage — 用量统计
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await context.data.requireUser(request);
  if (!user) return context.data.error('未登录', 401);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days')) || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // 用量日志
  const logs = await env.DB.prepare(
    'SELECT * FROM usage_logs WHERE user_id=? AND created_at>=? ORDER BY created_at ASC'
  ).bind(user.id, since).all();

  // 按天聚合
  const dailyMap = {};
  const modelMap = {};
  for (const log of logs.results) {
    const day = log.created_at.slice(0, 10);
    dailyMap[day] = dailyMap[day] || { date: day, tokens: 0, count: 0, cost: 0 };
    dailyMap[day].tokens += log.tokens_total;
    dailyMap[day].count += 1;
    dailyMap[day].cost += log.cost;

    const m = log.model || 'unknown';
    modelMap[m] = modelMap[m] || { model: m, tokens: 0, count: 0, cost: 0 };
    modelMap[m].tokens += log.tokens_total;
    modelMap[m].count += 1;
    modelMap[m].cost += log.cost;
  }

  // 最近请求
  const recent = await env.DB.prepare(
    'SELECT * FROM usage_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 20'
  ).bind(user.id).all();

  const pct = user.quota > 0 ? Math.round(user.used_tokens / user.quota * 100 * 10) / 10 : 0;

  return context.data.json({
    summary: {
      total_tokens: user.used_tokens,
      quota: user.quota,
      quota_remaining: Math.max(0, user.quota - user.used_tokens),
      quota_percent: pct,
    },
    daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    models: Object.values(modelMap).sort((a, b) => b.tokens - a.tokens),
    recent: recent.results,
  });
}
