/* ============================================================
   所有页面渲染（优化版）
   - 首页：含统计数据（合并原「数据统计」页）
   - 任务管理：含批量上传（合并原「批量上传」页）
   - 账号/项目/客户/用户：保持原功能，UI 更简洁
   ============================================================ */

// ============================================================
// 登录页
// ============================================================
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div id="login-page">
      <div class="login-box">
        <div class="login-logo">
          <div style="font-size:48px;margin-bottom:12px;">🛸</div>
          <h1>阿凡达管理系统</h1>
          <p>Avatar SMS Management</p>
        </div>
        <div class="login-card">
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input id="login-user" type="text" placeholder="请输入用户名" value="admin" onkeydown="if(event.key==='Enter')doLogin()"/>
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input id="login-pass" type="password" placeholder="请输入密码" onkeydown="if(event.key==='Enter')doLogin()"/>
          </div>
          <button class="btn btn-primary" id="login-btn" style="width:100%;justify-content:center;padding:12px;" onclick="doLogin()">登录</button>
        </div>
        <div class="login-footer">内部系统 · 请勿外传</div>
      </div>
    </div>`;
}

async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  if (!u || !p) { toast('请填写用户名和密码', 'error'); return; }
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 登录中...';
  try {
    const res = await API.Auth.login(u, p);
    if (res?.success) {
      localStorage.setItem('token', res.data.token);
      _userInfo = null;
      toast('登录成功', 'success');
      location.hash = '#/dashboard';
    } else {
      toast(res?.message || '用户名或密码错误', 'error');
      btn.disabled = false; btn.innerHTML = '登录';
    }
  } catch(e) {
    toast('网络错误，请检查连接', 'error');
    btn.disabled = false; btn.innerHTML = '登录';
  }
}
window.doLogin = doLogin;

// ============================================================
// 首页（含数据统计，合并原「数据统计」页面）
// ============================================================
async function renderDashboard() {
  setPageTitle('首页概览');
  document.getElementById('header-actions').innerHTML = '';
  document.getElementById('content').innerHTML = `
    <div class="stat-grid" id="stat-grid">
      ${[1,2,3,4].map(()=>`<div class="stat-card skeleton"></div>`).join('')}
    </div>
    <div class="two-col-grid">
      <div class="card">
        <div class="card-header"><span class="card-title">📋 最近任务</span><button class="btn btn-sm btn-secondary" onclick="navigate('tasks')">查看全部</button></div>
        <div id="recent-tasks"><div class="empty-tip">加载中...</div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📊 任务状态分布</span></div>
        <div class="card-body" id="task-chart">加载中...</div>
      </div>
    </div>
    <div class="card" style="margin-top:16px;">
      <div class="card-header"><span class="card-title">🖥️ 系统状态</span></div>
      <div class="card-body" id="sys-status">
        <div class="sys-grid">
          <div class="sys-item"><span class="text-muted">后端服务</span><span class="badge badge-success">正常</span></div>
          <div class="sys-item"><span class="text-muted">数据库</span><span class="badge badge-success">连接正常</span></div>
          <div class="sys-item"><span class="text-muted">PHP 版本</span><span class="text-muted">8.3.6</span></div>
          <div class="sys-item"><span class="text-muted">框架</span><span class="text-muted">Laravel 13</span></div>
        </div>
      </div>
    </div>`;

  const [ovRes, taskRes] = await Promise.all([
    API.Stats.overview().catch(() => null),
    API.Tasks.list({ page: 1, pageSize: 8 }).catch(() => null),
  ]);

  const d = ovRes?.data || {};
  document.getElementById('stat-grid').innerHTML = `
    <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-label">总任务数</div><div class="stat-value">${d.tasks?.total ?? 0}</div><div class="stat-sub">运行中 ${d.tasks?.running ?? 0}</div></div>
    <div class="stat-card"><div class="stat-icon">📨</div><div class="stat-label">总发送量</div><div class="stat-value">${(d.sends?.total ?? 0).toLocaleString()}</div><div class="stat-sub">成功率 ${d.sends?.rate ?? 0}%</div></div>
    <div class="stat-card"><div class="stat-icon">📱</div><div class="stat-label">账号总数</div><div class="stat-value">${d.accounts?.total ?? 0}</div><div class="stat-sub">在线 ${d.accounts?.online ?? 0}</div></div>
    <div class="stat-card"><div class="stat-icon">🗂️</div><div class="stat-label">项目总数</div><div class="stat-value">${d.projects?.total ?? 0}</div><div class="stat-sub">活跃项目</div></div>`;

  const tasks = taskRes?.data?.items || [];
  document.getElementById('recent-tasks').innerHTML = tasks.length ? `
    <div class="table-wrap">
      <table>
        <thead><tr><th>任务名</th><th>状态</th><th>发送量</th><th>时间</th></tr></thead>
        <tbody>${tasks.map(t => `
          <tr>
            <td style="font-weight:500;">${t.task_name||'-'}</td>
            <td>${taskStatusBadge(t.status)}</td>
            <td>${(t.total_count||0).toLocaleString()}</td>
            <td class="text-muted" style="font-size:12px;">${fmtDate(t.created_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<div class="empty-state"><div style="font-size:32px">📭</div><p>暂无任务</p></div>`;

  const statusList = [
    { label:'待启动', count: tasks.filter(t=>t.status===0).length, color:'var(--text-muted)' },
    { label:'运行中', count: tasks.filter(t=>t.status===1).length, color:'var(--success)' },
    { label:'已完成', count: tasks.filter(t=>t.status===2).length, color:'var(--accent)' },
    { label:'已暂停', count: tasks.filter(t=>t.status===3).length, color:'var(--warning)' },
    { label:'失败',   count: tasks.filter(t=>t.status===4).length, color:'var(--danger)' },
  ];
  const maxCount = Math.max(...statusList.map(s => s.count), 1);
  document.getElementById('task-chart').innerHTML = statusList.map(s => `
    <div style="margin-bottom:14px;">
      <div class="flex-between mb-1"><span style="font-size:13px;">${s.label}</span><span style="font-size:13px;font-weight:600;">${s.count}</span></div>
      <div class="progress-bar"><div class="fill" style="width:${Math.round(s.count/maxCount*100)}%;background:${s.color};"></div></div>
    </div>`).join('');
}

// ============================================================
// 共用：项目选项缓存
// ============================================================
let _projectCache = [];
async function loadProjectOptions() {
  try {
    const res = await API.Projects.list({ page: 1, pageSize: 100 });
    const items = res?.data?.items || res?.data?.list || [];
    _projectCache = Array.isArray(items) ? items : [];
  } catch(e) { _projectCache = []; }
}
function buildProjectOptions(selectedId) {
  return _projectCache.map(p =>
    `<option value="${p.id}" ${String(p.id)===String(selectedId)?'selected':''}>${p.project_name||'项目'+p.id}</option>`
  ).join('');
}
function getProjectName(id) {
  if (!id) return '-';
  const p = _projectCache.find(x => String(x.id)===String(id));
  return p ? p.project_name : '#'+id;
}

// ============================================================
// 账号管理
// ============================================================
let accountPage = 1, accountFilter = {};
async function renderAccounts() {
  setPageTitle('账号管理');
  await loadProjectOptions();
  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="openImportModal()">📤 导入</button>
    <button class="btn btn-secondary btn-sm" onclick="exportAccounts()">📥 导出</button>
    <button class="btn btn-danger btn-sm" id="batch-del-acc" onclick="batchDeleteAccounts()" disabled>批量删除</button>
    <button class="btn btn-primary btn-sm" onclick="showAccountForm()">＋ 添加</button>`;

  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <input id="acc-kw" placeholder="账号/手机号搜索" style="max-width:180px;" value="${accountFilter.keyword||''}"/>
        <select id="acc-online"><option value="">全部状态</option><option value="1">在线</option><option value="0">离线</option></select>
        <select id="acc-proj"><option value="">全部项目</option>${buildProjectOptions('')}</select>
        <button class="btn btn-secondary btn-sm" onclick="searchAccounts()">搜索</button>
        <button class="btn btn-link btn-sm" onclick="resetAccountFilter()">重置</button>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" onclick="batchToggleAccStatus(1)">批量启用</button>
        <button class="btn btn-secondary btn-sm" onclick="batchToggleAccStatus(0)">批量禁用</button>
      </div>
      <div class="table-wrap">
        <table id="acc-table">
          <thead><tr>
            <th><input type="checkbox" onchange="toggleAllCheck(this,'acc-table')"/></th>
            <th>#</th><th>账号</th><th>手机号</th><th>类型</th><th>状态</th><th>在线</th><th>项目</th><th>发送数</th><th>创建时间</th><th>操作</th>
          </tr></thead>
          <tbody id="acc-tbody"><tr><td colspan="11" class="loading-cell">加载中...</td></tr></tbody>
        </table>
      </div>
      <div id="acc-pager"></div>
    </div>`;
  await loadAccounts();
}

async function loadAccounts() {
  const res = await API.Accounts.list({ page: accountPage, pageSize: 20, ...accountFilter }).catch(()=>null);
  const items = res?.data?.items || [];
  const total = res?.data?.total || 0;
  document.getElementById('acc-tbody').innerHTML = items.length ? items.map((a,i) => `
    <tr>
      <td><input type="checkbox" value="${a.id}" onchange="updateBatchBtn('acc-table','batch-del-acc')"/></td>
      <td class="text-muted">${(accountPage-1)*20+i+1}</td>
      <td class="mono text-accent" title="${a.myphonenumber||''}">${(a.myphonenumber||'-').substring(0,24)}</td>
      <td class="mono">${a.phone||'-'}</td>
      <td>${a.account_type==='tn'?'<span class="badge badge-blue">TN</span>':a.account_type==='tw'?'<span class="badge badge-purple">TW</span>':'<span class="badge badge-muted">-</span>'}</td>
      <td>${a.status==1?'<span class="badge badge-success">正常</span>':'<span class="badge badge-danger">禁用</span>'}</td>
      <td>${a.online_status==1?'<span class="badge badge-success">在线</span>':'<span class="badge badge-muted">离线</span>'}</td>
      <td>${getProjectName(a.project_id)}</td>
      <td class="text-center">${a.send_count||0}</td>
      <td class="text-muted small">${fmtDate(a.created_at)}</td>
      <td class="action-col">
        <button class="btn btn-sm btn-secondary" onclick='editAccount(${JSON.stringify(a).replace(/'/g,"&#39;")})'>编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAccount(${a.id})">删除</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="11" class="empty-cell">暂无数据</td></tr>`;
  document.getElementById('acc-pager').innerHTML = paginationHtml(accountPage, total, 20);
  window.changePage = p => { if(p<1||p>Math.ceil(total/20))return; accountPage=p; loadAccounts(); };
}

function searchAccounts() {
  accountPage = 1;
  accountFilter = {
    keyword: document.getElementById('acc-kw').value.trim()||undefined,
    online_status: document.getElementById('acc-online').value||undefined,
    project_id: document.getElementById('acc-proj').value||undefined,
  };
  loadAccounts();
}
function resetAccountFilter() { accountFilter={}; accountPage=1; renderAccounts(); }

function showAccountForm(acc=null) {
  const isEdit = !!(acc?.id);
  showModal(isEdit?'编辑账号':'添加账号', `
    <div class="form-row">
      <div class="form-group flex2"><label class="form-label required">账号(邮箱)</label><input id="af-myphone" value="${acc?.myphonenumber||''}"/></div>
      <div class="form-group"><label class="form-label">手机号</label><input id="af-phone" value="${acc?.phone||''}"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">账号类型</label>
        <select id="af-type">
          <option value="tn" ${acc?.account_type==='tn'||!acc?'selected':''}>TextNow</option>
          <option value="tw" ${acc?.account_type==='tw'?'selected':''}>TextWeb</option>
        </select></div>
      <div class="form-group"><label class="form-label">状态</label>
        <select id="af-status"><option value="1" ${acc?.status!=0?'selected':''}>正常</option><option value="0" ${acc?.status==0?'selected':''}>禁用</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">所属项目</label>
        <select id="af-proj"><option value="">无</option>${buildProjectOptions(acc?.project_id||'')}</select></div>
      <div class="form-group"><label class="form-label">在线状态</label>
        <select id="af-online"><option value="0">离线</option><option value="1" ${acc?.online_status==1?'selected':''}>在线</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Cookie</label>
      <textarea id="af-cookie" rows="2" class="mono small">${acc?.cookie||''}</textarea></div>`,
  async (mid) => {
    const mp = document.getElementById('af-myphone').value.trim();
    if (!mp) { toast('账号不能为空','error'); return; }
    const data = { myphonenumber:mp, phone:document.getElementById('af-phone').value.trim()||null, account_type:document.getElementById('af-type').value, status:+document.getElementById('af-status').value, online_status:+document.getElementById('af-online').value, project_id:document.getElementById('af-proj').value||null, cookie:document.getElementById('af-cookie').value.trim()||null };
    if (isEdit) data.id = acc.id;
    const res = await API.Accounts.save(data);
    if (res?.success) { toast('保存成功','success'); closeModal(mid); loadAccounts(); }
    else toast(res?.message||'保存失败','error');
  });
}
function editAccount(a) { showAccountForm(a); }
async function deleteAccount(id) {
  if (!await confirm('确认删除该账号？')) return;
  const res = await API.Accounts.delete([id]);
  if (res?.success) { toast('删除成功','success'); loadAccounts(); }
  else toast(res?.message||'删除失败','error');
}
async function batchDeleteAccounts() {
  const ids = getChecked(document.getElementById('acc-table'));
  if (!ids.length||!await confirm(`删除选中 ${ids.length} 条？`)) return;
  const res = await API.Accounts.delete(ids);
  if (res?.success) { toast('批量删除成功','success'); loadAccounts(); }
}
async function batchToggleAccStatus(status) {
  const ids = getChecked(document.getElementById('acc-table'));
  if (!ids.length) { toast('请先选择','error'); return; }
  const res = await API.Accounts.updateStatus(ids, status);
  if (res?.success) { toast(status?'已批量启用':'已批量禁用','success'); loadAccounts(); }
}
async function exportAccounts() {
  const token = localStorage.getItem('token');
  const resp = await fetch('/prod/cloud/phoneinfo/export',{headers:{Authorization:`Bearer ${token}`}});
  if (!resp.ok) { toast('导出失败','error'); return; }
  downloadBlob(await resp.blob(), `accounts_${Date.now()}.csv`);
  toast('导出成功','success');
}
function openImportModal() {
  showModal('导入账号', `
    <div class="hint-box">支持 <b>.xlsx</b> / <b>.csv</b>，列格式：<code>myphonenumber, phone, user_name, account_type, cookie</code></div>
    <div class="upload-area" onclick="document.getElementById('import-file').click()">
      <div style="font-size:32px">📁</div>
      <div id="import-fname" class="text-muted">点击选择文件</div>
    </div>
    <input id="import-file" type="file" accept=".xlsx,.csv" style="display:none" onchange="document.getElementById('import-fname').textContent=this.files[0]?.name||'已选择'"/>
    <div id="import-msg" style="margin-top:8px;"></div>`,
  async (mid) => {
    const f = document.getElementById('import-file').files[0];
    if (!f) { toast('请选择文件','error'); return; }
    const fd = new FormData(); fd.append('file',f);
    const res = await API.Accounts.import(fd);
    if (res?.success||res?.code===200) { toast(res?.message||'导入成功','success'); closeModal(mid); loadAccounts(); }
    else document.getElementById('import-msg').innerHTML = `<span class="text-danger">${res?.message||'导入失败'}</span>`;
  });
}

// ============================================================
// 项目管理
// ============================================================
let projPage = 1;
async function renderProjects() {
  setPageTitle('项目管理');
  document.getElementById('header-actions').innerHTML = `<button class="btn btn-primary btn-sm" onclick="showProjectForm()">＋ 新建项目</button>`;
  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <input id="proj-kw" placeholder="项目名搜索" style="max-width:180px;"/>
        <button class="btn btn-secondary btn-sm" onclick="loadProjects()">搜索</button>
        <div class="spacer"></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>项目名称</th><th>项目KEY</th><th>账号类型</th><th>最大发送</th><th>间隔(秒)</th><th>创建时间</th><th>操作</th></tr></thead>
          <tbody id="proj-tbody"><tr><td colspan="8" class="loading-cell">加载中...</td></tr></tbody>
        </table>
      </div>
      <div id="proj-pager"></div>
    </div>`;
  await loadProjects();
}

async function loadProjects() {
  const res = await API.Projects.list({ page: projPage, pageSize: 20, project_name: document.getElementById('proj-kw')?.value.trim()||undefined }).catch(()=>null);
  const items = res?.data?.items||[];
  const total = res?.data?.total||0;
  document.getElementById('proj-tbody').innerHTML = items.length ? items.map(p=>`
    <tr>
      <td class="text-muted">${p.id}</td>
      <td style="font-weight:500;">${p.project_name}</td>
      <td><code class="code-tag">${p.project_key||'-'}</code></td>
      <td>${p.account_type||'-'}</td>
      <td>${p.max_send_count||'-'}</td>
      <td>${p.send_interval||'-'}</td>
      <td class="text-muted small">${fmtDate(p.created_at)}</td>
      <td class="action-col">
        <button class="btn btn-sm btn-secondary" onclick='showProjectForm(${JSON.stringify(p).replace(/'/g,"&#39;")})'>编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProject(${p.id})">删除</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="8" class="empty-cell">暂无项目，请先创建</td></tr>`;
  document.getElementById('proj-pager').innerHTML = paginationHtml(projPage, total, 20);
  window.changePage = p => { if(p<1||p>Math.ceil(total/20))return; projPage=p; loadProjects(); };
}

function showProjectForm(proj=null) {
  showModal(proj?'编辑项目':'新建项目', `
    <div class="form-row">
      <div class="form-group"><label class="form-label required">项目名称</label><input id="pf-name" value="${proj?.project_name||''}"/></div>
      <div class="form-group"><label class="form-label required">项目标识</label><input id="pf-key" placeholder="如: america" value="${proj?.project_key||''}"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">账号类型</label>
        <select id="pf-acctype"><option value="tn" ${proj?.account_type=='tn'?'selected':''}>TextNow (tn)</option><option value="tw" ${proj?.account_type=='tw'?'selected':''}>TextWeb (tw)</option></select></div>
      <div class="form-group"><label class="form-label">项目类型</label>
        <select id="pf-projtype"><option value="1">类型 1</option><option value="2" ${proj?.project_type==2?'selected':''}>类型 2</option><option value="3" ${proj?.project_type==3?'selected':''}>类型 3</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">最大发送数</label><input id="pf-max" type="number" value="${proj?.max_send_count||100}"/></div>
      <div class="form-group"><label class="form-label">发送间隔(秒)</label><input id="pf-interval" type="number" value="${proj?.send_interval||300}"/></div>
    </div>`,
  async (mid) => {
    const data = { project_name:document.getElementById('pf-name').value.trim(), project_key:document.getElementById('pf-key').value.trim(), account_type:document.getElementById('pf-acctype').value, project_type:+document.getElementById('pf-projtype').value, max_send_count:+document.getElementById('pf-max').value||100, send_interval:+document.getElementById('pf-interval').value||300 };
    if (!data.project_name||!data.project_key) { toast('名称和标识不能为空','error'); return; }
    if (proj?.id) data.id = proj.id;
    const res = await API.Projects.save(data);
    if (res?.success) { toast('保存成功','success'); closeModal(mid); loadProjects(); }
    else toast(res?.message||'保存失败','error');
  });
}
async function deleteProject(id) {
  if (!await confirm('确认删除该项目？')) return;
  const res = await API.Projects.delete([id]);
  if (res?.success) { toast('删除成功','success'); loadProjects(); }
}

// ============================================================
// 任务管理（含批量上传功能，合并原两个页面）
// ============================================================
let taskPage=1, taskFilter={};
async function renderTasks() {
  setPageTitle('任务管理');
  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="exportTasks()">📥 导出</button>
    <button class="btn btn-danger btn-sm" onclick="clearAllTasks()">🗑 清除</button>
    <button class="btn btn-primary btn-sm" onclick="showTaskForm()">＋ 创建任务</button>`;

  document.getElementById('content').innerHTML = `
    <!-- 批量上传区（原「批量上传」页面功能，合并至此） -->
    <div class="card" id="upload-card">
      <div class="card-header" onclick="toggleUploadCard()" style="cursor:pointer;">
        <span class="card-title">📂 批量上传文件</span>
        <span id="upload-toggle-icon" class="text-muted" style="font-size:12px;">▼ 展开</span>
      </div>
      <div id="upload-body" style="display:none;" class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="upload-area" id="upload-drop"
            onclick="document.getElementById('upload-file').click()"
            ondragover="event.preventDefault();this.classList.add('drag-over')"
            ondragleave="this.classList.remove('drag-over')"
            ondrop="handleFileDrop(event)">
            <div style="font-size:36px">📂</div>
            <p>点击或拖拽文件到此处</p>
            <p class="text-muted small">支持 CSV、TXT、Excel</p>
          </div>
          <div>
            <div class="hint-box">
              <b>格式说明：</b><br/>
              每行一个手机号，或 CSV 格式<br/>
              编码：UTF-8（推荐）<br/>
              重复号码自动跳过
            </div>
            <div id="upload-status" style="margin-top:12px;"></div>
          </div>
        </div>
        <input type="file" id="upload-file" style="display:none" accept=".csv,.txt,.xlsx" onchange="handleFileSelect(this)"/>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="card">
      <div class="filter-bar">
        <input id="task-kw" placeholder="任务名搜索" style="max-width:180px;" value="${taskFilter.task_name||''}"/>
        <select id="task-status-f">
          <option value="">全部状态</option>
          <option value="0" ${taskFilter.status===0?'selected':''}>待启动</option>
          <option value="1" ${taskFilter.status===1?'selected':''}>运行中</option>
          <option value="2" ${taskFilter.status===2?'selected':''}>已完成</option>
          <option value="3" ${taskFilter.status===3?'selected':''}>已暂停</option>
          <option value="4" ${taskFilter.status===4?'selected':''}>失败</option>
        </select>
        <button class="btn btn-secondary btn-sm" onclick="searchTasks()">搜索</button>
        <button class="btn btn-link btn-sm" onclick="resetTaskFilter()">重置</button>
        <div class="spacer"></div>
        <button class="btn btn-success btn-sm" onclick="batchStartTasks()">批量启动</button>
        <button class="btn btn-secondary btn-sm" onclick="batchStopTasks()">批量暂停</button>
      </div>
      <div class="table-wrap">
        <table id="task-table">
          <thead><tr>
            <th><input type="checkbox" onchange="toggleAllCheck(this,'task-table')"/></th>
            <th>ID</th><th>任务名称</th><th>项目</th><th>发送量</th><th>成功量</th><th>状态</th><th>创建时间</th><th>操作</th>
          </tr></thead>
          <tbody id="task-tbody"><tr><td colspan="9" class="loading-cell">加载中...</td></tr></tbody>
        </table>
      </div>
      <div id="task-pager"></div>
    </div>`;
  await loadTasks();
}

function toggleUploadCard() {
  const body = document.getElementById('upload-body');
  const icon = document.getElementById('upload-toggle-icon');
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? 'block' : 'none';
  icon.textContent = hidden ? '▲ 收起' : '▼ 展开';
}

async function loadTasks() {
  const res = await API.Tasks.list({ page:taskPage, pageSize:20, ...taskFilter }).catch(()=>null);
  const items = res?.data?.items||[];
  const total = res?.data?.total||0;
  document.getElementById('task-tbody').innerHTML = items.length ? items.map(t=>`
    <tr>
      <td><input type="checkbox" value="${t.id}"/></td>
      <td class="text-muted">${t.id}</td>
      <td style="font-weight:500;">${t.task_name||'-'}</td>
      <td>${t.project_key||t.project_id||'-'}</td>
      <td>${(t.total_count||0).toLocaleString()}</td>
      <td>${(t.success_count||0).toLocaleString()}</td>
      <td>${taskStatusBadge(t.status)}</td>
      <td class="text-muted small">${fmtDate(t.created_at)}</td>
      <td class="action-col" style="white-space:nowrap;">
        ${t.status===0||t.status===3?`<button class="btn btn-sm btn-success" onclick="doTaskAction('start',${t.id})">启动</button>`:''}
        ${t.status===1?`<button class="btn btn-sm btn-secondary" onclick="doTaskAction('stop',${t.id})">暂停</button>`:''}
        <button class="btn btn-sm btn-danger" onclick="doDeleteTask(${t.id})">删除</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="9" class="empty-cell">暂无任务</td></tr>`;
  document.getElementById('task-pager').innerHTML = paginationHtml(taskPage, total, 20);
  window.changePage = p => { if(p<1||p>Math.ceil(total/20))return; taskPage=p; loadTasks(); };
}

function searchTasks() { taskPage=1; taskFilter={ task_name:document.getElementById('task-kw').value.trim()||undefined, status:document.getElementById('task-status-f').value!==''?+document.getElementById('task-status-f').value:undefined }; loadTasks(); }
function resetTaskFilter() { taskFilter={}; taskPage=1; renderTasks(); }

function showTaskForm() {
  showModal('创建任务', `
    <div class="form-group"><label class="form-label required">任务名称</label><input id="tf-name" placeholder="请输入任务名称"/></div>
    <div class="form-group"><label class="form-label">项目KEY</label><input id="tf-key" placeholder="如: america"/></div>
    <div class="form-group"><label class="form-label">发送内容</label><textarea id="tf-content" rows="3" placeholder="（可选）"></textarea></div>`,
  async (mid) => {
    const data = { task_name:document.getElementById('tf-name').value.trim(), project_key:document.getElementById('tf-key').value.trim()||undefined, content:document.getElementById('tf-content').value.trim()||undefined };
    if (!data.task_name) { toast('任务名称不能为空','error'); return; }
    const res = await API.Tasks.save(data);
    if (res?.success) { toast('创建成功','success'); closeModal(mid); loadTasks(); }
    else toast(res?.message||'创建失败','error');
  });
}

async function doTaskAction(action, id) {
  const fn = action==='start'?API.Tasks.start:API.Tasks.stop;
  const res = await fn([id]);
  if (res?.success) { toast(action==='start'?'已启动':'已暂停','success'); loadTasks(); }
  else toast(res?.message||'操作失败','error');
}
async function doDeleteTask(id) {
  if (!await confirm('确认删除该任务？','删除任务')) return;
  const res = await API.Tasks.delete([id]);
  if (res?.success) { toast('删除成功','success'); loadTasks(); }
}
async function batchStartTasks() {
  const ids = getChecked(document.getElementById('task-table'));
  if (!ids.length) { toast('请先选择任务','error'); return; }
  const res = await API.Tasks.start(ids);
  if (res?.success) { toast('批量启动成功','success'); loadTasks(); }
}
async function batchStopTasks() {
  const ids = getChecked(document.getElementById('task-table'));
  if (!ids.length) { toast('请先选择任务','error'); return; }
  const res = await API.Tasks.stop(ids);
  if (res?.success) { toast('批量暂停成功','success'); loadTasks(); }
}
async function clearAllTasks() {
  showModal('清除任务', `
    <div class="form-group"><label class="form-label">按状态清除（不选则清除全部）</label>
      <select id="clear-st"><option value="">全部</option><option value="0">待启动</option><option value="2">已完成</option><option value="3">已暂停</option><option value="4">失败</option></select></div>`,
  async (mid) => {
    const s = document.getElementById('clear-st').value;
    const res = await API.Tasks.clearAll(s!==''?{status:+s}:null);
    if (res?.success) { toast('清除成功','success'); closeModal(mid); loadTasks(); }
    else toast(res?.message||'清除失败','error');
  }, { okText:'确认清除' });
}
async function exportTasks() {
  const blob = await API.Tasks.export().catch(()=>null);
  if (blob) downloadBlob(blob, `tasks_${Date.now()}.csv`);
  else toast('导出失败','error');
}

// 文件上传
function handleFileSelect(input) { const f=input.files[0]; if(f) doUploadFile(f); }
function handleFileDrop(e) { e.preventDefault(); document.getElementById('upload-drop').classList.remove('drag-over'); const f=e.dataTransfer.files[0]; if(f) doUploadFile(f); }
async function doUploadFile(file) {
  document.getElementById('upload-status').innerHTML = `<div class="text-muted"><span class="spinner"></span> 上传中：${file.name}</div>`;
  const fd=new FormData(); fd.append('file',file);
  const res = await API.BatchTask.upload(fd).catch(()=>null);
  if (res?.success) { document.getElementById('upload-status').innerHTML=`<span class="badge badge-success">✅ 上传成功</span>`; toast('上传成功','success'); loadTasks(); }
  else { document.getElementById('upload-status').innerHTML=`<span class="badge badge-danger">❌ ${res?.message||'上传失败'}</span>`; toast(res?.message||'上传失败','error'); }
}

// ============================================================
// 客户管理
// ============================================================
let custPage=1;
async function renderCustomers() {
  setPageTitle('客户管理');
  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-danger btn-sm" id="batch-del-cust" onclick="batchDeleteCustomers()" disabled>批量删除</button>
    <button class="btn btn-secondary btn-sm" onclick="batchChangeCustomerStatus(1)">批量启用</button>
    <button class="btn btn-secondary btn-sm" onclick="batchChangeCustomerStatus(0)">批量禁用</button>`;
  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <input id="cust-kw" placeholder="手机号搜索" style="max-width:160px;"/>
        <select id="cust-st"><option value="">全部状态</option><option value="1">正常</option><option value="0">禁用</option></select>
        <button class="btn btn-secondary btn-sm" onclick="loadCustomers()">搜索</button>
        <div class="spacer"></div>
      </div>
      <div class="table-wrap">
        <table id="cust-table">
          <thead><tr>
            <th><input type="checkbox" onchange="toggleAllCheck(this,'cust-table')"/></th>
            <th>ID</th><th>手机号</th><th>项目</th><th>状态</th><th>创建时间</th><th>操作</th>
          </tr></thead>
          <tbody id="cust-tbody"><tr><td colspan="7" class="loading-cell">加载中...</td></tr></tbody>
        </table>
      </div>
      <div id="cust-pager"></div>
    </div>`;
  await loadCustomers();
}
async function loadCustomers() {
  const res = await API.Customers.list({ page:custPage, pageSize:20, system_phonenumber:document.getElementById('cust-kw')?.value.trim()||undefined, status:document.getElementById('cust-st')?.value||undefined }).catch(()=>null);
  const items=res?.data?.items||[];
  const total=res?.data?.total||0;
  document.getElementById('cust-tbody').innerHTML = items.length ? items.map(c=>`
    <tr>
      <td><input type="checkbox" value="${c.id}" onchange="updateBatchBtn('cust-table','batch-del-cust')"/></td>
      <td class="text-muted">${c.id}</td>
      <td>${c.system_phonenumber||c.phone||'-'}</td>
      <td>${c.project_key||'-'}</td>
      <td>${accountStatusBadge(c.status)}</td>
      <td class="text-muted small">${fmtDate(c.created_at)}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})">删除</button></td>
    </tr>`).join('') : `<tr><td colspan="7" class="empty-cell">暂无客户</td></tr>`;
  document.getElementById('cust-pager').innerHTML = paginationHtml(custPage, total, 20);
  window.changePage = p => { if(p<1||p>Math.ceil(total/20))return; custPage=p; loadCustomers(); };
}
async function deleteCustomer(id) {
  if (!await confirm('确认删除该客户？')) return;
  const res = await API.Customers.delete([id]);
  if (res?.success) { toast('删除成功','success'); loadCustomers(); }
}
async function batchDeleteCustomers() {
  const ids=getChecked(document.getElementById('cust-table'));
  if (!ids.length||!await confirm(`删除选中 ${ids.length} 条？`)) return;
  const res=await API.Customers.delete(ids);
  if (res?.success) { toast('批量删除成功','success'); loadCustomers(); }
}
async function batchChangeCustomerStatus(status) {
  const ids=getChecked(document.getElementById('cust-table'));
  if (!ids.length) { toast('请先选择','error'); return; }
  const res=await API.Customers.batchChangeStatus({ids,status});
  if (res?.success) { toast(status?'已批量启用':'已批量禁用','success'); loadCustomers(); }
}

// ============================================================
// 系统用户管理
// ============================================================
let userPage=1;
async function renderUsers() {
  setPageTitle('系统用户');
  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-danger btn-sm" id="batch-del-usr" onclick="batchDeleteUsers()" disabled>批量删除</button>
    <button class="btn btn-secondary btn-sm" onclick="batchToggleUsers(1)">批量启用</button>
    <button class="btn btn-secondary btn-sm" onclick="batchToggleUsers(0)">批量禁用</button>
    <button class="btn btn-primary btn-sm" onclick="showUserForm()">＋ 添加</button>`;
  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <input id="usr-kw" placeholder="用户名搜索" style="max-width:180px;"/>
        <button class="btn btn-secondary btn-sm" onclick="loadUsers()">搜索</button>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" onclick="batchSetRole(10)">设为管理员</button>
        <button class="btn btn-secondary btn-sm" onclick="batchSetRole(1)">设为普通</button>
      </div>
      <div class="table-wrap">
        <table id="usr-table">
          <thead><tr>
            <th><input type="checkbox" onchange="toggleAllCheck(this,'usr-table')"/></th>
            <th>ID</th><th>用户名</th><th>昵称</th><th>角色</th><th>状态</th><th>最后登录</th><th>操作</th>
          </tr></thead>
          <tbody id="usr-tbody"><tr><td colspan="8" class="loading-cell">加载中...</td></tr></tbody>
        </table>
      </div>
      <div id="usr-pager"></div>
    </div>`;
  await loadUsers();
}
async function loadUsers() {
  const res = await API.Users.list({ page:userPage, pageSize:20, username:document.getElementById('usr-kw')?.value.trim()||undefined }).catch(()=>null);
  const items=res?.data?.items||[];
  const total=res?.data?.total||0;
  document.getElementById('usr-tbody').innerHTML = items.length ? items.map(u=>`
    <tr>
      <td><input type="checkbox" value="${u.id}" onchange="updateBatchBtn('usr-table','batch-del-usr')"/></td>
      <td class="text-muted">${u.id}</td>
      <td><b>${u.username}</b></td>
      <td>${u.nickname||'-'}</td>
      <td>${userTypeBadge(u.user_type)}</td>
      <td>${userStatusBadge(u.status)}</td>
      <td class="text-muted small">${fmtDate(u.login_time)}</td>
      <td class="action-col">
        <button class="btn btn-sm btn-secondary" onclick='showUserForm(${JSON.stringify(u).replace(/'/g,"&#39;")})'>编辑</button>
        ${u.id!==1?`<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">删除</button>`:''}
      </td>
    </tr>`).join('') : `<tr><td colspan="8" class="empty-cell">暂无用户</td></tr>`;
  document.getElementById('usr-pager').innerHTML = paginationHtml(userPage, total, 20);
  window.changePage = p => { if(p<1||p>Math.ceil(total/20))return; userPage=p; loadUsers(); };
}
function showUserForm(u=null) {
  showModal(u?'编辑用户':'添加用户', `
    <div class="form-row">
      <div class="form-group"><label class="form-label required">用户名</label><input id="uf-username" value="${u?.username||''}" ${u?'readonly':''}/></div>
      <div class="form-group"><label class="form-label">昵称</label><input id="uf-nickname" value="${u?.nickname||''}"/></div>
    </div>
    <div class="form-group"><label class="form-label ${u?'':'required'}">密码</label><input id="uf-pwd" type="password" placeholder="${u?'留空则不修改':'设置密码'}"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">角色</label>
        <select id="uf-type"><option value="1" ${u?.user_type===1?'selected':''}>普通账户</option><option value="10" ${u?.user_type===10?'selected':''}>管理员</option><option value="100" ${u?.user_type===100?'selected':''}>超级管理员</option></select></div>
      <div class="form-group"><label class="form-label">状态</label>
        <select id="uf-status"><option value="1" ${u?.status!=0?'selected':''}>正常</option><option value="0" ${u?.status==0?'selected':''}>禁用</option></select></div>
    </div>`,
  async (mid) => {
    const username=document.getElementById('uf-username').value.trim();
    const pwd=document.getElementById('uf-pwd').value;
    if (!u&&(!username||!pwd)) { toast('用户名和密码不能为空','error'); return; }
    const data={username,nickname:document.getElementById('uf-nickname').value.trim()||undefined,user_type:+document.getElementById('uf-type').value,status:+document.getElementById('uf-status').value};
    if (pwd) data.password=pwd;
    if (u?.id) data.id=u.id;
    const res=await API.Users.save(data);
    if (res?.success) { toast('保存成功','success'); closeModal(mid); loadUsers(); }
    else toast(res?.message||'保存失败','error');
  });
}
async function deleteUser(id) {
  if (!await confirm('确认删除该用户？')) return;
  const res=await API.Users.delete([id]);
  if (res?.success) { toast('删除成功','success'); loadUsers(); }
}
async function batchDeleteUsers() {
  const ids=getChecked(document.getElementById('usr-table'));
  if (!ids.length||!await confirm(`删除选中 ${ids.length} 个用户？`)) return;
  const res=await API.Users.batchDelete(ids);
  if (res?.success) { toast('批量删除成功','success'); loadUsers(); }
}
async function batchToggleUsers(status) {
  const ids=getChecked(document.getElementById('usr-table'));
  if (!ids.length) { toast('请先选择','error'); return; }
  const res=await API.Users.batchToggle(ids,status);
  if (res?.success) { toast(status?'已批量启用':'已批量禁用','success'); loadUsers(); }
}
async function batchSetRole(type) {
  const ids=getChecked(document.getElementById('usr-table'));
  if (!ids.length) { toast('请先选择','error'); return; }
  const res=await API.Users.batchSetType(ids,type);
  if (res?.success) { toast('设置成功','success'); loadUsers(); }
}

// 全局暴露
window.doLogin=doLogin;
window.renderLogin=renderLogin;
window.renderDashboard=renderDashboard;
window.renderAccounts=renderAccounts;
window.renderProjects=renderProjects;
window.renderTasks=renderTasks;
window.renderCustomers=renderCustomers;
window.renderUsers=renderUsers;
window.toggleUploadCard=toggleUploadCard;
window.handleFileSelect=handleFileSelect;
window.handleFileDrop=handleFileDrop;
window.showProjectForm=showProjectForm;
window.editAccount=editAccount;
window.deleteAccount=deleteAccount;
window.batchDeleteAccounts=batchDeleteAccounts;
window.batchToggleAccStatus=batchToggleAccStatus;
window.exportAccounts=exportAccounts;
window.openImportModal=openImportModal;
window.searchAccounts=searchAccounts;
window.resetAccountFilter=resetAccountFilter;
window.showAccountForm=showAccountForm;
window.loadProjects=loadProjects;
window.deleteProject=deleteProject;
window.showTaskForm=showTaskForm;
window.doTaskAction=doTaskAction;
window.doDeleteTask=doDeleteTask;
window.searchTasks=searchTasks;
window.resetTaskFilter=resetTaskFilter;
window.batchStartTasks=batchStartTasks;
window.batchStopTasks=batchStopTasks;
window.clearAllTasks=clearAllTasks;
window.exportTasks=exportTasks;
window.loadCustomers=loadCustomers;
window.deleteCustomer=deleteCustomer;
window.batchDeleteCustomers=batchDeleteCustomers;
window.batchChangeCustomerStatus=batchChangeCustomerStatus;
window.loadUsers=loadUsers;
window.showUserForm=showUserForm;
window.deleteUser=deleteUser;
window.batchDeleteUsers=batchDeleteUsers;
window.batchToggleUsers=batchToggleUsers;
window.batchSetRole=batchSetRole;
