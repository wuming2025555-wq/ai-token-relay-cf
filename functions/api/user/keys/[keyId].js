// DELETE /api/user/keys/:keyId — 删除 API 密钥
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const user = await context.data.requireUser(request);
  if (!user) return context.data.error('未登录', 401);

  const row = await env.DB.prepare('SELECT id FROM api_keys WHERE id=? AND user_id=?')
    .bind(params.keyId, user.id).first();
  if (!row) return context.data.error('密钥不存在', 404);

  await env.DB.prepare('DELETE FROM api_keys WHERE id=?').bind(params.keyId).run();
  return context.data.json({ message: '已删除' });
}
