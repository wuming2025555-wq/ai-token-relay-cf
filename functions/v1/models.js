// GET /v1/models — 可用模型列表（需 API Key）
const UPSTREAM_PROVIDERS = {
  openai: {
    models: {
      'gpt-4o':              { input: 2.50,  output: 10.00 },
      'gpt-4o-mini':         { input: 0.15,  output: 0.60 },
      'gpt-4-turbo':         { input: 10.00, output: 30.00 },
      'gpt-3.5-turbo':       { input: 0.50,  output: 1.50 },
    },
  },
  anthropic: {
    models: {
      'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
      'claude-sonnet-4':          { input: 3.00, output: 15.00 },
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-3-haiku-20240307':  { input: 0.25, output: 1.25 },
    },
  },
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await context.data.requireApiKey(request);
  if (!auth) return context.data.error({ message: '无效的 API Key' }, 401);

  const markup = parseFloat(env.MARKUP_RATIO || '1.0');
  const data = [];
  for (const [provider, cfg] of Object.entries(UPSTREAM_PROVIDERS)) {
    for (const [model, pricing] of Object.entries(cfg.models)) {
      data.push({
        id: model,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: provider,
        permission: [],
        pricing: {
          input: pricing.input * markup,
          output: pricing.output * markup,
          unit: 'per_1M_tokens',
        },
      });
    }
  }
  return context.data.json({ object: 'list', data });
}
