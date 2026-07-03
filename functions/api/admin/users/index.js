// GET /api/admin/users — 用户列表（管理员）
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!await context.data.requireAdmin(request)) return context.data.error('无权限', 403);

  const rows = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return context.data.json({ users: rows.results });
}
