const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  consultations: [],
  activeConsultationId: null,
  pollTimer: null,
};

const el = (id) => document.getElementById(id);

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.details?.[0]
      ? `${json.error.details[0].path}: ${json.error.details[0].message}`
      : json?.error?.message || 'Something went wrong';
    const err = new Error(message);
    err.code = json?.error?.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

function setSession(token, user) {
  state.token = token;
  state.user = user;
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

function showError(id, message) {
  const node = el(id);
  node.textContent = message;
  node.classList.remove('hidden');
}

function clearError(id) {
  el(id).classList.add('hidden');
}

// ---- screen switching ----

function showAuthScreen() {
  el('authScreen').classList.remove('hidden');
  el('appScreen').classList.add('hidden');
  el('userBox').classList.add('hidden');
  stopPolling();
}

function showAppScreen() {
  el('authScreen').classList.add('hidden');
  el('appScreen').classList.remove('hidden');
  el('userBox').classList.remove('hidden');
  el('userName').textContent = state.user.name;
  el('userRole').textContent = state.user.role;

  const isDoctor = state.user.role === 'DOCTOR';
  el('doctorsTabBtn').classList.toggle('hidden', isDoctor);
  switchAppTab(isDoctor ? 'consultationsPanel' : 'doctorsPanel');

  if (!isDoctor) loadDoctors();
  loadConsultations();
}

document.querySelectorAll('#authScreen .tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#authScreen .tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    el('loginForm').classList.toggle('hidden', btn.dataset.tab !== 'login');
    el('registerForm').classList.toggle('hidden', btn.dataset.tab !== 'register');
  });
});

function switchAppTab(panelId) {
  document.querySelectorAll('.app-tabs .tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.panel === panelId);
  });
  document.querySelectorAll('.app-screen > .panel').forEach((p) => {
    p.classList.toggle('hidden', p.id !== panelId);
  });
}

document.querySelectorAll('.app-tabs .tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchAppTab(btn.dataset.panel));
});

// ---- auth ----

el('roleSelect').addEventListener('change', (e) => {
  el('doctorFields').classList.toggle('hidden', e.target.value !== 'DOCTOR');
});

el('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('loginError');
  const form = new FormData(e.target);
  try {
    const { data } = await api('/auth/login', {
      method: 'POST',
      body: { email: form.get('email'), password: form.get('password') },
    });
    setSession(data.token, data.user);
    showAppScreen();
  } catch (err) {
    showError('loginError', err.message);
  }
});

el('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('registerError');
  const form = new FormData(e.target);
  const role = form.get('role');
  const body = {
    name: form.get('name'),
    email: form.get('email'),
    password: form.get('password'),
    role,
  };
  if (role === 'DOCTOR') {
    body.specialization = form.get('specialization');
    body.yearsOfExperience = Number(form.get('yearsOfExperience'));
  }
  try {
    await api('/auth/register', { method: 'POST', body });
    const { data } = await api('/auth/login', {
      method: 'POST',
      body: { email: body.email, password: body.password },
    });
    setSession(data.token, data.user);
    showAppScreen();
  } catch (err) {
    showError('registerError', err.message);
  }
});

el('logoutBtn').addEventListener('click', () => {
  setSession(null, null);
  showAuthScreen();
});

// ---- doctors ----

async function loadDoctors(specialization) {
  clearError('doctorsError');
  try {
    const { data } = await api(
      `/doctors${specialization ? `?specialization=${encodeURIComponent(specialization)}` : ''}`,
    );
    renderDoctors(data);
  } catch (err) {
    showError('doctorsError', err.message);
  }
}

function renderDoctors(doctors) {
  const list = el('doctorsList');
  list.innerHTML = '';
  if (doctors.length === 0) {
    list.innerHTML = '<p class="chat-empty">No doctors found.</p>';
    return;
  }
  for (const doc of doctors) {
    const card = document.createElement('div');
    card.className = 'card doctor-card';
    card.innerHTML = `
      <h3>${escapeHtml(doc.name)}</h3>
      <span class="specialization">${escapeHtml(doc.specialization)}</span>
      <span class="experience">${doc.yearsOfExperience} years experience</span>
    `;
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.textContent = 'Start consultation';
    btn.addEventListener('click', () => startConsultation(doc.id));
    card.appendChild(btn);
    list.appendChild(card);
  }
}

let filterTimer;
el('specializationFilter').addEventListener('input', (e) => {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => loadDoctors(e.target.value.trim()), 250);
});

async function startConsultation(doctorId) {
  try {
    await api('/consultations', { method: 'POST', body: { doctorId } });
  } catch (err) {
    if (err.code !== 'DUPLICATE_CONSULTATION') {
      showError('doctorsError', err.message);
      return;
    }
  }
  await loadConsultations();
  switchAppTab('consultationsPanel');
  const existing = state.consultations.find((c) => c.doctor.id === doctorId);
  if (existing) openConsultation(existing.id);
}

// ---- consultations ----

async function loadConsultations() {
  clearError('consultationsError');
  try {
    const { data } = await api('/consultations?limit=100');
    state.consultations = data;
    renderConsultations();
  } catch (err) {
    showError('consultationsError', err.message);
  }
}

function counterpart(consultation) {
  return state.user.role === 'PATIENT' ? consultation.doctor : consultation.patient;
}

function renderConsultations() {
  const list = el('consultationsList');
  list.innerHTML = '';
  if (state.consultations.length === 0) {
    list.innerHTML = '<p class="chat-empty">No consultations yet.</p>';
    return;
  }
  for (const c of state.consultations) {
    const li = document.createElement('li');
    li.className = 'consult-item' + (c.id === state.activeConsultationId ? ' active' : '');
    li.innerHTML = `
      <span class="name">${escapeHtml(counterpart(c).name)}</span>
      <span class="badge status-${c.status.toLowerCase()}">${c.status}</span>
      <span class="date">${new Date(c.createdAt).toLocaleDateString()}</span>
    `;
    li.addEventListener('click', () => openConsultation(c.id));
    list.appendChild(li);
  }
}

async function openConsultation(id) {
  state.activeConsultationId = id;
  renderConsultations();
  el('chatEmpty').classList.add('hidden');
  el('chatPanel').classList.remove('hidden');
  await renderChatHeader();
  await loadMessages();
  startPolling();
}

async function renderChatHeader() {
  const consultation = state.consultations.find((c) => c.id === state.activeConsultationId);
  if (!consultation) return;
  el('chatCounterpart').textContent = counterpart(consultation).name;
  el('chatStatus').textContent = consultation.status;
  el('chatStatus').className = `badge status-${consultation.status.toLowerCase()}`;

  const isCompleted = consultation.status === 'COMPLETED';
  el('chatInput').disabled = isCompleted;
  el('chatForm').querySelector('button').disabled = isCompleted;
  el('chatClosedNote').classList.toggle('hidden', !isCompleted);

  const actions = el('doctorActions');
  actions.innerHTML = '';
  actions.classList.add('hidden');
  if (state.user.role === 'DOCTOR' && !isCompleted) {
    const next = consultation.status === 'PENDING' ? 'ACTIVE' : 'COMPLETED';
    const label = next === 'ACTIVE' ? 'Mark active' : 'Mark completed';
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.textContent = label;
    btn.addEventListener('click', () => updateStatus(next));
    actions.appendChild(btn);
    actions.classList.remove('hidden');
  }
}

async function updateStatus(status) {
  try {
    const { data } = await api(`/consultations/${state.activeConsultationId}/status`, {
      method: 'PATCH',
      body: { status },
    });
    const idx = state.consultations.findIndex((c) => c.id === data.id);
    if (idx !== -1) state.consultations[idx] = data;
    renderConsultations();
    await renderChatHeader();
  } catch (err) {
    showError('consultationsError', err.message);
  }
}

// ---- messages ----

async function loadMessages() {
  try {
    const { data } = await api(`/consultations/${state.activeConsultationId}/messages?limit=100`);
    renderMessages(data);
  } catch {
    // polling failure is silent — the panel just keeps its last known state
  }
}

function renderMessages(messages) {
  const box = el('chatMessages');
  const wasAtBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20;
  box.innerHTML = '';
  for (const m of messages) {
    const bubble = document.createElement('div');
    bubble.className = 'msg ' + (m.senderId === state.user.id ? 'mine' : 'theirs');
    const time = new Date(m.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    bubble.innerHTML = `${escapeHtml(m.content)}<span class="meta">${time}</span>`;
    box.appendChild(bubble);
  }
  if (wasAtBottom || messages.length <= 1) box.scrollTop = box.scrollHeight;
}

el('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = el('chatInput');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    await api(`/consultations/${state.activeConsultationId}/messages`, {
      method: 'POST',
      body: { content },
    });
    await loadMessages();
  } catch (err) {
    showError('consultationsError', err.message);
  }
});

function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(loadMessages, 4000);
}

function stopPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = null;
}

// ---- utils ----

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- boot ----

(async function init() {
  if (!state.token) {
    showAuthScreen();
    return;
  }
  try {
    const { data } = await api('/profile');
    state.user = data;
    showAppScreen();
  } catch {
    setSession(null, null);
    showAuthScreen();
  }
})();
