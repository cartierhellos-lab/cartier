/* ============================================================
   公共工具：Toast、Modal、Router、Helpers
   ============================================================ */

// ===== Toast =====
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ===== Confirm Modal =====
function confirm(msg, title = '确认操作') {
  return new Promise(resolve => {
    const html = `
      <div class="modal-overlay" id="confirm-overlay">
        <div class="modal modal-sm">
          <div class="modal-header">
            <span class="modal-title">${title}</span>
            <button class="modal-close" onclick="document.getElementById('confirm-overlay').remove();resolve(false)">✕</button>
          </div>
          <div class="modal-body text-center">
            <div class="confirm-icon">⚠️</div>
            <div style="font-size:15px;font-weight:600;">${title}</div>
            <div class="confirm-msg">${msg}</div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="confirm-cancel">取消</button>
            <button class="btn btn-danger" id="confirm-ok">确认删除</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
    document.getElementById('confirm-ok').onclick = () => { overlay.remove(); resolve(true); };
  });
}

// ===== Generic Modal =====
function showModal(title, bodyHtml, onConfirm, opts = {}) {
  const id = 'modal-' + Date.now();
  const html = `
    <div class="modal-overlay" id="${id}">
      <div class="modal ${opts.size||''}">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <button class="modal-close" onclick="closeModal('${id}')">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${onConfirm ? `<div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('${id}')">取消</button>
          <button class="btn btn-primary" id="${id}-ok">${opts.okText||'保存'}</button>
        </div>` : ''}
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  if (onConfirm) {
    document.getElementById(`${id}-ok`).onclick = () => onConfirm(id);
  }
  return id;
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ===== Router =====
const Router = {
  routes: {},
  currentPage: null,
  register(name, fn) { this.routes[name] = fn; },
  navigate(hash) { location.hash = '#/' + hash; },
  init() {
    window.addEventListener('hashchange', () => this._render());
    this._render();
  },
  _render() {
    const hash = location.hash.replace('#/', '') || 'dashboard';
    const [page] = hash.split('?');
    const fn = this.routes[page] || this.routes['404'];
    if (fn) { this.currentPage = page; fn(); }
  }
};

// ===== Auth Guard =====
function requireAuth() {
  const token = localStorage.getItem('token');
  if (!token) { location.hash = '#/login'; return false; }
  return true;
}

// ===== Helpers =====
function fmtDate(str) {
  if (!str) return '-';
  return str.replace('T', ' ').substring(0, 16);
}

function taskStatusBadge(status) {
  const map = {
    0: ['badge-muted', '待启动'],
    1: ['badge-success', '运行中'],
    2: ['badge-info', '已完成'],
    3: ['badge-warning', '已暂停'],
    4: ['badge-danger', '失败'],
  };
  const [cls, label] = map[status] || ['badge-muted', '未知'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function userTypeBadge(type) {
  if (type === 100) return `<span class="badge badge-danger">超级管理员</span>`;
  if (type === 10)  return `<span class="badge badge-info">管理员</span>`;
  return `<span class="badge badge-muted">普通账户</span>`;
}

function userStatusBadge(status) {
  return status === 1
    ? `<span class="badge badge-success">正常</span>`
    : `<span class="badge badge-danger">禁用</span>`;
}

function accountStatusBadge(status) {
  const map = { 1: ['badge-success','正常'], 0: ['badge-danger','禁用'], 2: ['badge-warning','风险'] };
  const [cls, label] = map[status] ?? ['badge-muted','未知'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

function paginationHtml(page, total, size) {
  const pages = Math.ceil(total / size) || 1;
  const showing = Math.min(page * size, total);
  const from = (page - 1) * size + 1;
  return `
    <div class="pagination">
      <span>共 ${total} 条，显示 ${from}-${Math.min(showing, total)}</span>
      <button class="page-btn" onclick="changePage(${page-1})" ${page<=1?'disabled':''}>‹</button>
      <span class="page-btn ${page===1?'active':''}" onclick="changePage(1)">1</span>
      ${pages > 1 ? `<span class="page-btn ${page===pages?'active':''}" onclick="changePage(${pages})">${pages}</span>` : ''}
      <button class="page-btn" onclick="changePage(${page+1})" ${page>=pages?'disabled':''}>›</button>
    </div>`;
}

function getChecked(table) {
  return [...table.querySelectorAll('tbody input[type=checkbox]:checked')].map(cb => +cb.value);
}

window.closeModal = closeModal;
window.toast = toast;
window.confirm = confirm;
window.showModal = showModal;
window.fmtDate = fmtDate;
window.taskStatusBadge = taskStatusBadge;
window.userTypeBadge = userTypeBadge;
window.userStatusBadge = userStatusBadge;
window.accountStatusBadge = accountStatusBadge;
window.downloadBlob = downloadBlob;
window.paginationHtml = paginationHtml;
window.getChecked = getChecked;
window.Router = Router;
window.requireAuth = requireAuth;
