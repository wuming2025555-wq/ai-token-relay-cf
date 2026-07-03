# AI Token 中转站 — 部署到 Cloudflare Pages

## 前置条件

- [Node.js](https://nodejs.org/) v18+
- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)
- GitHub/GitLab 账号（用于连接 Pages）

---

## 第一步：本地安装

```bash
# 1. 进入项目目录（Windows: 打开 CMD 或 PowerShell）
cd ai-token-relay-cf

# 2. 安装依赖（只有 jose 一个第三方包）
npm install
```

## 第二步：创建 D1 数据库

```bash
# 1. 登录 Cloudflare（浏览器会自动打开授权页面）
npx wrangler login

# 2. 创建 D1 数据库
npx wrangler d1 create ai-token-relay
```

成功后会输出类似：

```
✅ Successfully created DB 'ai-token-relay' in region APAC
Created your new D1 database.
[[d1_databases]]
binding = "DB"
database_name = "ai-token-relay"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

> 记下这个 `database_id`，后面要用。

## 第三步：初始化数据库

```bash
# 执行建表 SQL
npx wrangler d1 execute ai-token-relay --file=./db/schema.sql
```

看到 `✅ Success` 就表示表已创建。

## 第四步：部署 Pages

### 方式 A：直接部署（推荐，无需 Git）

```bash
# 首次部署，--d1 参数会自动绑定数据库
npx wrangler pages deploy ./public --d1 DB=ai-token-relay
```

部署完成后会输出预览 URL，例如：

```
✨ Deployment complete! Take a peek at: https://xxxxx-xxx.pages.dev
```

### 方式 B：通过 Git 连接

1. 把 `ai-token-relay-cf` 文件夹推送到 GitHub 仓库
2. 在 Cloudflare Dashboard → **Workers & Pages** → **创建应用** → **Pages** → **连接到 Git**
3. 选择你的仓库，构建配置保持默认（输出目录: `public`）
4. 部署后在 Pages 项目设置中关联 D1 数据库

## 第五步：配置环境变量

部署后在 **Cloudflare Dashboard** → **Workers & Pages** → 选择你的项目 → **设置** → **环境变量** 中添加：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `JWT_SECRET` | **是** | 随机字符串，用于 JWT 签名（例如 `openssl rand -hex 32` 生成） |
| `OPENAI_API_KEY` | 代理 OpenAI 时需要 | 你的 OpenAI API Key |
| `ANTHROPIC_API_KEY` | 代理 Anthropic 时需要 | 你的 Anthropic API Key |
| `DEFAULT_USER_QUOTA` | 否 | 新用户默认 token 配额，默认 `1000000` |
| `MARKUP_RATIO` | 否 | 价格倍率，默认 `1.0`（设为 `1.2` = 加价 20%） |

### 添加 D1 数据库绑定

在 Pages 项目 → **设置** → **Functions** → **D1 数据库绑定**：

| 变量名 | 说明 |
|--------|------|
| 绑定名称 | `DB` |
| 数据库 | 选择 `ai-token-relay` |

## 第六步：验证部署

```bash
# 健康检查
curl https://你的域名.pages.dev/health

# 应该返回：
# {"status":"ok","version":"1.0.0","db":"ok","timestamp":"..."}
```

## 本地开发

```bash
npx wrangler pages dev ./public --d1 DB=ai-token-relay
```

这会启动一个本地服务器（默认 `localhost:8788`），支持 Functions 和 D1 数据库。

## 常见问题

### `npx wrangler login` 无法打开浏览器

```bash
# 手动方式：生成 API Token
npx wrangler login --browser=false
# 会输出一个 URL，手动复制到浏览器打开即可
```

### 部署后访问页面返回 500

检查 Dashboard → **设置** → **环境变量** 中 `JWT_SECRET` 是否已设置。系统首次启动需要该变量生成 JWT Token。

### 如何重新部署

```bash
# 修改代码后重新执行
npx wrangler pages deploy ./public --d1 DB=ai-token-relay
```

### 查看日志

Cloudflare Dashboard → **Workers & Pages** → 你的项目 → **Functions** → **日志**，可以查看每一条 API 调用的日志。
