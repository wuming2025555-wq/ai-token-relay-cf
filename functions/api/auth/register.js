// POST /api/auth/register — 用户注册
export async function onRequestPost(context) {
  const { request, env } = context;
  const { hashPassword, generateSalt, createToken, json, error } = context.data;

  try {
    const { username, password } = await request.json();
    const uname = (username || '').trim();
    const pwd = (password || '').trim();

    if (!uname || !pwd) return error('请输入用户名和密码');
    if (uname.length < 3 || uname.length > 32) return error('用户名需要 3-32 个字符');
    if (pwd.length < 6) return error('密码至少 6 个字符');

    const existing = await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(uname).first();
    if (existing) return error('用户名已存在', 409);

    const salt = generateSalt();
    const pwhash = await hashPassword(pwd, salt);
    const defaultQuota = parseInt(env.DEFAULT_USER_QUOTA || '1000000');

    const result = await env.DB.prepare(
      'INSERT INTO users (username,password_hash,password_salt,role,quota) VALUES (?,?,?,?,?)'
    ).bind(uname, pwhash, salt, 'user', defaultQuota).run();

    const uid = result.meta.last_row_id;
    const keyStr = 'sk-aihub-' + generateSalt().slice(0, 48);
    await env.DB.prepare('INSERT INTO api_keys (user_id,key,name) VALUES (?,?,?)').bind(uid, keyStr, '默认密钥').run();

    const token = await createToken(uid, uname, 'user');
    return json({
      token,
      user: { id: uid, username: uname, role: 'user', quota: defaultQuota, used_tokens: 0 },
      api_key: { key: keyStr, name: '默认密钥' },
    }, 201);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return error('用户名已存在', 409);
    return error('请求格式错误', 400);
  }
}
