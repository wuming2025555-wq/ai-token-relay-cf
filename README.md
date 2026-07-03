# AI Token 中转站 — Cloudflare Pages 版

一个运行在 Cloudflare Pages + D1 + Functions 上的 AI API 统一代理和用量管理平台。**零服务器成本**，全球 CDN 加速。

## 架构

```
用户浏览器 → Cloudflare CDN → Pages Static (HTML/CSS/JS)
                             → Pages Functions (API)
                             → D1 Database (SQLite)
                             → 上游 AI API (OpenAI/Anthropic)
```

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 D1 数据库

```bash
# 创建数据库
npx wrangler d1 create ai-token-relay

# 输出中会得到 database_id，填入 wrangler.toml
# 然后初始化表结构
npx wrangler d1 execute ai-token-relay --file=./db/schema.sql
```

### 3. 配置环境变量

在 Cloudflare Dashboard → Pages → 项目 → 环境变量中设置：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API Key（可选） |
| `ANTHROPIC_API_KEY` | Anthropic API Key（可选） |
| `JWT_SECRET` | JWT 签名密钥（必填，建议长随机字符串） |
| `DEFAULT_USER_QUOTA` | 新用户默认配额（默认 1000000） |
| `MARKUP_RATIO` | 价格倍率（默认 1.0） |

### 4. 部署

```bash
# 首次部署——需要在 dashboard 关联 D1 绑定
npx wrangler pages deploy ./public

# 关联 D1 绑定后
npx wrangler pages deploy ./public --d1 DB=ai-token-relay
```

### 5. 本地开发

```bash
npm run dev
```

## 项目结构

```
├── public/                          # 静态资源
│   ├── index.html                   # 落地页
│   ├── login.html                   # 登录
│   ├── register.html                # 注册
│   ├── dashboard.html               # 用户仪表盘 (SPA)
│   ├── admin.html                   # 管理后台
│   ├── css/app.css                  # 样式
│   └── js/app.js                    # 全局 JS
├── functions/                       # Cloudflare Functions
│   ├── _middleware.js                # 全局中间件 (CORS + 初始化)
│   ├── health.js                    # GET /health
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.js             # POST /api/auth/login
│   │   │   └── register.js          # POST /api/auth/register
│   │   ├── user/
│   │   │   ├── profile.js           # GET /api/user/profile
│   │   │   ├── keys.js              # GET+POST /api/user/keys
│   │   │   ├── keys/[keyId].js      # DELETE /api/user/keys/:id
│   │   │   └── usage.js             # GET /api/user/usage
│   │   └── admin/
│   │       ├── users/index.js       # GET /api/admin/users
│   │       ├── users/[userId].js    # PUT /api/admin/users/:id
│   │       └── stats.js             # GET /api/admin/stats
│   └── v1/
│       ├── models.js                # GET /v1/models
│       └── chat/completions.js      # POST /v1/chat/completions
├── db/schema.sql                    # D1 表结构
├── wrangler.toml                    # Cloudflare 配置
└── package.json
```

## 默认账号

系统首次启动自动创建：

- **管理员**: admin / admin123
- **演示用户**: demo / demo123

## API 使用

兼容 OpenAI SDK：

```python
from openai import OpenAI
client = OpenAI(
    base_url="https://your-domain.pages.dev/v1",
    api_key="sk-aihub-xxxxxxxxx"
)
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## 定价

| 模型 | 输入 ($/1M tokens) | 输出 ($/1M tokens) |
|------|------|------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| claude-sonnet-4 | $3.00 | $15.00 |
| claude-3-haiku | $0.25 | $1.25 |

可通过 `MARKUP_RATIO` 调整加价倍率。
