/* ============================================================
   布局：侧边栏 + 顶部栏（精简版 4 个菜单项）
   ============================================================ */

const MENU = [
  { key: 'dashboard',  icon: '🏠', label: '首页概览' },
  { key: 'accounts',   icon: '📱', label: '账号管理' },
  { key: 'projects',   icon: '📁', label: '项目管理' },
  { key: 'tasks',      icon: '📋', label: '任务管理' },
  { key: 'chat',       icon: '💬', label: '双向聊天' },
  { key: 'customers',  icon: '👥', label: '客户管理' },
  { key: 'users',      icon: '⚙️', label: '系统用户', adminOnly: true },
];

let _userInfo = null;

async function loadUserInfo() {
  if (_userInfo) return _userInfo;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/prod/system/getInfo', { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json?.success) { _userInfo = json.data; return _userInfo; }
  } catch(e) {}
  return null;
}

function renderLayout(activePage) {
  const info = _userInfo;
  const isAdmin = info?.user?.user_type === 100 || info?.roles?.includes('superAdmin');
  const nickname = info?.user?.nickname || info?.user?.username || 'Admin';
  const projectName = info?.project_config?.menu_name || '阿凡达';

  const menuHtml = MENU
    .filter(m => !m.adminOnly || isAdmin)
    .map(m => `
      <div class="nav-item ${activePage === m.key ? 'active' : ''}" onclick="navigate('${m.key}')">
        <span class="nav-icon">${m.icon}</span>
        <span class="nav-label">${m.label}</span>
      </div>`).join('');

  document.getElementById('app').innerHTML = `
    <div class="layout">
      <!-- 侧边栏 -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <span style="font-size:22px;">🛸</span>
          <span class="sidebar-title">${projectName}</span>
        </div>
        <nav class="sidebar-nav">${menuHtml}</nav>
        <div class="sidebar-footer">
          <div class="user-info">
            <div class="user-avatar">${nickname.charAt(0).toUpperCase()}</div>
            <div class="user-detail">
              <div class="user-name">${nickname}</div>
              <div class="user-role">${isAdmin ? '超级管理员' : '普通账户'}</div>
            </div>
          </div>
          <button class="btn-logout" onclick="doLogout()" title="退出登录">⏻</button>
        </div>
      </aside>

      <!-- 主内容 -->
      <div class="main-wrap">
        <header class="topbar">
          <div class="topbar-left">
            <button class="sidebar-toggle" onclick="toggleSidebar()">☰</button>
            <span class="page-title" id="page-title">首页概览</span>
          </div>
          <div class="topbar-right" id="header-actions"></div>
        </header>
        <main class="content-area" id="content"></main>
      </div>
    </div>`;
}

function setPageTitle(t) {
  const el = document.getElementById('page-title');
  if (el) el.textContent = t;
}

function navigate(page) {
  Router.navigate(page);
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('collapsed');
}

function updateBatchBtn(tableId, btnId) {
  const table = document.getElementById(tableId);
  const btn = document.getElementById(btnId);
  if (!table || !btn) return;
  const checked = table.querySelectorAll('tbody input[type=checkbox]:checked').length;
  btn.disabled = checked === 0;
}

function toggleAllCheck(masterCb, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  table.querySelectorAll('tbody input[type=checkbox]').forEach(cb => {
    cb.checked = masterCb.checked;
    cb.dispatchEvent(new Event('change'));
  });
}

async function doLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userInfo');
  _userInfo = null;
  toast('已退出登录', 'info');
  setTimeout(() => { location.hash = '#/login'; }, 500);
}

window.navigate = navigate;
window.setPageTitle = setPageTitle;
window.toggleSidebar = toggleSidebar;
window.updateBatchBtn = updateBatchBtn;
window.toggleAllCheck = toggleAllCheck;
window.doLogout = doLogout;
window.renderLayout = renderLayout;
window.loadUserInfo = loadUserInfo;
