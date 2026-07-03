// GET, POST /api/user/keys — API 密钥列表与创建
export async function onRequest(context) {
  const { request, env } = context;
  const user = await context.data.requireUser(request);
  if (!user) return context.data.error('未登录', 401);

  if (request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM api_keys WHERE user_id=?').bind(user.id).all();
    return context.data.json({ keys: rows.results });
  }

  if (request.method === 'POST') {
    try {
      const { name } = await request.json();
      const keyName = name || '密钥-' + Math.random().toString(36).slice(2, 8);
      const keyStr = 'sk-aihub-' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const result = await env.DB.prepare('INSERT INTO api_keys (user_id,key,name) VALUES (?,?,?)')
        .bind(user.id, keyStr, keyName).run();
      const row = await env.DB.prepare('SELECT * FROM api_keys WHERE key=?').bind(keyStr).first();
      return context.data.json({ key: row }, 201);
    } catch {
      return context.data.error('创建失败', 400);
    }
  }

  return context.data.error('Method not allowed', 405);
}
