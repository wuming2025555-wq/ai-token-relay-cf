// AI Token 中转站 — 全局中间件
// 提供 CORS、JWT、密码哈希、响应辅助工具
import { SignJWT, jwtVerify } from 'jose';

export async function onRequest(context) {
  const { request, env, next } = context;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Token, Cookie',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const jwtSecretKey = new TextEncoder().encode(
    env.JWT_SECRET || 'ai-token-relay-default-jwt-secret-change-in-production'
  );

  // 自动初始化数据库（幂等，仅首次执行）
  await initDB(env);

  // 共享工具函数
  context.data = {
    db: env.DB,

    // ── JWT ──
    createToken: async (userId, username, role) => {
      return await new SignJWT({ uid: userId, user: username, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .setIssuedAt()
        .sign(jwtSecretKey);
    },

    verifyToken: async (token) => {
      try {
        const { payload } = await jwtVerify(token, jwtSecretKey);
        return payload;
      } catch {
        return null;
      }
    },

    // ── 密码 ──
    hashPassword: async (password, salt) => {
      const enc = new TextEncoder();
      const hash = await crypto.subtle.digest('SHA-256', enc.encode(password + salt));
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    },
    generateSalt: () => {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // ── Token 提取 ──
    getToken: (req) => {
      const c = req.headers.get('Cookie') || '';
      const m = c.match(/token=([^;]+)/);
      if (m) return m[1];
      const a = req.headers.get('Authorization') || '';
      if (a.startsWith('Bearer ')) return a.slice(7);
      return req.headers.get('X-Token') || '';
    },

    // ── 登录验证 ──
    requireUser: async (req) => {
      const token = context.data.getToken(req);
      const payload = await context.data.verifyToken(token);
      if (!payload) return null;
      const row = await env.DB.prepare('SELECT * FROM users WHERE id=? AND is_active=1').bind(payload.uid).first();
      return row ? { ...row, payload } : null;
    },

    requireAdmin: async (req) => {
      const user = await context.data.requireUser(req);
      if (!user || user.role !== 'admin') return null;
      return user;
    },

    requireApiKey: async (req) => {
      const token = context.data.getToken(req);
      if (!token) return null;
      const keyRow = await env.DB.prepare('SELECT * FROM api_keys WHERE key=? AND is_active=1').bind(token).first();
      if (!keyRow) return null;
      const userRow = await env.DB.prepare('SELECT * FROM users WHERE id=? AND is_active=1').bind(keyRow.user_id).first();
      if (!userRow || userRow.used_tokens >= userRow.quota) return null;
      return { user: userRow, apiKey: keyRow };
    },

    // ── 响应辅助 ──
    json: (data, status = 200) => new Response(JSON.stringify(data, (k, v) => v === undefined ? null : v), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    }),
    error: (msg, status = 400) => context.data.json({ error: msg }, status),
  };

  const response = await next();

  // 添加 CORS 头
  const hdrs = new Headers(response.headers);
  if (!hdrs.has('Access-Control-Allow-Origin')) hdrs.set('Access-Control-Allow-Origin', '*');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: hdrs });
}

// ── 数据库自动初始化（幂等）──
async function initDB(env) {
  try {
    // 建表（IF NOT EXISTS 确保幂等）
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      quota INTEGER DEFAULT 1000000,
      used_tokens INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      key TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT 'Default',
      is_active INTEGER DEFAULT 1,
      last_used_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      api_key_id INTEGER REFERENCES api_keys(id),
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      tokens_total INTEGER DEFAULT 0,
      cost REAL DEFAULT 0.0,
      request_path TEXT,
      status_code INTEGER,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_logs(user_id, created_at)`);
    await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_apikey ON api_keys(key)`);
    await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_usage_time ON usage_logs(created_at)`);

    // 种子数据：管理员
    const admin = await env.DB.prepare("SELECT id FROM users WHERE username='admin'").first();
    if (!admin) {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const pwhash = Array.from(new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode('admin123' + salt))
      )).map(b => b.toString(16).padStart(2, '0')).join('');
      await env.DB.prepare(
        "INSERT INTO users (username,email,password_hash,password_salt,role,quota) VALUES (?,?,?,?,?,?)"
      ).bind('admin', 'admin@aihub.local', pwhash, salt, 'admin', 999999999).run();
      console.log('[init] Admin user created');
    }

    // 种子数据：演示用户
    const demo = await env.DB.prepare("SELECT id FROM users WHERE username='demo'").first();
    if (!demo) {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const pwhash = Array.from(new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode('demo123' + salt))
      )).map(b => b.toString(16).padStart(2, '0')).join('');
      const result = await env.DB.prepare(
        "INSERT INTO users (username,email,password_hash,password_salt,role,quota) VALUES (?,?,?,?,?,?)"
      ).bind('demo', 'demo@aihub.local', pwhash, salt, 'user', 1000000).run();
      const uid = result.meta.last_row_id;
      const keyStr = 'sk-aihub-' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      await env.DB.prepare("INSERT INTO api_keys (user_id,key,name) VALUES (?,?,?)")
        .bind(uid, keyStr, '演示密钥').run();
      console.log('[init] Demo user created');
    }
  } catch (e) {
    console.error('[init] DB init error:', e.message);
  }
}
