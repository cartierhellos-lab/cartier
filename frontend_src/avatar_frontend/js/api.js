/* ============================================================
   API 层：所有后端请求统一在此定义
   baseURL 自动适配：本机走 /prod，外网走 http://IP/prod
   ============================================================ */

const BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/prod'
  : `http://${window.location.hostname}/prod`;

// ---------- 请求核心 ----------
async function request(method, path, data = null, opts = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (data && method !== 'GET') config.body = JSON.stringify(data);

  let url = BASE + path;
  if (data && method === 'GET') {
    const params = new URLSearchParams(data);
    url += '?' + params.toString();
  }

  const res = await fetch(url, config);

  // blob 下载（CSV export）
  if (opts.blob) return res.blob();

  const json = await res.json();
  if (json.code === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    location.hash = '#/login';
    return null;
  }
  return json;
}

const get  = (path, params) => request('GET', path, params);
const post = (path, data)   => request('POST', path, data);
const del  = (path, data)   => request('DELETE', path, data);
const getBlob = (path, params) => {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  let url = BASE + path;
  if (params) url += '?' + new URLSearchParams(params);
  return fetch(url, { headers }).then(r => r.blob());
};

// ============================================================
// Auth
// ============================================================
const Auth = {
  login: (username, password) => post('/system/login', { username, password }),
  logout: () => get('/system/logout'),
  getInfo: () => get('/system/user/getInfo'),
  menuTree: () => get('/system/menu/treeselect'),
};

// ============================================================
// 用户管理
// ============================================================
const Users = {
  list: (p) => get('/system/user/list', p),
  save: (d) => post('/system/user/save', d),
  delete: (ids) => del('/system/user/delete', { ids }),
  batchUpdateType: (ids, user_type) => post('/system/user/batchUpdateUserType', { ids, user_type }),
  batchToggleStatus: (ids, status) => post('/system/user/batchToggleStatus', { ids, status }),
  batchDelete: (ids) => del('/system/user/batchDelete', { ids }),
  roleList: () => get('/system/role/list'),
};

// ============================================================
// 账号管理（PhoneInfo）
// ============================================================
const Accounts = {
  list: (p) => get('/cloud/phoneinfo/index', p),
  save: (d) => post('/cloud/phoneinfo/save', d),
  delete: (ids) => del('/cloud/phoneinfo/delete', { ids }),
  updateStatus: (ids, status) => post('/cloud/phoneinfo/updateStatus', { ids, status }),
  export: (p) => getBlob('/cloud/phoneinfo/export', p),
  import: (formData) => {
    const token = localStorage.getItem('token');
    return fetch(BASE + '/cloud/phoneinfo/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(r => r.json());
  },
};

// ============================================================
// 项目管理
// ============================================================
const Projects = {
  list: (p) => get('/cloud/project/index', p),
  save: (d) => post('/cloud/project/save', d),
  delete: (ids) => del('/cloud/project/delete', { ids }),
  setCurrent: (id) => post('/cloud/project/setCurrentProject', { id }),
  getCurrent: () => get('/cloud/project/getCurrentProject'),
};

// ============================================================
// 客户管理（UserProject）
// ============================================================
const Customers = {
  list: (p) => get('/cloud/userProject/index', p),
  save: (d) => post('/cloud/userProject/save', d),
  delete: (ids) => del('/cloud/customer/delete', { ids }),
  batchChangeStatus: (d) => post('/cloud/userProject/batchChangeStatus', d),
  assignCS: (d) => post('/cloud/userProject/assignCustomerServices', d),
  replenish: (d) => post('/cloud/userProject/replenish', d),
};

// ============================================================
// 任务管理（TcardTask）
// ============================================================
const Tasks = {
  list: (p) => get('/TcardTask/task/index', p),
  save: (d) => post('/TcardTask/task/save', d),
  delete: (ids) => del('/TcardTask/task/delete', { ids }),
  clearAll: (p) => del('/TcardTask/task/clearAll' + (p ? '?' + new URLSearchParams(p) : '')),
  start: (ids) => post('/TcardTask/task/start', { ids }),
  stop: (ids) => post('/TcardTask/task/stop', { ids }),
  detail: (id) => get('/TcardTask/task/getTaskDetail', { id }),
  export: () => getBlob('/TcardTask/task/export'),
};

// ============================================================
// 批量上传
// ============================================================
const BatchTask = {
  list: (p) => get('/batchTask/list', p),
  upload: (formData) => {
    const token = localStorage.getItem('token');
    return fetch(BASE + '/america/batchUpload/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(r => r.json());
  },
  export: () => getBlob('/TcardTask/task/export'),
  clearAll: (ids) => ids ? del('/TcardTask/task/delete', { ids }) : del('/TcardTask/task/clearAll'),
};

// ============================================================
// 统计 & 概览
// ============================================================
const Stats = {
  overview: () => get('/dashboard/overview'),
  userProject: () => get('/dashboard/userProject'),
  data: (p) => get('/america/data/index', p),
  taskList: (p) => get('/america/taskList/index', p),
  dialogboxList: (p) => get('/america/dialogbox/list', p),
};

window.API = { Auth, Users, Accounts, Projects, Customers, Tasks, BatchTask, Stats, BASE };
