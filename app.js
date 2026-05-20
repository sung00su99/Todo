const SUPABASE_URL = 'https://ftmrlvcrikvrywfuygre.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0bXJsdmNyaWt2cnl3ZnV5Z3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDQ4MTAsImV4cCI6MjA5NDc4MDgxMH0.x6GQu0v1EDK66HXL_Lz5Ml8ZK4ucld5aZV5EqtxomSA';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let todos = [];
let dragId = null;
let currentUser = null;

const PRIORITY_LABEL = { high: '높음', medium: '중간', low: '낮음' };
const PRIORITY_ORDER = ['high', 'medium', 'low'];

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    location.href = 'login.html';
    return;
  }
  currentUser = session.user;

  const { data: profile } = await db.from('profiles').select('nickname').eq('id', currentUser.id).single();
  document.getElementById('user-nickname').textContent = profile?.nickname || currentUser.email;

  await loadTodos();
}

async function loadTodos() {
  const { data, error } = await db.from('todos').select('*').order('sort_order');
  if (error) { console.error(error); return; }
  todos = data;
  renderTodos();
}

function clearDragStyles() {
  document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-group')
    .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-group'));
}

function createTodoEl(todo) {
  const li = document.createElement('li');
  li.dataset.id = todo.id;
  if (todo.done) li.classList.add('done');
  li.draggable = true;

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '⠿';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.done;
  checkbox.dataset.id = todo.id;

  const badge = document.createElement('span');
  badge.className = `priority-badge ${todo.priority || 'medium'}`;
  badge.textContent = PRIORITY_LABEL[todo.priority] || '중간';

  const span = document.createElement('span');
  span.className = 'todo-text';
  span.textContent = todo.text;

  const timeInfo = document.createElement('span');
  timeInfo.className = 'time-info';
  const lines = [`저장: ${formatDate(todo.created_at)}`];
  if (todo.done && todo.done_at) lines.push(`완료: ${formatDate(todo.done_at)}`);
  timeInfo.textContent = lines.join('\n');

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '✕';
  deleteBtn.dataset.id = todo.id;

  li.appendChild(handle);
  li.appendChild(checkbox);
  li.appendChild(badge);
  li.appendChild(span);
  li.appendChild(timeInfo);
  li.appendChild(deleteBtn);

  li.addEventListener('dragstart', e => {
    dragId = todo.id;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => li.classList.add('dragging'), 0);
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    clearDragStyles();
  });

  li.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    clearDragStyles();
    const rect = li.getBoundingClientRect();
    li.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
  });

  li.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    clearDragStyles();
    if (dragId === todo.id) return;
    const rect = li.getBoundingClientRect();
    reorderTodo(dragId, todo.id, e.clientY < rect.top + rect.height / 2);
  });

  return li;
}

function renderTodos() {
  const container = document.getElementById('todo-list');
  container.innerHTML = '';

  PRIORITY_ORDER.forEach(priority => {
    const items = todos.filter(t => (t.priority || 'medium') === priority);

    const group = document.createElement('div');
    group.className = 'priority-group';

    const header = document.createElement('div');
    header.className = `group-header ${priority}`;
    header.textContent = PRIORITY_LABEL[priority];

    const ul = document.createElement('ul');
    ul.className = 'group-items';
    items.forEach(todo => ul.appendChild(createTodoEl(todo)));

    group.addEventListener('dragover', e => {
      e.preventDefault();
      clearDragStyles();
      ul.classList.add('drag-over-group');
    });

    group.addEventListener('dragleave', e => {
      if (!group.contains(e.relatedTarget)) ul.classList.remove('drag-over-group');
    });

    group.addEventListener('drop', e => {
      e.preventDefault();
      clearDragStyles();
      dropOnGroup(dragId, priority);
    });

    group.appendChild(header);
    group.appendChild(ul);
    container.appendChild(group);
  });
}

async function reorderTodo(draggedId, targetId, before) {
  const dragged = todos.find(t => t.id === draggedId);
  const target = todos.find(t => t.id === targetId);
  if (!dragged || !target) return;

  const newPriority = target.priority;
  const remaining = todos.filter(t => t.id !== draggedId);
  const targetIdx = remaining.findIndex(t => t.id === targetId);
  remaining.splice(before ? targetIdx : targetIdx + 1, 0, { ...dragged, priority: newPriority });

  const withOrders = remaining.map((t, i) => ({ ...t, sort_order: i }));

  for (const t of withOrders) {
    const orig = todos.find(o => o.id === t.id);
    if (orig && (orig.sort_order !== t.sort_order || orig.priority !== t.priority)) {
      await db.from('todos').update({ sort_order: t.sort_order, priority: t.priority }).eq('id', t.id);
    }
  }

  todos = withOrders;
  renderTodos();
}

async function dropOnGroup(draggedId, priority) {
  const dragged = todos.find(t => t.id === draggedId);
  if (!dragged || dragged.priority === priority) return;

  const remaining = todos.filter(t => t.id !== draggedId);
  const lastIdx = remaining.reduce((acc, t, i) => t.priority === priority ? i : acc, -1);
  remaining.splice(lastIdx + 1, 0, { ...dragged, priority });

  const withOrders = remaining.map((t, i) => ({ ...t, sort_order: i }));

  for (const t of withOrders) {
    const orig = todos.find(o => o.id === t.id);
    if (orig && (orig.sort_order !== t.sort_order || orig.priority !== t.priority)) {
      await db.from('todos').update({ sort_order: t.sort_order, priority: t.priority }).eq('id', t.id);
    }
  }

  todos = withOrders;
  renderTodos();
}

async function addTodo(text, priority) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const sameGroup = todos.filter(t => t.priority === priority);
  const maxOrder = sameGroup.reduce((max, t) => Math.max(max, t.sort_order ?? -1), -1);

  const { data, error } = await db.from('todos').insert({
    text: trimmed,
    done: false,
    priority,
    sort_order: maxOrder + 1,
    user_id: currentUser.id
  }).select().single();

  if (error) { console.error(error); return; }
  todos.push(data);
  renderTodos();
}

async function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  const done = !todo.done;
  const done_at = done ? new Date().toISOString() : null;

  const { error } = await db.from('todos').update({ done, done_at }).eq('id', id);
  if (error) { console.error(error); return; }

  todos = todos.map(t => t.id === id ? { ...t, done, done_at } : t);
  renderTodos();
}

async function deleteTodo(id) {
  const { error } = await db.from('todos').delete().eq('id', id);
  if (error) { console.error(error); return; }
  todos = todos.filter(t => t.id !== id);
  renderTodos();
}

document.getElementById('todo-list').addEventListener('click', e => {
  const id = e.target.dataset.id;
  if (!id) return;
  if (e.target.type === 'checkbox') toggleTodo(id);
  if (e.target.classList.contains('delete-btn')) deleteTodo(id);
});

document.getElementById('add-btn').addEventListener('click', () => {
  const input = document.getElementById('todo-input');
  const priority = document.getElementById('priority-select').value;
  addTodo(input.value, priority);
  input.value = '';
});

document.getElementById('todo-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const priority = document.getElementById('priority-select').value;
    addTodo(e.target.value, priority);
    e.target.value = '';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await db.auth.signOut();
  location.href = 'login.html?logout=1';
});

initAuth();
