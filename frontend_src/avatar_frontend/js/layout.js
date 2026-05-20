/* ============================================================
   侧边栏 + 主布局渲染
   ============================================================ */

let _userInfo = null;
let _isAdmin = false;

async function initLayout() {
  const raw = localStorage.getItem('userInfo');
  if (raw) {
    _userInfo = JSON.parse(raw);
    _isAdmin = _userInfo.user?.user_type === 100;
  } else {
    const res = await API.Auth.getInfo();
    if (!res || !res.success) return;
    _userInfo = res.data;
    _isAdmin = _userInfo.user?.user_type === 100;
    localStorage.setItem('userInfo', JSON.stringify(_userInfo));
  }
  renderLayout();
}

function renderLayout() {
  const u = _userInfo.user || {};
  const initials = (u.nickname || u.username || '?')[0].toUpperCase();

  // 菜单配置（根据角色动态生成）
  const menus = [
    { key: 'dashboard', icon: '📊', label: '首页概览', page: 'dashboard' },
  ];

  if (_isAdmin) {
    menus.push({
      key: 'cloud', icon: '☁️', label: '云控管理', children: [
        { key: 'accounts', label: '账号列表', page: 'accounts' },
        { key: 'projects', label: '项目管理', page: 'projects' },
        { key: 'customers', label: '客户管理', page: 'customers' },
      ]
    });
    menus.push({ key: 'conversations', icon: '💬', label: '对话管理', page: 'conversations' });
    menus.push({ key: 'users', icon: '👥', label: '账号管理', page: 'users' });
  }

  menus.push({ key: 'tasks', icon: '📋', label: '任务管理', page: 'tasks' });
  menus.push({
    key: 'america', icon: '🌎', label: '批量任务', children: [
      { key: 'batch-upload', label: '批量上传', page: 'batch-upload' },
      { key: 'task-list', label: '任务列表', page: 'tasks' },
    ]
  });
  menus.push({
    key: 'stats', icon: '📈', label: '统计分析', children: [
      { key: 'statistics', label: '数据统计', page: 'statistics' },
    ]
  });

  const navHtml = menus.map(m => {
    if (m.children) {
      return `
        <div class="nav-group" data-key="${m.key}">
          <div class="nav-group-header" onclick="toggleGroup('${m.key}')">
            <span style="display:flex;align-items:center;gap:10px;">
              <span>${m.icon}</span><span>${m.label}</span>
            </span>
            <span class="nav-chevron" id="chevron-${m.key}">›</span>
          </div>
          <div class="nav-group-children" id="group-${m.key}">
            ${m.children.map(c => `
              <div class="nav-item" data-page="${c.page}" onclick="navigate('${c.page}')">
                <span>·</span><span>${c.label}</span>
              </div>`).join('')}
          </div>
        </div>`;
    }
    return `<div class="nav-item" data-page="${m.page}" onclick="navigate('${m.page}')">
      <span>${m.icon}</span><span>${m.label}</span>
    </div>`;
  }).join('');

  document.getElementById('app').innerHTML = `
    <div id="sidebar">
      <div class="sidebar-logo">
        <div class="avatar-dot">AV</div>
        <div class="brand">${_userInfo.project_config?.menu_name || '阿凡达'}</div>
        <div class="server">43.162.116.228</div>
      </div>
      <nav class="nav-section">${navHtml}</nav>
      <div class="sidebar-footer">
        <div class="user-card">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="name">${u.nickname || u.username}</div>
            <div class="role">${_isAdmin ? '超级管理员' : '管理员'}</div>
          </div>
          <button class="btn-logout" onclick="doLogout()" title="退出">⏻</button>
        </div>
      </div>
    </div>
    <div id="main">
      <div id="header">
        <div class="page-title" id="page-title">首页概览</div>
        <div class="header-actions" id="header-actions"></div>
      </div>
      <div id="content"></div>
    </div>`;

  setActiveNav(Router.currentPage || 'dashboard');
}

function toggleGroup(key) {
  const el = document.getElementById('group-' + key);
  const ch = document.getElementById('chevron-' + key);
  if (!el) return;
  el.classList.toggle('open');
  ch.classList.toggle('open');
}

function setActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  // auto-expand parent group
  document.querySelectorAll('.nav-group').forEach(grp => {
    const children = grp.querySelectorAll('.nav-item');
    const hasActive = [...children].some(c => c.dataset.page === page);
    if (hasActive) {
      const key = grp.dataset.key;
      const el = document.getElementById('group-' + key);
      const ch = document.getElementById('chevron-' + key);
      if (el && !el.classList.contains('open')) {
        el.classList.add('open'); ch.classList.add('open');
      }
    }
  });
}

function setPageTitle(title) {
  const el = document.getElementById('page-title');
  if (el) el.textContent = title;
}

function navigate(page) {
  Router.navigate(page);
  setActiveNav(page);
}

async function doLogout() {
  await API.Auth.logout().catch(() => {});
  localStorage.removeItem('token');
  localStorage.removeItem('userInfo');
  location.hash = '#/login';
}

window.initLayout = initLayout;
window.navigate = navigate;
window.toggleGroup = toggleGroup;
window.setPageTitle = setPageTitle;
window.doLogout = doLogout;
window._isAdmin = () => _isAdmin;
