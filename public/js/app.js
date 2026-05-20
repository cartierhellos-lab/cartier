/* ============================================================
   App 入口：路由注册 + 启动
   ============================================================ */

async function initApp() {
  // 注册路由
  Router.register('login',     () => renderLogin());
  Router.register('dashboard', async () => { if (!requireAuth()) return; await loadUserInfo(); renderLayout('dashboard'); renderDashboard(); });
  Router.register('accounts',  async () => { if (!requireAuth()) return; await loadUserInfo(); renderLayout('accounts');  renderAccounts(); });
  Router.register('projects',  async () => { if (!requireAuth()) return; await loadUserInfo(); renderLayout('projects');  renderProjects(); });
  Router.register('tasks',     async () => { if (!requireAuth()) return; await loadUserInfo(); renderLayout('tasks');     renderTasks(); });
  Router.register('customers', async () => { if (!requireAuth()) return; await loadUserInfo(); renderLayout('customers'); renderCustomers(); });
  Router.register('users',     async () => { if (!requireAuth()) return; await loadUserInfo(); renderLayout('users');     renderUsers(); });
  Router.register('chat',      async () => { if (!requireAuth()) return; await loadUserInfo(); renderLayout('chat');      renderChat(); });
  Router.register('404',       () => { document.getElementById('app').innerHTML = `<div style="text-align:center;padding:80px;color:#888"><div style="font-size:64px">🔍</div><p>页面不存在</p><button class="btn btn-primary" onclick="navigate('dashboard')">返回首页</button></div>`; });

  Router.init();
}

// 启动
initApp();
