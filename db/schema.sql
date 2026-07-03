-- AI Token 中转站 D1 数据库 Schema
-- 部署前执行: wrangler d1 execute ai-token-relay --file=./db/schema.sql
-- 部署后自动执行可通过 Functions 的 init 函数

CREATE TABLE IF NOT EXISTS users (
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
);

CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    key TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT 'Default',
    is_active INTEGER DEFAULT 1,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_logs (
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
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_apikey ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_usage_time ON usage_logs(created_at);
