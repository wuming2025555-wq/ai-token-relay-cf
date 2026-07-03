// GET /api/user/profile — 用户资料
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await context.data.requireUser(request);
  if (!user) return context.data.error('未登录', 401);
  return context.data.json({ user });
}
