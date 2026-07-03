/**
 * AI Token 中转站 - 全局 JavaScript
 */

// ─── Toast 通知系统 ───
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-weight:700;">${icons[type] || 'ℹ'}</span> ${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── 工具函数 ───
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function fmtNum(n) {
  if (n === undefined || n === null) return '-';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板', 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      showToast('已复制到剪贴板', 'success');
    });
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ─── API 请求辅助 ───
async function apiFetch(path, options = {}) {
  const token = getCookie('token');
  const headers = { ...options.headers };
  if (token && !headers['Authorization']) headers['X-Token'] = token;
  const resp = await fetch(path, { ...options, headers });
  if (resp.status === 401) {
    document.cookie = 'token=;path=/;max-age=0';
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  return resp;
}

async function apiGet(path) { const r = await apiFetch(path); return r.json(); }
async function apiPost(path, data) {
  const r = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}
async function apiPut(path, data) {
  const r = await apiFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}
async function apiDelete(path) {
  const r = await apiFetch(path, { method: 'DELETE' });
  return r.json();
}

// ─── 初始化：全局 Modal 关闭 ───
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('open'); });
  });
});
