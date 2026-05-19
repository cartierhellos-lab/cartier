/* ============================================================
   路由初始化 & 应用入口
   ============================================================ */

(function main() {
  // 路由注册
  Router.register('login', () => {
    document.title = '登录 - 阿凡达';
    renderLogin();
  });

  const authed = (fn, title) => async () => {
    if (!requireAuth()) return;
    document.title = `${title} - 阿凡达`;
    await initLayout();
    fn();
  };

  Router.register('dashboard',    authed(renderDashboard,    '首页概览'));
  Router.register('accounts',     authed(renderAccounts,     '账号列表'));
  Router.register('projects',     authed(renderProjects,     '项目管理'));
  Router.register('customers',    authed(renderCustomers,    '客户管理'));
  Router.register('tasks',        authed(renderTasks,        '任务管理'));
  Router.register('batch-upload', authed(renderBatchUpload,  '批量上传'));
  Router.register('statistics',   authed(renderStatistics,   '数据统计'));
  Router.register('users',        authed(renderUsers,        '账号管理'));
  Router.register('conversations',authed(renderConversations,'对话管理'));

  Router.register('404', () => {
    document.getElementById('app').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;color:var(--text-muted);">
        <div style="font-size:64px;">🔍</div>
        <div style="font-size:20px;color:var(--text-primary);">页面不存在</div>
        <button class="btn btn-primary" onclick="navigate('dashboard')">返回首页</button>
      </div>`;
  });

  Router.init();
})();
