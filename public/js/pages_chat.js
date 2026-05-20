/* ============================================================
   pages_chat_patch.js — 聊天双向对话 & 任务实时进度 补丁
   注入点：在 index.html 中 pages.js 之后加载本文件
   ============================================================ */

// ============================================================
// 任务管理 —— 启动/暂停/停止接入 Flask 调度器 + SSE 实时进度
// ============================================================

// 覆写任务启动按钮行为（原 pages.js 里 start 调用 Laravel，现改为 Flask）
window._taskSseInit = false;
function ensureTaskSSE() {
  if (window._taskSseInit) return;
  window._taskSseInit = true;
  SSE.subscribe('tasks', (evt, data) => {
    const map = {
      task_started:  '🟢 任务已启动',
      task_paused:   '⏸ 任务已暂停',
      task_resumed:  '▶️ 任务已恢复',
      task_stopped:  '⏹ 任务已停止',
      task_finished: '✅ 任务已完成',
    };
    if (map[evt]) {
      toast(map[evt] + (data.task_id ? `（ID: ${data.task_id}）` : ''), 'success');
      // 刷新任务列表（如果当前在任务页）
      if (typeof reloadTasks === 'function') reloadTasks();
    }
    if (evt === 'send_progress') {
      _updateTaskProgress(data);
    }
  });
}

function _updateTaskProgress(data) {
  const bar = document.getElementById(`progress-${data.task_id}`);
  if (!bar) return;
  const task = window._taskProgressMap && window._taskProgressMap[data.task_id];
  if (task) {
    task.done = (task.done || 0) + 1;
    const pct = Math.min(Math.round(task.done / task.total * 100), 100);
    bar.style.width = pct + '%';
    bar.title = `${task.done}/${task.total} (${pct}%)`;
  }
}

// Flask 调度接入
window.flaskStartTask = async function(ids) {
  ensureTaskSSE();
  const res = await Tasks.start(ids);
  if (res?.success) toast('任务已启动', 'success');
  else toast('启动失败: ' + (res?.error || ''), 'error');
};
window.flaskPauseTask = async function(ids) {
  const res = await Tasks.pause(ids);
  if (res?.success) toast('任务已暂停', 'success');
};
window.flaskResumeTask = async function(ids) {
  const res = await Tasks.resume(ids);
  if (res?.success) toast('任务已恢复', 'success');
};
window.flaskStopTask = async function(ids) {
  const res = await Tasks.stop(ids);
  if (res?.success) toast('任务已停止', 'success');
};

// ============================================================
// 聊天页面（双向对话）
// ============================================================
let _chatConvList = [];
let _chatCurrentConv = null;
let _chatPage = 1;

async function renderChat() {
  if (typeof setPageTitle === 'function') setPageTitle('双向聊天');
  if (typeof document !== 'undefined') {
    const ha = document.getElementById('header-actions');
    if (ha) ha.innerHTML = `
      <button class="btn btn-sm btn-secondary" onclick="loadChatConversations()">🔄 刷新</button>
      <button class="btn btn-sm btn-secondary" onclick="pollSelectedAccount()">📥 拉取消息</button>`;
  }

  document.getElementById('content').innerHTML = `
    <div class="chat-layout">
      <!-- 会话列表 -->
      <div class="chat-sidebar" id="chat-sidebar">
        <div class="chat-sidebar-header">
          <input id="chat-search" placeholder="搜索会话..." oninput="filterConversations(this.value)" style="width:100%;"/>
        </div>
        <div id="conv-list"><div class="empty-tip" style="padding:20px;text-align:center;">加载中...</div></div>
      </div>
      <!-- 聊天主区域 -->
      <div class="chat-main" id="chat-main">
        <div class="chat-empty-state">
          <div style="font-size:48px">💬</div>
          <p>选择一个会话开始聊天</p>
        </div>
      </div>
    </div>`;

  // 注入聊天专用样式（仅注入一次）
  if (!document.getElementById('chat-style')) {
    const style = document.createElement('style');
    style.id = 'chat-style';
    style.textContent = `
      .chat-layout { display:flex; height:calc(100vh - 120px); gap:0; overflow:hidden; }
      .chat-sidebar { width:280px; min-width:220px; border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--bg-card); }
      .chat-sidebar-header { padding:12px; border-bottom:1px solid var(--border); }
      .chat-sidebar-header input { padding:8px 12px; border:1px solid var(--border); border-radius:8px; width:100%; box-sizing:border-box; background:var(--bg); color:var(--text); }
      #conv-list { flex:1; overflow-y:auto; }
      .conv-item { padding:12px 14px; cursor:pointer; border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:4px; transition:background .15s; }
      .conv-item:hover { background:var(--bg-hover,rgba(99,102,241,.08)); }
      .conv-item.active { background:rgba(99,102,241,.15); border-left:3px solid var(--accent); }
      .conv-item-header { display:flex; justify-content:space-between; align-items:center; }
      .conv-name { font-weight:600; font-size:14px; }
      .conv-badge { background:var(--danger); color:#fff; font-size:11px; border-radius:10px; padding:1px 6px; min-width:18px; text-align:center; }
      .conv-last { font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .conv-time { font-size:11px; color:var(--text-muted); }
      .chat-main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
      .chat-empty-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); gap:12px; }
      .chat-header { padding:12px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px; background:var(--bg-card); }
      .chat-title { font-weight:600; font-size:15px; }
      .chat-subtitle { font-size:12px; color:var(--text-muted); }
      .chat-actions { margin-left:auto; display:flex; gap:8px; }
      .chat-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }
      .msg-row { display:flex; align-items:flex-end; gap:8px; }
      .msg-row.out { flex-direction:row-reverse; }
      .msg-bubble { max-width:65%; padding:10px 14px; border-radius:18px; font-size:14px; line-height:1.5; word-break:break-word; }
      .msg-row.in  .msg-bubble { background:var(--bg-card); border:1px solid var(--border); border-bottom-left-radius:4px; }
      .msg-row.out .msg-bubble { background:var(--accent); color:#fff; border-bottom-right-radius:4px; }
      .msg-time { font-size:11px; color:var(--text-muted); white-space:nowrap; }
      .chat-input-area { padding:12px 16px; border-top:1px solid var(--border); background:var(--bg-card); }
      .chat-input-row { display:flex; gap:8px; align-items:flex-end; }
      .chat-input-row textarea { flex:1; border:1px solid var(--border); border-radius:10px; padding:10px 14px; resize:none; font-size:14px; background:var(--bg); color:var(--text); max-height:120px; min-height:44px; }
      .chat-input-row textarea:focus { outline:none; border-color:var(--accent); }
      .favorite-star { cursor:pointer; font-size:18px; color:var(--text-muted); transition:.15s; }
      .favorite-star.active { color:#f59e0b; }
    `;
    document.head.appendChild(style);
  }

  await loadChatConversations();
  // 订阅 SSE 聊天事件
  SSE.subscribe('chat', (evt, data) => {
    if (evt === 'new_message') {
      _onNewChatMessage(data);
    }
    if (evt === 'message_sent') {
      // 消息发送确认，可更新气泡状态
    }
  });
}
window.renderChat = renderChat;

async function loadChatConversations() {
  const res = await Chat.conversations({ page: 1, size: 50 }).catch(() => null);
  _chatConvList = res?.data || [];
  renderConvList(_chatConvList);
}
window.loadChatConversations = loadChatConversations;

function filterConversations(kw) {
  const filtered = _chatConvList.filter(c =>
    (c.other_number || '').includes(kw) || (c.last_message || '').includes(kw)
  );
  renderConvList(filtered);
}
window.filterConversations = filterConversations;

function renderConvList(list) {
  const el = document.getElementById('conv-list');
  if (!el) return;
  if (!list || list.length === 0) {
    el.innerHTML = `<div class="empty-tip" style="padding:20px;text-align:center;color:var(--text-muted)">暂无会话</div>`;
    return;
  }
  el.innerHTML = list.map(c => `
    <div class="conv-item ${_chatCurrentConv?.id === c.id ? 'active' : ''}" onclick="openConversation(${c.id})">
      <div class="conv-item-header">
        <span class="conv-name">${c.other_number || '未知号码'}</span>
        <span style="display:flex;align-items:center;gap:4px;">
          ${c.is_favorite ? '<span title="已收藏">⭐</span>' : ''}
          ${c.unread_count > 0 ? `<span class="conv-badge">${c.unread_count}</span>` : ''}
        </span>
      </div>
      <div class="conv-last">${escHtml(c.last_message || '')}</div>
      <div class="conv-time">${fmtDate(c.last_message_at || c.updated_at)}</div>
    </div>`).join('');
}

async function openConversation(convId) {
  const conv = _chatConvList.find(c => c.id === convId);
  if (!conv) return;
  _chatCurrentConv = conv;

  // 标记已读
  await Chat.markRead(convId).catch(() => {});
  conv.unread_count = 0;
  renderConvList(_chatConvList);

  const main = document.getElementById('chat-main');
  if (!main) return;
  main.innerHTML = `
    <div class="chat-header">
      <div>
        <div class="chat-title">📱 ${conv.other_number || '未知'}</div>
        <div class="chat-subtitle">发件号：${conv.my_number || '-'} | 项目 #${conv.project_id || '-'}</div>
      </div>
      <div class="chat-actions">
        <span class="favorite-star ${conv.is_favorite ? 'active' : ''}" title="收藏" onclick="toggleFavorite(${conv.id}, ${conv.is_favorite ? 0 : 1}, this)">★</span>
        <button class="btn btn-sm btn-secondary" onclick="loadChatMessages(${conv.id})">🔄</button>
      </div>
    </div>
    <div class="chat-messages" id="chat-msg-list">
      <div class="empty-tip" style="text-align:center;padding:20px;">加载中...</div>
    </div>
    <div class="chat-input-area">
      <div class="chat-input-row">
        <textarea id="chat-input" placeholder="输入消息，Ctrl+Enter 发送..." onkeydown="chatInputKeydown(event, ${conv.id})"></textarea>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="sendChatMsg(${conv.id})">发送</button>
          <button class="btn btn-secondary btn-sm" onclick="uploadAndSendImg(${conv.id})">📷</button>
        </div>
      </div>
    </div>`;

  await loadChatMessages(convId);
}
window.openConversation = openConversation;

async function loadChatMessages(convId) {
  const res = await Chat.messages(convId, { page: 1, size: 50 }).catch(() => null);
  const msgs = res?.data || [];
  const el = document.getElementById('chat-msg-list');
  if (!el) return;
  if (!msgs.length) {
    el.innerHTML = `<div class="empty-tip" style="text-align:center;padding:20px;color:var(--text-muted);">暂无消息记录</div>`;
    return;
  }
  el.innerHTML = msgs.map(m => {
    const isOut = m.direction === 2; // 2=客服发出
    return `
      <div class="msg-row ${isOut ? 'out' : 'in'}">
        <div class="msg-bubble">${escHtml(m.content || '')}</div>
        <div class="msg-time">${fmtDate(m.send_at || m.created_at)}</div>
      </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}
window.loadChatMessages = loadChatMessages;

async function sendChatMsg(convId) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) { toast('请输入消息内容', 'warning'); return; }

  const btn = input.parentElement?.querySelector('.btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '发送中...'; }
  const res = await Chat.send({ conversation_id: convId, content }).catch(() => null);
  if (btn) { btn.disabled = false; btn.textContent = '发送'; }

  if (res?.success) {
    input.value = '';
    toast('发送成功', 'success');
    await loadChatMessages(convId);
    // 更新会话最后消息
    const conv = _chatConvList.find(c => c.id === convId);
    if (conv) { conv.last_message = content; renderConvList(_chatConvList); }
  } else {
    toast('发送失败：' + (res?.error || '未知错误'), 'error');
  }
}
window.sendChatMsg = sendChatMsg;

function chatInputKeydown(e, convId) {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    sendChatMsg(convId);
  }
}
window.chatInputKeydown = chatInputKeydown;

async function toggleFavorite(convId, newVal, el) {
  await Chat.favorite(convId, newVal).catch(() => {});
  el.classList.toggle('active', newVal === 1);
  el.setAttribute('onclick', `toggleFavorite(${convId}, ${newVal ? 0 : 1}, this)`);
  const conv = _chatConvList.find(c => c.id === convId);
  if (conv) conv.is_favorite = newVal;
}
window.toggleFavorite = toggleFavorite;

async function uploadAndSendImg(convId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    toast('上传图片中...', 'info');
    const res = await Upload.image(file).catch(() => null);
    if (!res?.success) { toast('图片上传失败', 'error'); return; }
    const imgUrl = res.url;
    toast('发送图片中...', 'info');
    const sr = await Chat.send({ conversation_id: convId, content: imgUrl, msg_type: 'image', img_url: imgUrl }).catch(() => null);
    if (sr?.success) { toast('图片发送成功', 'success'); await loadChatMessages(convId); }
    else toast('图片发送失败', 'error');
  };
  input.click();
}
window.uploadAndSendImg = uploadAndSendImg;

function _onNewChatMessage(data) {
  // SSE 收到新消息
  const conv = _chatConvList.find(c => c.id === data.conversation_id);
  if (conv) {
    conv.last_message = data.content;
    conv.unread_count = (conv.unread_count || 0) + 1;
    renderConvList(_chatConvList);
  } else {
    // 新会话，刷新列表
    loadChatConversations();
  }
  // 如果正在看这个会话，自动追加消息
  if (_chatCurrentConv?.id === data.conversation_id) {
    const el = document.getElementById('chat-msg-list');
    if (el) {
      const div = document.createElement('div');
      div.className = 'msg-row in';
      div.innerHTML = `
        <div class="msg-bubble">${escHtml(data.content)}</div>
        <div class="msg-time">${data.received_at || ''}</div>`;
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
    }
    // 自动标记已读
    Chat.markRead(data.conversation_id).catch(() => {});
  } else {
    toast(`💬 新消息：${data.from_number} → ${escHtml(data.content?.slice(0,30))}`, 'info');
  }
}

// 拉取当前选中账号的新消息
async function pollSelectedAccount() {
  if (!_chatCurrentConv) { toast('请先选择一个会话', 'warning'); return; }
  const res = await Accounts.pollMessages(_chatCurrentConv.phoneinfo_id).catch(() => null);
  if (res?.success) {
    toast(`拉取完成，新消息 ${res.saved} 条`, 'success');
    await loadChatMessages(_chatCurrentConv.id);
    await loadChatConversations();
  } else {
    toast('拉取失败', 'error');
  }
}
window.pollSelectedAccount = pollSelectedAccount;

// ============================================================
// 辅助：转义 HTML
// ============================================================
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
