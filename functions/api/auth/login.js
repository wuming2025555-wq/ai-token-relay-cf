// POST /api/auth/login — 用户登录
export async function onRequestPost(context) {
  const { request, env } = context;
  const { hashPassword, createToken, json } = context.data;

  try {
    const { username, password } = await request.json();
    if (!username || !password) return context.data.error('请输入用户名和密码');

    const row = await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username.trim()).first();
    if (!row) return context.data.error('用户名或密码错误', 401);

    const expectedHash = await hashPassword(password, row.password_salt);
    if (expectedHash !== row.password_hash) return context.data.error('用户名或密码错误', 401);
    if (!row.is_active) return context.data.error('账号已被禁用', 403);

    const token = await createToken(row.id, row.username, row.role);
    return json({ token, user: row });
  } catch (e) {
    return context.data.error('请求格式错误', 400);
  }
}
