// PUT /api/admin/users/:userId — 编辑用户（管理员）
export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!await context.data.requireAdmin(request)) return context.data.error('无权限', 403);

  const target = await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(params.userId).first();
  if (!target) return context.data.error('用户不存在', 404);

  try {
    const data = await request.json();
    if (data.quota !== undefined) {
      await env.DB.prepare('UPDATE users SET quota=? WHERE id=?').bind(data.quota, params.userId).run();
    }
    if (data.role !== undefined) {
      await env.DB.prepare('UPDATE users SET role=? WHERE id=?').bind(data.role, params.userId).run();
    }
    if (data.is_active !== undefined) {
      await env.DB.prepare('UPDATE users SET is_active=? WHERE id=?').bind(data.is_active ? 1 : 0, params.userId).run();
    }
    if (data.password) {
      const salt = context.data.generateSalt();
      const pwhash = await context.data.hashPassword(data.password, salt);
      await env.DB.prepare('UPDATE users SET password_hash=?, password_salt=? WHERE id=?')
        .bind(pwhash, salt, params.userId).run();
    }

    const row = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(params.userId).first();
    return context.data.json({ user: row });
  } catch {
    return context.data.error('更新失败', 400);
  }
}
