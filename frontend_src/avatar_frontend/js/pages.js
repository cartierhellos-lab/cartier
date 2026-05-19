/* ============================================================
   所有页面渲染：登录、首页、账号、项目、客户、任务、统计、用户管理
   ============================================================ */

// ============================================================
// 登录页
// ============================================================
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div id="login-page">
      <div class="login-box">
        <div class="login-logo">
          <div style="font-size:40px;margin-bottom:8px;">🛸</div>
          <h1>阿凡达管理系统</h1>
          <p>Avatar SMS Management Platform</p>
        </div>
        <div class="login-card">
          <h2>登录账户</h2>
          <div class="form-group">
            <label class="form-label required">用户名</label>
            <input id="login-user" type="text" placeholder="请输入用户名" value="admin" onkeydown="if(event.key==='Enter')doLogin()"/>
          </div>
          <div class="form-group">
            <label class="form-label required">密码</label>
            <input id="login-pass" type="password" placeholder="请输入密码" onkeydown="if(event.key==='Enter')doLogin()"/>
          </div>
          <button class="btn btn-primary" id="login-btn" style="width:100%;justify-content:center;padding:10px;" onclick="doLogin()">
            登录
          </button>
        </div>
        <div class="login-footer">阿凡达 SMS 平台 · 内部系统</div>
      </div>
    </div>`;
}

async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  if (!u || !p) { toast('请填写用户名和密码', 'error'); return; }
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 登录中...';
  try {
    const res = await API.Auth.login(u, p);
    if (res?.success) {
      localStorage.setItem('token', res.data.token);
      localStorage.removeItem('userInfo');
      toast('登录成功', 'success');
      location.hash = '#/dashboard';
    } else {
      toast(res?.message || '用户名或密码错误', 'error');
      btn.disabled = false; btn.innerHTML = '登录';
    }
  } catch (e) {
    toast('网络错误，请检查连接', 'error');
    btn.disabled = false; btn.innerHTML = '登录';
  }
}

// ============================================================
// 首页概览
// ============================================================
async function renderDashboard() {
  setPageTitle('首页概览');
  document.getElementById('content').innerHTML = `
    <div class="stat-grid" id="stat-grid">
      ${[1,2,3,4].map(()=>`<div class="stat-card"><div style="height:60px;background:var(--bg-hover);border-radius:6px;animation:pulse 1.5s infinite;"></div></div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="card" id="recent-tasks-card">
        <div class="card-header"><span class="card-title">最近任务</span><button class="btn btn-sm btn-secondary" onclick="navigate('tasks')">查看全部</button></div>
        <div id="recent-tasks"><div class="loading-row"><td colspan="5">加载中...</td></div></div>
      </div>
      <div class="card" id="system-status-card">
        <div class="card-header"><span class="card-title">系统状态</span></div>
        <div class="card-body" id="sys-status">加载中...</div>
      </div>
    </div>`;

  // 加载概览数据
  const [ovRes, taskRes] = await Promise.all([
    API.Stats.overview().catch(() => null),
    API.Tasks.list({ page: 1, pageSize: 5 }).catch(() => null),
  ]);

  if (ovRes?.success) {
    const d = ovRes.data;
    document.getElementById('stat-grid').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">📋</div>
        <div class="stat-label">总任务数</div>
        <div class="stat-value">${d.tasks?.total ?? 0}</div>
        <div class="stat-sub">运行中 ${d.tasks?.running ?? 0} · 已完成 ${d.tasks?.done ?? 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">📨</div>
        <div class="stat-label">总发送量</div>
        <div class="stat-value">${(d.sends?.total ?? 0).toLocaleString()}</div>
        <div class="stat-sub">成功率 ${d.sends?.rate ?? 0}%</div>
      </div>
      ${d.users ? `
      <div class="stat-card">
        <div class="stat-icon orange">👥</div>
        <div class="stat-label">系统用户</div>
        <div class="stat-value">${d.users.total ?? 0}</div>
        <div class="stat-sub">活跃 ${d.users.active ?? 0}</div>
      </div>` : ''}
      <div class="stat-card">
        <div class="stat-icon blue">🗂️</div>
        <div class="stat-label">项目总数</div>
        <div class="stat-value">${d.projects?.total ?? 0}</div>
        <div class="stat-sub">活跃项目</div>
      </div>`;
  }

  if (taskRes?.success) {
    const items = taskRes.data?.items || [];
    document.getElementById('recent-tasks').innerHTML = items.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>任务名</th><th>状态</th><th>发送量</th><th>创建时间</th></tr></thead>
          <tbody>${items.map(t => `
            <tr>
              <td>${t.task_name || '-'}</td>
              <td>${taskStatusBadge(t.status)}</td>
              <td>${t.total_count || 0}</td>
              <td>${fmtDate(t.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `<div class="empty-state"><div class="emoji">📭</div><p>暂无任务</p></div>`;
  }

  document.getElementById('sys-status').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div class="flex-between"><span class="text-muted">后端服务</span><span class="badge badge-success">正常</span></div>
      <div class="flex-between"><span class="text-muted">Redis 缓存</span><span class="badge badge-success">已启用</span></div>
      <div class="flex-between"><span class="text-muted">数据库</span><span class="badge badge-success">连接正常</span></div>
      <div class="flex-between"><span class="text-muted">PHP 版本</span><span class="text-muted">8.3.6</span></div>
      <div class="flex-between"><span class="text-muted">服务器</span><span class="text-muted">43.162.116.228</span></div>
    </div>`;
}

// ============================================================
// 账号列表（云控 PhoneInfo）
// ============================================================
let accountPage = 1, accountFilter = {};
async function renderAccounts() {
  setPageTitle('账号列表');
  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="exportAccounts()">📥 导出</button>
    <button class="btn btn-danger btn-sm" id="batch-del-acc" onclick="batchDeleteAccounts()" disabled>批量删除</button>
    <button class="btn btn-primary btn-sm" onclick="showAccountForm()">+ 添加账号</button>`;

  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <input id="acc-filter-phone" placeholder="手机号搜索" style="max-width:160px;" value="${accountFilter.phone||''}"/>
        <select id="acc-filter-status" style="max-width:120px;">
          <option value="">全部状态</option>
          <option value="1" ${accountFilter.status=='1'?'selected':''}>正常</option>
          <option value="0" ${accountFilter.status=='0'?'selected':''}>禁用</option>
          <option value="2" ${accountFilter.status=='2'?'selected':''}>风险</option>
        </select>
        <button class="btn btn-secondary btn-sm" onclick="searchAccounts()">🔍 搜索</button>
        <button class="btn btn-secondary btn-sm" onclick="resetAccountFilter()">重置</button>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" onclick="batchToggleAccStatus(1)">批量启用</button>
        <button class="btn btn-secondary btn-sm" onclick="batchToggleAccStatus(0)">批量禁用</button>
      </div>
      <div class="table-wrap">
        <table id="acc-table">
          <thead>
            <tr>
              <th class="table-check"><input type="checkbox" onchange="toggleAllCheck(this,'acc-table')"/></th>
              <th>ID</th><th>手机号</th><th>项目</th><th>状态</th><th>创建时间</th><th>操作</th>
            </tr>
          </thead>
          <tbody id="acc-tbody"><tr class="loading-row"><td colspan="7">加载中...</td></tr></tbody>
        </table>
      </div>
      <div id="acc-pagination"></div>
    </div>`;

  await loadAccounts();
}

async function loadAccounts() {
  const res = await API.Accounts.list({ page: accountPage, pageSize: 20, ...accountFilter });
  const items = res?.data?.items || [];
  const total = res?.data?.total || 0;

  document.getElementById('acc-tbody').innerHTML = items.length ? items.map(a => `
    <tr>
      <td><input type="checkbox" value="${a.id}" onchange="updateBatchBtn('acc-table','batch-del-acc')"/></td>
      <td>${a.id}</td>
      <td style="font-family:monospace;">${a.system_phonenumber || a.phone || '-'}</td>
      <td>${a.project_key || '-'}</td>
      <td>${accountStatusBadge(a.status)}</td>
      <td>${fmtDate(a.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editAccount(${JSON.stringify(a).replace(/"/g,'&quot;')})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAccount(${a.id})">删除</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);">暂无数据</td></tr>`;

  document.getElementById('acc-pagination').innerHTML = paginationHtml(accountPage, total, 20);
  window.changePage = (p) => { if(p<1||p>Math.ceil(total/20))return; accountPage=p; loadAccounts(); };
}

function searchAccounts() {
  accountPage = 1;
  accountFilter = {
    system_phonenumber: document.getElementById('acc-filter-phone').value.trim() || undefined,
    status: document.getElementById('acc-filter-status').value || undefined,
  };
  loadAccounts();
}
function resetAccountFilter() { accountFilter = {}; accountPage = 1; renderAccounts(); }

function showAccountForm(acc = null) {
  const html = `
    <div class="form-group"><label class="form-label required">手机号</label>
      <input id="af-phone" value="${acc?.system_phonenumber||acc?.phone||''}"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">项目KEY</label>
        <input id="af-project" value="${acc?.project_key||''}"/></div>
      <div class="form-group"><label class="form-label">状态</label>
        <select id="af-status">
          <option value="1" ${acc?.status==1?'selected':''}>正常</option>
          <option value="0" ${acc?.status==0?'selected':''}>禁用</option>
        </select></div>
    </div>`;
  showModal(acc ? '编辑账号' : '添加账号', html, async (mid) => {
    const data = {
      system_phonenumber: document.getElementById('af-phone').value.trim(),
      project_key: document.getElementById('af-project').value.trim() || undefined,
      status: +document.getElementById('af-status').value,
    };
    if (acc?.id) data.id = acc.id;
    if (!data.system_phonenumber) { toast('手机号不能为空', 'error'); return; }
    const res = await API.Accounts.save(data);
    if (res?.success) { toast('保存成功', 'success'); closeModal(mid); loadAccounts(); }
    else toast(res?.message || '保存失败', 'error');
  });
}

function editAccount(a) { showAccountForm(a); }
async function deleteAccount(id) {
  if (!await confirm('此操作将永久删除该账号，是否继续？')) return;
  const res = await API.Accounts.delete([id]);
  if (res?.success) { toast('删除成功', 'success'); loadAccounts(); }
  else toast('删除失败', 'error');
}
async function batchDeleteAccounts() {
  const ids = getChecked(document.getElementById('acc-table'));
  if (!ids.length) return;
  if (!await confirm(`确认删除选中的 ${ids.length} 条账号？`)) return;
  const res = await API.Accounts.delete(ids);
  if (res?.success) { toast('批量删除成功', 'success'); loadAccounts(); }
}
async function batchToggleAccStatus(status) {
  const ids = getChecked(document.getElementById('acc-table'));
  if (!ids.length) { toast('请先选择账号', 'error'); return; }
  const res = await API.Accounts.updateStatus(ids, status);
  if (res?.success) { toast(status ? '批量启用成功' : '批量禁用成功', 'success'); loadAccounts(); }
}
async function exportAccounts() {
  const blob = await API.Accounts.export();
  downloadBlob(blob, `accounts_${Date.now()}.json`);
}

// ============================================================
// 项目管理
// ============================================================
let projPage = 1;
async function renderProjects() {
  setPageTitle('项目管理');
  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-primary btn-sm" onclick="showProjectForm()">+ 新建项目</button>`;

  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <input id="proj-name" placeholder="项目名搜索" style="max-width:180px;"/>
        <button class="btn btn-secondary btn-sm" onclick="loadProjects()">🔍 搜索</button>
        <div class="spacer"></div>
      </div>
      <div class="table-wrap">
        <table><thead>
          <tr><th>ID</th><th>项目名称</th><th>项目KEY</th><th>账号类型</th><th>类型</th><th>最大发送</th><th>间隔(秒)</th><th>创建时间</th><th>操作</th></tr>
        </thead><tbody id="proj-tbody"><tr class="loading-row"><td colspan="9">加载中...</td></tr></tbody></table>
      </div>
      <div id="proj-pagination"></div>
    </div>`;
  await loadProjects();
}

async function loadProjects() {
  const res = await API.Projects.list({ page: projPage, pageSize: 20, project_name: document.getElementById('proj-name')?.value.trim() || undefined });
  const items = res?.data?.items || [];
  const total = res?.data?.total || 0;
  document.getElementById('proj-tbody').innerHTML = items.length ? items.map(p => `
    <tr>
      <td>${p.id}</td>
      <td style="font-weight:500;">${p.project_name}</td>
      <td><code style="background:var(--bg-hover);padding:2px 6px;border-radius:4px;font-size:12px;">${p.project_key||'-'}</code></td>
      <td>${p.account_type||'-'}</td>
      <td>${p.project_type||'-'}</td>
      <td>${p.max_send_count||'-'}</td>
      <td>${p.send_interval||'-'}</td>
      <td>${fmtDate(p.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editProject(${JSON.stringify(p).replace(/"/g,'&quot;')})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProject(${p.id})">删除</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">暂无项目</td></tr>`;
  document.getElementById('proj-pagination').innerHTML = paginationHtml(projPage, total, 20);
  window.changePage = (p) => { if(p<1||p>Math.ceil(total/20))return; projPage=p; loadProjects(); };
}

function showProjectForm(proj = null) {
  const html = `
    <div class="form-row">
      <div class="form-group"><label class="form-label required">项目名称</label><input id="pf-name" value="${proj?.project_name||''}"/></div>
      <div class="form-group"><label class="form-label required">项目标识</label><input id="pf-key" placeholder="如: america" value="${proj?.project_key||''}"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">账号类型</label>
        <select id="pf-acctype">
          <option value="tn" ${proj?.account_type=='tn'?'selected':''}>TextNow (tn)</option>
          <option value="tw" ${proj?.account_type=='tw'?'selected':''}>TextWeb (tw)</option>
          <option value="other" ${proj?.account_type=='other'?'selected':''}>其他</option>
        </select></div>
      <div class="form-group"><label class="form-label">项目类型</label>
        <select id="pf-projtype">
          <option value="1" ${proj?.project_type==1?'selected':''}>类型 1</option>
          <option value="2" ${proj?.project_type==2?'selected':''}>类型 2</option>
          <option value="3" ${proj?.project_type==3?'selected':''}>类型 3</option>
        </select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">最大发送数</label><input id="pf-max" type="number" value="${proj?.max_send_count||''}"/></div>
      <div class="form-group"><label class="form-label">发送间隔(秒)</label><input id="pf-interval" type="number" value="${proj?.send_interval||'300'}"/></div>
    </div>`;
  showModal(proj ? '编辑项目' : '新建项目', html, async (mid) => {
    const data = {
      project_name: document.getElementById('pf-name').value.trim(),
      project_key: document.getElementById('pf-key').value.trim(),
      account_type: document.getElementById('pf-acctype').value,
      project_type: +document.getElementById('pf-projtype').value,
      max_send_count: +document.getElementById('pf-max').value || undefined,
      send_interval: +document.getElementById('pf-interval').value || 300,
    };
    if (proj?.id) data.id = proj.id;
    if (!data.project_name || !data.project_key) { toast('项目名称和标识不能为空', 'error'); return; }
    const res = await API.Projects.save(data);
    if (res?.success) { toast('保存成功', 'success'); closeModal(mid); loadProjects(); }
    else toast(res?.message || '保存失败', 'error');
  });
}
function editProject(p) { showProjectForm(p); }
async function deleteProject(id) {
  if (!await confirm('确认删除该项目？')) return;
  const res = await API.Projects.delete([id]);
  if (res?.success) { toast('删除成功', 'success'); loadProjects(); }
}

// ============================================================
// 客户管理
// ============================================================
let custPage = 1;
async function renderCustomers() {
  setPageTitle('客户管理');
  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-danger btn-sm" id="batch-del-cust" onclick="batchDeleteCustomers()" disabled>批量删除</button>
    <button class="btn btn-secondary btn-sm" onclick="batchChangeCustomerStatus(1)">批量启用</button>
    <button class="btn btn-secondary btn-sm" onclick="batchChangeCustomerStatus(0)">批量禁用</button>`;

  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <input id="cust-phone" placeholder="手机号搜索" style="max-width:160px;"/>
        <select id="cust-status" style="max-width:120px;">
          <option value="">全部状态</option>
          <option value="1">正常</option>
          <option value="0">禁用</option>
        </select>
        <button class="btn btn-secondary btn-sm" onclick="loadCustomers()">🔍 搜索</button>
        <div class="spacer"></div>
      </div>
      <div class="table-wrap">
        <table id="cust-table">
          <thead><tr>
            <th class="table-check"><input type="checkbox" onchange="toggleAllCheck(this,'cust-table')"/></th>
            <th>ID</th><th>手机号</th><th>项目</th><th>状态</th><th>创建时间</th><th>操作</th>
          </tr></thead>
          <tbody id="cust-tbody"><tr class="loading-row"><td colspan="7">加载中...</td></tr></tbody>
        </table>
      </div>
      <div id="cust-pagination"></div>
    </div>`;
  await loadCustomers();
}

async function loadCustomers() {
  const res = await API.Customers.list({
    page: custPage, pageSize: 20,
    system_phonenumber: document.getElementById('cust-phone')?.value.trim() || undefined,
    status: document.getElementById('cust-status')?.value || undefined,
  });
  const items = res?.data?.items || [];
  const total = res?.data?.total || 0;
  document.getElementById('cust-tbody').innerHTML = items.length ? items.map(c => `
    <tr>
      <td><input type="checkbox" value="${c.id}" onchange="updateBatchBtn('cust-table','batch-del-cust')"/></td>
      <td>${c.id}</td>
      <td>${c.system_phonenumber||c.phone||'-'}</td>
      <td>${c.project_key||'-'}</td>
      <td>${accountStatusBadge(c.status)}</td>
      <td>${fmtDate(c.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})">删除</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);">暂无数据</td></tr>`;
  document.getElementById('cust-pagination').innerHTML = paginationHtml(custPage, total, 20);
  window.changePage = (p) => { if(p<1||p>Math.ceil(total/20))return; custPage=p; loadCustomers(); };
}
async function deleteCustomer(id) {
  if (!await confirm('确认删除该客户？')) return;
  const res = await API.Customers.delete([id]);
  if (res?.success) { toast('删除成功', 'success'); loadCustomers(); }
}
async function batchDeleteCustomers() {
  const ids = getChecked(document.getElementById('cust-table'));
  if (!ids.length) return;
  if (!await confirm(`删除选中 ${ids.length} 条客户？`)) return;
  const res = await API.Customers.delete(ids);
  if (res?.success) { toast('批量删除成功', 'success'); loadCustomers(); }
}
async function batchChangeCustomerStatus(status) {
  const ids = getChecked(document.getElementById('cust-table'));
  if (!ids.length) { toast('请先选择', 'error'); return; }
  const res = await API.Customers.batchChangeStatus({ ids, status });
  if (res?.success) { toast(status?'批量启用成功':'批量禁用成功', 'success'); loadCustomers(); }
}

// ============================================================
// 任务管理
// ============================================================
let taskPage = 1, taskFilter = {};
async function renderTasks() {
  setPageTitle('任务管理');
  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="exportTasks()">📥 导出CSV</button>
    <button class="btn btn-danger btn-sm" onclick="clearAllTasks()">🗑 批量清除</button>
    <button class="btn btn-primary btn-sm" onclick="showTaskForm()">+ 创建任务</button>`;

  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <input id="task-name-filter" placeholder="任务名搜索" style="max-width:180px;" value="${taskFilter.task_name||''}"/>
        <select id="task-status-filter" style="max-width:130px;">
          <option value="">全部状态</option>
          <option value="0" ${taskFilter.status==0?'selected':''}>待启动</option>
          <option value="1" ${taskFilter.status==1?'selected':''}>运行中</option>
          <option value="2" ${taskFilter.status==2?'selected':''}>已完成</option>
          <option value="3" ${taskFilter.status==3?'selected':''}>已暂停</option>
          <option value="4" ${taskFilter.status==4?'selected':''}>失败</option>
        </select>
        <button class="btn btn-secondary btn-sm" onclick="searchTasks()">🔍 搜索</button>
        <button class="btn btn-secondary btn-sm" onclick="resetTaskFilter()">重置</button>
        <div class="spacer"></div>
        <button class="btn btn-success btn-sm" onclick="batchStartTasks()">批量启动</button>
        <button class="btn btn-secondary btn-sm" onclick="batchStopTasks()">批量暂停</button>
      </div>
      <div class="table-wrap">
        <table id="task-table">
          <thead><tr>
            <th class="table-check"><input type="checkbox" onchange="toggleAllCheck(this,'task-table')"/></th>
            <th>ID</th><th>任务名称</th><th>关联项目</th><th>发送量</th><th>成功量</th><th>状态</th><th>创建时间</th><th>操作</th>
          </tr></thead>
          <tbody id="task-tbody"><tr class="loading-row"><td colspan="9">加载中...</td></tr></tbody>
        </table>
      </div>
      <div id="task-pagination"></div>
    </div>`;
  await loadTasks();
}

async function loadTasks() {
  const res = await API.Tasks.list({ page: taskPage, pageSize: 20, ...taskFilter });
  const items = res?.data?.items || [];
  const total = res?.data?.total || 0;

  document.getElementById('task-tbody').innerHTML = items.length ? items.map(t => `
    <tr>
      <td><input type="checkbox" value="${t.id}"/></td>
      <td>${t.id}</td>
      <td style="font-weight:500;">${t.task_name || '-'}</td>
      <td>${t.project_key || t.project_id || '-'}</td>
      <td>${(t.total_count||0).toLocaleString()}</td>
      <td>${(t.success_count||0).toLocaleString()}</td>
      <td>${taskStatusBadge(t.status)}</td>
      <td>${fmtDate(t.created_at)}</td>
      <td style="white-space:nowrap;">
        ${t.status===0||t.status===3 ? `<button class="btn btn-sm btn-success" onclick="doTaskAction('start',${t.id})">启动</button>` : ''}
        ${t.status===1 ? `<button class="btn btn-sm btn-secondary" onclick="doTaskAction('stop',${t.id})">暂停</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="doDeleteTask(${t.id})">删除</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">暂无任务</td></tr>`;

  document.getElementById('task-pagination').innerHTML = paginationHtml(taskPage, total, 20);
  window.changePage = (p) => { if(p<1||p>Math.ceil(total/20))return; taskPage=p; loadTasks(); };
}

function searchTasks() {
  taskPage = 1;
  taskFilter = {
    task_name: document.getElementById('task-name-filter').value.trim() || undefined,
    status: document.getElementById('task-status-filter').value !== '' ? +document.getElementById('task-status-filter').value : undefined,
  };
  loadTasks();
}
function resetTaskFilter() { taskFilter = {}; taskPage = 1; renderTasks(); }

function showTaskForm() {
  const html = `
    <div class="form-group"><label class="form-label required">任务名称</label><input id="tf-name" placeholder="请输入任务名称"/></div>
    <div class="form-group"><label class="form-label">项目KEY</label><input id="tf-key" placeholder="如: america"/></div>
    <div class="form-group"><label class="form-label">发送内容</label>
      <textarea id="tf-content" rows="4" placeholder="发送内容（可选）" style="resize:vertical;"></textarea></div>`;
  showModal('创建任务', html, async (mid) => {
    const data = {
      task_name: document.getElementById('tf-name').value.trim(),
      project_key: document.getElementById('tf-key').value.trim() || undefined,
      content: document.getElementById('tf-content').value.trim() || undefined,
    };
    if (!data.task_name) { toast('任务名称不能为空', 'error'); return; }
    const res = await API.Tasks.save(data);
    if (res?.success) { toast('任务已创建', 'success'); closeModal(mid); loadTasks(); }
    else toast(res?.message || '创建失败', 'error');
  });
}

async function doTaskAction(action, id) {
  const fn = action === 'start' ? API.Tasks.start : API.Tasks.stop;
  const res = await fn([id]);
  if (res?.success) { toast(action==='start'?'已启动':'已暂停', 'success'); loadTasks(); }
  else toast(res?.message || '操作失败', 'error');
}

async function doDeleteTask(id) {
  if (!await confirm('确认删除该任务？此操作不可恢复。', '删除任务')) return;
  const res = await API.Tasks.delete([id]);
  if (res?.success) { toast('删除成功', 'success'); loadTasks(); }
  else toast('删除失败', 'error');
}

async function batchStartTasks() {
  const ids = getChecked(document.getElementById('task-table'));
  if (!ids.length) { toast('请先选择任务', 'error'); return; }
  const res = await API.Tasks.start(ids);
  if (res?.success) { toast('批量启动成功', 'success'); loadTasks(); }
}
async function batchStopTasks() {
  const ids = getChecked(document.getElementById('task-table'));
  if (!ids.length) { toast('请先选择任务', 'error'); return; }
  const res = await API.Tasks.stop(ids);
  if (res?.success) { toast('批量暂停成功', 'success'); loadTasks(); }
}
async function clearAllTasks() {
  const html = `
    <div class="form-group"><label class="form-label">按状态清除（不选则清除全部）</label>
      <select id="clear-status">
        <option value="">全部</option>
        <option value="0">待启动</option>
        <option value="2">已完成</option>
        <option value="3">已暂停</option>
        <option value="4">失败</option>
      </select></div>`;
  showModal('批量清除任务', html, async (mid) => {
    const status = document.getElementById('clear-status').value;
    const params = status !== '' ? { status: +status } : null;
    const res = await API.Tasks.clearAll(params);
    if (res?.success) {
      toast(res.message || '清除成功', 'success');
      closeModal(mid); loadTasks();
    } else toast(res?.message || '清除失败', 'error');
  }, { okText: '确认清除' });
}
async function exportTasks() {
  const blob = await API.Tasks.export();
  downloadBlob(blob, `tasks_${Date.now()}.csv`);
}

// ============================================================
// 批量上传
// ============================================================
async function renderBatchUpload() {
  setPageTitle('批量上传');
  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="exportBatch()">📥 导出CSV</button>
    <button class="btn btn-danger btn-sm" onclick="clearBatchAll()">🗑 清除记录</button>`;

  document.getElementById('content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:16px;">
      <div class="card">
        <div class="card-header"><span class="card-title">上传文件</span></div>
        <div class="card-body">
          <div class="upload-area" id="upload-drop" onclick="document.getElementById('upload-file').click()"
            ondragover="event.preventDefault();this.classList.add('drag-over')"
            ondragleave="this.classList.remove('drag-over')"
            ondrop="handleFileDrop(event)">
            <div class="upload-icon">📂</div>
            <p>点击或拖拽文件到此处</p>
            <p style="margin-top:4px;font-size:11px;">支持 CSV、TXT、Excel 格式</p>
          </div>
          <input type="file" id="upload-file" class="hidden" accept=".csv,.txt,.xlsx" onchange="handleFileSelect(this)"/>
          <div id="upload-status" style="margin-top:12px;"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">上传说明</span></div>
        <div class="card-body">
          <ul style="color:var(--text-secondary);font-size:13px;line-height:1.8;padding-left:18px;">
            <li>文件格式：每行一个手机号，或 CSV 格式</li>
            <li>编码格式：UTF-8（推荐）</li>
            <li>上传后数据将与项目号码关联</li>
            <li>重复号码将自动跳过</li>
          </ul>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">上传记录</span></div>
      <div class="table-wrap">
        <table id="batch-table">
          <thead><tr>
            <th class="table-check"><input type="checkbox" onchange="toggleAllCheck(this,'batch-table')"/></th>
            <th>ID</th><th>任务名称</th><th>项目</th><th>发送量</th><th>状态</th><th>创建时间</th><th>操作</th>
          </tr></thead>
          <tbody id="batch-tbody"><tr class="loading-row"><td colspan="8">加载中...</td></tr></tbody>
        </table>
      </div>
      <div id="batch-pagination"></div>
    </div>`;
  await loadBatchList();
}

let batchPage = 1;
async function loadBatchList() {
  const res = await API.Tasks.list({ page: batchPage, pageSize: 20 });
  const items = res?.data?.items || [];
  const total = res?.data?.total || 0;
  document.getElementById('batch-tbody').innerHTML = items.length ? items.map(t => `
    <tr>
      <td><input type="checkbox" value="${t.id}"/></td>
      <td>${t.id}</td>
      <td>${t.task_name||'-'}</td>
      <td>${t.project_key||'-'}</td>
      <td>${(t.total_count||0).toLocaleString()}</td>
      <td>${taskStatusBadge(t.status)}</td>
      <td>${fmtDate(t.created_at)}</td>
      <td><button class="btn btn-sm btn-danger" onclick="doDeleteTask(${t.id})">删除</button></td>
    </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">暂无记录</td></tr>`;
  document.getElementById('batch-pagination').innerHTML = paginationHtml(batchPage, total, 20);
  window.changePage = (p) => { if(p<1||p>Math.ceil(total/20))return; batchPage=p; loadBatchList(); };
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  doUploadFile(file);
}
function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('upload-drop').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  doUploadFile(file);
}
async function doUploadFile(file) {
  document.getElementById('upload-status').innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);">
    <span class="spinner"></span> 上传中：${file.name}</div>`;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await API.BatchTask.upload(fd);
    if (res?.success) {
      document.getElementById('upload-status').innerHTML = `<div class="badge badge-success" style="font-size:13px;padding:6px 12px;">✅ 上传成功：${file.name}</div>`;
      toast('文件上传成功', 'success');
      loadBatchList();
    } else {
      document.getElementById('upload-status').innerHTML = `<div class="badge badge-danger">❌ ${res?.message||'上传失败'}</div>`;
      toast(res?.message || '上传失败', 'error');
    }
  } catch(e) {
    document.getElementById('upload-status').innerHTML = `<div class="badge badge-danger">❌ 网络错误</div>`;
    toast('上传失败，请检查网络', 'error');
  }
}
async function exportBatch() { exportTasks(); }
async function clearBatchAll() { clearAllTasks(); }

// ============================================================
// 数据统计
// ============================================================
async function renderStatistics() {
  setPageTitle('数据统计');
  document.getElementById('header-actions').innerHTML = '';
  document.getElementById('content').innerHTML = `<div id="stats-content"><div style="text-align:center;padding:40px;color:var(--text-muted);">加载中...</div></div>`;

  const [ovRes, taskRes] = await Promise.all([
    API.Stats.overview().catch(()=>null),
    API.Tasks.list({ page: 1, pageSize: 100 }).catch(()=>null),
  ]);

  const d = ovRes?.data || {};
  const tasks = taskRes?.data?.items || [];

  const statusCount = [0,1,2,3,4].map(s => ({ label:['待启动','运行中','已完成','已暂停','失败'][s], count: tasks.filter(t=>t.status===s).length }));

  document.getElementById('stats-content').innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);">
      <div class="stat-card"><div class="stat-label">总任务</div><div class="stat-value">${d.tasks?.total||0}</div></div>
      <div class="stat-card"><div class="stat-label">总发送</div><div class="stat-value">${(d.sends?.total||0).toLocaleString()}</div></div>
      <div class="stat-card"><div class="stat-label">成功量</div><div class="stat-value">${(d.sends?.success||0).toLocaleString()}</div></div>
      <div class="stat-card"><div class="stat-label">成功率</div><div class="stat-value">${d.sends?.rate||0}%</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="card">
        <div class="card-header"><span class="card-title">任务状态分布</span></div>
        <div class="card-body">
          ${statusCount.map(s => `
            <div style="margin-bottom:14px;">
              <div class="flex-between mb-1"><span style="font-size:13px;">${s.label}</span><span style="font-size:13px;font-weight:600;">${s.count}</span></div>
              <div class="progress-bar"><div class="fill" style="width:${tasks.length?Math.round(s.count/tasks.length*100):0}%"></div></div>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">发送效率</span></div>
        <div class="card-body">
          <div style="text-align:center;padding:20px 0;">
            <div style="font-size:48px;font-weight:700;color:var(--accent);">${d.sends?.rate||0}%</div>
            <div style="color:var(--text-muted);margin-top:8px;">整体成功率</div>
          </div>
          <div class="progress-bar" style="height:10px;margin-top:16px;">
            <div class="fill" style="width:${d.sends?.rate||0}%;background:${(d.sends?.rate||0)>80?'var(--success)':'var(--warning)'}"></div>
          </div>
          <div class="flex-between mt-2">
            <span class="text-muted" style="font-size:12px;">成功 ${(d.sends?.success||0).toLocaleString()}</span>
            <span class="text-muted" style="font-size:12px;">总计 ${(d.sends?.total||0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>`;
}

// ============================================================
// 用户管理（账号管理）
// ============================================================
let userPage = 1;
async function renderUsers() {
  setPageTitle('账号管理');
  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-danger btn-sm" id="batch-del-usr" onclick="batchDeleteUsers()" disabled>批量删除</button>
    <button class="btn btn-secondary btn-sm" onclick="batchToggleUsers(1)">批量启用</button>
    <button class="btn btn-secondary btn-sm" onclick="batchToggleUsers(0)">批量禁用</button>
    <button class="btn btn-primary btn-sm" onclick="showUserForm()">+ 添加账号</button>`;

  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <input id="usr-filter" placeholder="用户名搜索" style="max-width:180px;"/>
        <button class="btn btn-secondary btn-sm" onclick="loadUsers()">🔍 搜索</button>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" onclick="batchSetRole(10)">设为管理员</button>
        <button class="btn btn-secondary btn-sm" onclick="batchSetRole(1)">设为普通</button>
      </div>
      <div class="table-wrap">
        <table id="usr-table">
          <thead><tr>
            <th class="table-check"><input type="checkbox" onchange="toggleAllCheck(this,'usr-table')"/></th>
            <th>ID</th><th>用户名</th><th>昵称</th><th>角色</th><th>状态</th><th>最后登录</th><th>操作</th>
          </tr></thead>
          <tbody id="usr-tbody"><tr class="loading-row"><td colspan="8">加载中...</td></tr></tbody>
        </table>
      </div>
      <div id="usr-pagination"></div>
    </div>`;
  await loadUsers();
}

async function loadUsers() {
  const res = await API.Users.list({ page: userPage, pageSize: 20, username: document.getElementById('usr-filter')?.value.trim() || undefined });
  const items = res?.data?.items || [];
  const total = res?.data?.total || 0;
  document.getElementById('usr-tbody').innerHTML = items.length ? items.map(u => `
    <tr>
      <td><input type="checkbox" value="${u.id}" onchange="updateBatchBtn('usr-table','batch-del-usr')"/></td>
      <td>${u.id}</td>
      <td><b>${u.username}</b></td>
      <td>${u.nickname||'-'}</td>
      <td>${userTypeBadge(u.user_type)}</td>
      <td>${userStatusBadge(u.status)}</td>
      <td>${fmtDate(u.login_time)}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-sm btn-secondary" onclick="editUser(${JSON.stringify(u).replace(/"/g,'&quot;')})">编辑</button>
        ${u.id !== 1 ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">删除</button>` : ''}
      </td>
    </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">暂无用户</td></tr>`;
  document.getElementById('usr-pagination').innerHTML = paginationHtml(userPage, total, 20);
  window.changePage = (p) => { if(p<1||p>Math.ceil(total/20))return; userPage=p; loadUsers(); };
}

function showUserForm(u = null) {
  const html = `
    <div class="form-row">
      <div class="form-group"><label class="form-label required">用户名</label>
        <input id="uf-username" value="${u?.username||''}" ${u?'readonly':''}/>
        ${u?'<div class="form-hint">用户名不可修改</div>':''}</div>
      <div class="form-group"><label class="form-label">昵称</label>
        <input id="uf-nickname" value="${u?.nickname||''}"/></div>
    </div>
    <div class="form-group"><label class="form-label ${u?'':'required'}">密码</label>
      <input id="uf-password" type="password" placeholder="${u?'留空则不修改':'设置登录密码'}"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">角色</label>
        <select id="uf-type">
          <option value="100" ${u?.user_type==100?'selected':''}>超级管理员</option>
          <option value="10" ${u?.user_type==10?'selected':''}>管理员</option>
          <option value="1" ${(!u||u?.user_type==1)?'selected':''}>普通账户</option>
        </select></div>
      <div class="form-group"><label class="form-label">状态</label>
        <select id="uf-status">
          <option value="1" ${u?.status==1||!u?'selected':''}>正常</option>
          <option value="0" ${u?.status==0?'selected':''}>禁用</option>
        </select></div>
    </div>`;
  showModal(u ? '编辑账号' : '添加账号', html, async (mid) => {
    const data = {
      username: document.getElementById('uf-username').value.trim(),
      nickname: document.getElementById('uf-nickname').value.trim() || undefined,
      user_type: +document.getElementById('uf-type').value,
      status: +document.getElementById('uf-status').value,
    };
    const pwd = document.getElementById('uf-password').value;
    if (pwd) data.password = pwd;
    if (u?.id) data.id = u.id;
    if (!data.username) { toast('用户名不能为空', 'error'); return; }
    if (!u && !pwd) { toast('请设置密码', 'error'); return; }
    const res = await API.Users.save(data);
    if (res?.success) { toast('保存成功', 'success'); closeModal(mid); loadUsers(); }
    else toast(res?.message || '保存失败', 'error');
  });
}
function editUser(u) { showUserForm(u); }
async function deleteUser(id) {
  if (!await confirm('确认删除该用户？')) return;
  const res = await API.Users.delete([id]);
  if (res?.success) { toast('删除成功', 'success'); loadUsers(); }
}
async function batchDeleteUsers() {
  const ids = getChecked(document.getElementById('usr-table'));
  if (!ids.length) return;
  if (!await confirm(`删除选中 ${ids.length} 个用户？`)) return;
  const res = await API.Users.batchDelete(ids.filter(id=>id!==1));
  if (res?.success) { toast('批量删除成功', 'success'); loadUsers(); }
}
async function batchToggleUsers(status) {
  const ids = getChecked(document.getElementById('usr-table'));
  if (!ids.length) { toast('请先选择用户', 'error'); return; }
  const res = await API.Users.batchToggleStatus(ids, status);
  if (res?.success) { toast(status?'批量启用成功':'批量禁用成功', 'success'); loadUsers(); }
}
async function batchSetRole(userType) {
  const ids = getChecked(document.getElementById('usr-table'));
  if (!ids.length) { toast('请先选择用户', 'error'); return; }
  const res = await API.Users.batchUpdateType(ids, userType);
  if (res?.success) { toast('批量修改角色成功', 'success'); loadUsers(); }
}

// ============================================================
// 对话管理（只读列表）
// ============================================================
async function renderConversations() {
  setPageTitle('对话管理');
  document.getElementById('header-actions').innerHTML = '';
  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <input id="conv-phone" placeholder="手机号搜索" style="max-width:180px;"/>
        <button class="btn btn-secondary btn-sm" onclick="loadConversations()">🔍 搜索</button>
        <div class="spacer"></div>
      </div>
      <div class="table-wrap">
        <table><thead><tr>
          <th>ID</th><th>系统账号</th><th>状态</th><th>未读数</th><th>最近消息</th><th>操作</th>
        </tr></thead><tbody id="conv-tbody"><tr class="loading-row"><td colspan="6">加载中...</td></tr></tbody></table>
      </div>
      <div id="conv-pagination"></div>
    </div>`;
  await loadConversations();
}

let convPage = 1;
async function loadConversations() {
  const res = await API.Stats.dialogboxList({
    page: convPage, page_size: 20,
    system_phonenumber: document.getElementById('conv-phone')?.value.trim() || undefined,
  });
  const items = res?.data?.list || res?.data?.items || [];
  const total = res?.data?.total || 0;
  document.getElementById('conv-tbody').innerHTML = items.length ? items.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${c.system_phonenumber||c.phone||'-'}</td>
      <td>${accountStatusBadge(c.status??1)}</td>
      <td>${c.unread_count||0}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.last_message||'-'}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteConv(${c.id})">删除</button></td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">暂无对话记录</td></tr>`;
  document.getElementById('conv-pagination').innerHTML = paginationHtml(convPage, total, 20);
  window.changePage = (p) => { if(p<1)return; convPage=p; loadConversations(); };
}
async function deleteConv(id) {
  if (!await confirm('确认删除该对话？')) return;
  const res = await request('DELETE', '/TcardClient/conversation/delete', { ids: [id] });
  if (res?.success) { toast('删除成功', 'success'); loadConversations(); }
}

// ============================================================
// 全局工具
// ============================================================
function toggleAllCheck(masterCb, tableId) {
  document.querySelectorAll(`#${tableId} tbody input[type=checkbox]`).forEach(cb => cb.checked = masterCb.checked);
}
function updateBatchBtn(tableId, btnId) {
  const checked = document.querySelectorAll(`#${tableId} tbody input[type=checkbox]:checked`).length;
  const btn = document.getElementById(btnId);
  if (btn) btn.disabled = !checked;
}

window.doLogin = doLogin;
window.renderLogin = renderLogin;
window.renderDashboard = renderDashboard;
window.renderAccounts = renderAccounts;
window.renderProjects = renderProjects;
window.renderCustomers = renderCustomers;
window.renderTasks = renderTasks;
window.renderBatchUpload = renderBatchUpload;
window.renderStatistics = renderStatistics;
window.renderUsers = renderUsers;
window.renderConversations = renderConversations;
window.toggleAllCheck = toggleAllCheck;
window.updateBatchBtn = updateBatchBtn;
window.doTaskAction = doTaskAction;
window.doDeleteTask = doDeleteTask;
window.showTaskForm = showTaskForm;
window.clearAllTasks = clearAllTasks;
window.exportTasks = exportTasks;
window.showAccountForm = showAccountForm;
window.editAccount = editAccount;
window.deleteAccount = deleteAccount;
window.batchDeleteAccounts = batchDeleteAccounts;
window.batchToggleAccStatus = batchToggleAccStatus;
window.exportAccounts = exportAccounts;
window.showProjectForm = showProjectForm;
window.editProject = editProject;
window.deleteProject = deleteProject;
window.deleteCustomer = deleteCustomer;
window.batchDeleteCustomers = batchDeleteCustomers;
window.batchChangeCustomerStatus = batchChangeCustomerStatus;
window.showUserForm = showUserForm;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.batchDeleteUsers = batchDeleteUsers;
window.batchToggleUsers = batchToggleUsers;
window.batchSetRole = batchSetRole;
window.handleFileSelect = handleFileSelect;
window.handleFileDrop = handleFileDrop;
window.deleteConv = deleteConv;
window.searchTasks = searchTasks;
window.resetTaskFilter = resetTaskFilter;
window.searchAccounts = searchAccounts;
window.resetAccountFilter = resetAccountFilter;
window.loadUsers = loadUsers;
window.loadProjects = loadProjects;
window.loadCustomers = loadCustomers;
window.loadConversations = loadConversations;
window.clearBatchAll = clearBatchAll;
window.exportBatch = exportBatch;
window.batchStartTasks = batchStartTasks;
window.batchStopTasks = batchStopTasks;
