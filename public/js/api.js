/* ============================================================
   API 层 v2.0：所有后端请求统一在此定义
   Laravel 接口走 /prod 前缀
   Flask 服务接口走 FLASK_BASE（直接到 5000 端口代理）
   ============================================================ */
const BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/prod'
  : `http://${window.location.hostname}/prod`;

// Flask 服务（Nginx 已代理 /upload /send /register 等）
const FLASK_BASE = `http://${window.location.hostname}`;

// ---------- 请求核心（Laravel） ----------
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

// ---------- Flask 请求核心 ----------
async function flaskRequest(method, path, data = null) {
  const config = { method, headers: { 'Content-Type': 'application/json' } };
  if (data && method !== 'GET') config.body = JSON.stringify(data);
  let url = FLASK_BASE + path;
  if (data && method === 'GET') url += '?' + new URLSearchParams(data);
  try {
    const res = await fetch(url, config);
    return await res.json();
  } catch(e) {
    console.error('Flask request error:', e);
    return { success: false, error: e.message };
  }
}

const get      = (path, params) => request('GET', path, params);
const post     = (path, data)   => request('POST', path, data);
const del      = (path, data)   => request('DELETE', path, data);
const fGet     = (path, params) => flaskRequest('GET', path, params);
const fPost    = (path, data)   => flaskRequest('POST', path, data);

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
  login:   (username, password) => post('/system/login', { username, password }),
  logout:  () => get('/system/logout'),
  getInfo: () => get('/system/user/getInfo'),
  menuTree:() => get('/system/menu/treeselect'),
};

// ============================================================
// 用户管理
// ============================================================
const Users = {
  list:             (p)            => get('/system/user/list', p),
  save:             (d)            => post('/system/user/save', d),
  delete:           (ids)          => del('/system/user/delete', { ids }),
  batchUpdateType:  (ids, user_type) => post('/system/user/batchUpdateUserType', { ids, user_type }),
  batchToggleStatus:(ids, status)  => post('/system/user/batchToggleStatus', { ids, status }),
  batchDelete:      (ids)          => del('/system/user/batchDelete', { ids }),
  roleList:         ()             => get('/system/role/list'),
};

// ============================================================
// 账号管理（PhoneInfo）- Laravel + Flask 双层
// ============================================================
const Accounts = {
  // Laravel CRUD
  list:         (p)   => get('/cloud/phoneinfo/index', p),
  save:         (d)   => post('/cloud/phoneinfo/save', d),
  delete:       (ids) => del('/cloud/phoneinfo/delete', { ids }),
  updateStatus: (ids, status) => post('/cloud/phoneinfo/updateStatus', { ids, status }),
  export:       (p)   => getBlob('/cloud/phoneinfo/export', p),
  import: (formData) => {
    const token = localStorage.getItem('token');
    return fetch(BASE + '/cloud/phoneinfo/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(r => r.json());
  },
  // Flask 协议层
  register:  (d)     => fPost('/api/phoneinfo/register', d),
  unregister:(phone) => fPost('/api/phoneinfo/unregister', { phone }),
  heartbeat: (phone) => fPost('/api/phoneinfo/heartbeat', { phone }),
  status:    (phone) => fGet(`/api/phoneinfo/status/${phone}`),
  onlineList:(p)     => fGet('/api/phoneinfo/list', p),
  pollMessages: (id) => fGet(`/api/messages/poll/${id}`),
};

// ============================================================
// 项目管理
// ============================================================
const Projects = {
  list:       (p)  => get('/cloud/project/index', p),
  save:       (d)  => post('/cloud/project/save', d),
  delete:     (ids)=> del('/cloud/project/delete', { ids }),
  setCurrent: (id) => post('/cloud/project/setCurrentProject', { id }),
  getCurrent: ()   => get('/cloud/project/getCurrentProject'),
};

// ============================================================
// 客户管理（UserProject）
// ============================================================
const Customers = {
  list:             (p) => get('/cloud/userProject/index', p),
  save:             (d) => post('/cloud/userProject/save', d),
  delete:           (ids) => del('/cloud/customer/delete', { ids }),
  batchChangeStatus:(d)   => post('/cloud/userProject/batchChangeStatus', d),
  assignCS:         (d)   => post('/cloud/userProject/assignCustomerServices', d),
  replenish:        (d)   => post('/cloud/userProject/replenish', d),
};

// ============================================================
// 任务管理（TcardTask）- Laravel CRUD + Flask 调度
// ============================================================
const Tasks = {
  // Laravel CRUD
  list:     (p)   => get('/TcardTask/task/index', p),
  save:     (d)   => post('/TcardTask/task/save', d),
  delete:   (ids) => del('/TcardTask/task/delete', { ids }),
  clearAll: (p)   => del('/TcardTask/task/clearAll' + (p ? '?' + new URLSearchParams(p) : '')),
  detail:   (id)  => get('/TcardTask/task/getTaskDetail', { id }),
  export:   ()    => getBlob('/TcardTask/task/export'),
  // Flask 调度层（实际驱动任务执行）
  start:    (ids)  => fPost('/api/task/start',  { ids: Array.isArray(ids) ? ids : [ids] }),
  pause:    (ids)  => fPost('/api/task/pause',  { ids: Array.isArray(ids) ? ids : [ids] }),
  resume:   (ids)  => fPost('/api/task/resume', { ids: Array.isArray(ids) ? ids : [ids] }),
  stop:     (ids)  => fPost('/api/task/stop',   { ids: Array.isArray(ids) ? ids : [ids] }),
  status:   (id)   => fGet(`/api/task/status/${id}`),
};

// ============================================================
// 批量上传
// ============================================================
const BatchTask = {
  list:   (p) => get('/batchTask/list', p),
  upload: (formData) => {
    const token = localStorage.getItem('token');
    return fetch(BASE + '/america/batchUpload/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(r => r.json());
  },
  export:   ()    => getBlob('/TcardTask/task/export'),
  clearAll: (ids) => ids ? del('/TcardTask/task/delete', { ids }) : del('/TcardTask/task/clearAll'),
};

// ============================================================
// 统计 & 概览
// ============================================================
const Stats = {
  overview:     ()  => get('/dashboard/overview'),
  userProject:  ()  => get('/dashboard/userProject'),
  data:         (p) => get('/america/data/index', p),
  taskList:     (p) => get('/america/taskList/index', p),
  dialogboxList:(p) => get('/america/dialogbox/list', p),
  health:       ()  => fGet('/health'),
};

// ============================================================
// 聊天 / 双向对话（Flask）
// ============================================================
const Chat = {
  conversations: (p)       => fGet('/api/chat/conversations', p),
  messages:      (convId, p) => fGet(`/api/chat/messages/${convId}`, p),
  send:          (d)       => fPost('/api/chat/send', d),
  markRead:      (convId)  => fPost('/api/chat/mark_read', { conversation_id: convId }),
  favorite:      (convId, is_favorite) => fPost('/api/chat/favorite', { conversation_id: convId, is_favorite }),
  webhook:       (d)       => fPost('/api/webhook/reply', d),
};

// ============================================================
// SSE 实时推送工具
// ============================================================
const SSE = {
  _sources: {},

  /**
   * 订阅 SSE 频道
   * @param {string} channel - 'tasks' | 'chat'
   * @param {function} onEvent - (event, data) => {}
   * @returns {EventSource}
   */
  subscribe(channel, onEvent) {
    this.unsubscribe(channel);
    const url = `${FLASK_BASE}/stream/${channel}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try { onEvent('message', JSON.parse(e.data)); } catch(_) {}
    };
    // 监听具名事件
    const events = [
      'task_started','task_paused','task_resumed','task_stopped','task_finished',
      'send_progress','new_message','message_sent'
    ];
    events.forEach(evt => {
      es.addEventListener(evt, (e) => {
        try { onEvent(evt, JSON.parse(e.data)); } catch(_) {}
      });
    });
    es.onerror = () => {
      console.warn(`SSE [${channel}] disconnected, will auto-reconnect...`);
    };
    this._sources[channel] = es;
    return es;
  },

  unsubscribe(channel) {
    if (this._sources[channel]) {
      this._sources[channel].close();
      delete this._sources[channel];
    }
  },

  unsubscribeAll() {
    Object.keys(this._sources).forEach(ch => this.unsubscribe(ch));
  }
};

// ============================================================
// 文件上传（Flask）
// ============================================================
const Upload = {
  image: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(FLASK_BASE + '/upload', { method: 'POST', body: fd }).then(r => r.json());
  }
};
