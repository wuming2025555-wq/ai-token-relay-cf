// POST /v1/chat/completions — 聊天补全代理
const UPSTREAM = {
  'gpt-4o':              { provider: 'openai',    base: 'https://api.openai.com' },
  'gpt-4o-mini':         { provider: 'openai',    base: 'https://api.openai.com' },
  'gpt-4-turbo':         { provider: 'openai',    base: 'https://api.openai.com' },
  'gpt-3.5-turbo':       { provider: 'openai',    base: 'https://api.openai.com' },
  'claude-sonnet-4-20250514': { provider: 'anthropic', base: 'https://api.anthropic.com' },
  'claude-sonnet-4':          { provider: 'anthropic', base: 'https://api.anthropic.com' },
  'claude-3-5-sonnet-20241022': { provider: 'anthropic', base: 'https://api.anthropic.com' },
  'claude-3-haiku-20240307':  { provider: 'anthropic', base: 'https://api.anthropic.com' },
};

const PRICING = {
  'gpt-4o':              { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':         { input: 0.15,  output: 0.60 },
  'gpt-4-turbo':         { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo':       { input: 0.50,  output: 1.50 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4':          { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307':  { input: 0.25, output: 1.25 },
};

function countTokens(body) {
  const text = JSON.stringify(body);
  return Math.max(1, Math.floor(text.length / 3));
}

function formatDate() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. 验证 API Key
  const auth = await context.data.requireApiKey(request);
  if (!auth) {
    return context.data.json({
      error: { message: '无效的 API Key 或配额用尽', type: 'auth_error', code: 'invalid_key' }
    }, 401);
  }
  const { user, apiKey } = auth;

  // 2. 解析请求
  let body;
  try { body = await request.json(); } catch {
    return context.data.json({ error: { message: '无效的请求格式' } }, 400);
  }
  const model = body.model || '';
  const upstream = UPSTREAM[model];
  if (!upstream) {
    return context.data.json({ error: { message: `不支持的模型: ${model}` } }, 400);
  }

  // 3. 获取上游 API Key
  const envKeyName = upstream.provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
  const upstreamKey = env[envKeyName] || '';
  if (!upstreamKey) {
    return context.data.json({
      error: { message: `上游 ${upstream.provider} 未配置 API Key`, type: 'server_error' }
    }, 503);
  }

  // 4. 检查配额
  const estTokens = countTokens(body);
  const remaining = user.quota - user.used_tokens;
  if (remaining < estTokens) {
    return context.data.json({
      error: { message: `配额不足（剩余 ${remaining} tokens，预估需要 ${estTokens}）`, type: 'quota_error' }
    }, 402);
  }

  // 5. 转发到上游
  const upstreamUrl = `${upstream.base}/v1/chat/completions`;
  const isStream = body.stream === true;

  try {
    const upstreamResp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${upstreamKey}`,
      },
      body: JSON.stringify(body),
    });

    // 读取响应
    const respBody = await upstreamResp.text();
    const status = upstreamResp.status;

    // 6. 统计 token 用量
    let tokensIn = 0, tokensOut = 0;
    try {
      const rd = JSON.parse(respBody);
      const usage = rd.usage || {};
      tokensIn = usage.prompt_tokens || usage.input_tokens || 0;
      tokensOut = usage.completion_tokens || usage.output_tokens || 0;
    } catch {}
    if (tokensIn === 0) {
      tokensIn = countTokens(body);
      tokensOut = Math.floor(respBody.length / 4);
    }

    // 7. 计算费用
    const pricing = PRICING[model];
    const markup = parseFloat(env.MARKUP_RATIO || '1.0');
    const cost = pricing
      ? (tokensIn * pricing.input * markup + tokensOut * pricing.output * markup) / 1_000_000
      : 0;

    // 8. 记录用量
    const now = formatDate();
    try {
      await env.DB.prepare(
        `INSERT INTO usage_logs (user_id,api_key_id,model,provider,tokens_in,tokens_out,tokens_total,cost,request_path,status_code,ip_address,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        user.id, apiKey.id, model, upstream.provider,
        tokensIn, tokensOut, tokensIn + tokensOut, cost,
        '/v1/chat/completions', status, request.headers.get('CF-Connecting-IP') || '',
        now
      ).run();

      await env.DB.prepare('UPDATE users SET used_tokens=used_tokens+? WHERE id=?')
        .bind(tokensIn + tokensOut, user.id).run();
      await env.DB.prepare("UPDATE api_keys SET last_used_at=? WHERE id=?")
        .bind(now, apiKey.id).run();
    } catch (e) {
      console.error('Failed to record usage:', e);
    }

    // 9. 返回响应
    const ct = upstreamResp.headers.get('Content-Type') || 'application/json';
    return new Response(respBody, {
      status,
      headers: {
        'Content-Type': ct,
        'Access-Control-Allow-Origin': '*',
        'X-AIHub-Model': model,
        'X-AIHub-Tokens': String(tokensIn + tokensOut),
      },
    });

  } catch (e) {
    return context.data.json({
      error: { message: `上游连接失败: ${e.message}`, type: 'upstream_error' }
    }, 502);
  }
}
