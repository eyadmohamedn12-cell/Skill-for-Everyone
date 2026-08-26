// ==========================================
// 1. CONFIG & STATE
// ==========================================
// رابط السيرفر الخاص بك من Cloudflare Worker
const API_URL = "https://skill-for-everyone-api.eyadmohamedn12.workers.dev";

let state = {
  users: JSON.parse(localStorage.getItem('sfe_users')) || [],
  currentUser: JSON.parse(localStorage.getItem('sfe_current_user')) || null,
  skills: [],
  exchanges: JSON.parse(localStorage.getItem('sfe_exchanges')) || [],
  activeExchangeTab: 'all',
  selectedSkillForExchange: null
};

function saveState() {
  localStorage.setItem('sfe_users', JSON.stringify(state.users));
  localStorage.setItem('sfe_current_user', JSON.stringify(state.currentUser));
  localStorage.setItem('sfe_exchanges', JSON.stringify(state.exchanges));
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==========================================
// 2. API CALLS (CLOUDFLARE WORKER)
// ==========================================
async function fetchSkillsFromServer() {
  try {
    const res = await fetch(`${API_URL}/api/skills`);
    if (res.ok) {
      state.skills = await res.json();
    }
  } catch (err) {
    console.error("Error fetching skills:", err);
  } finally {
    renderDiscovery();
  }
}

// ==========================================
// 3. NAVIGATION & ROUTING
// ==========================================
function go(pageId) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.remove('active'));

  const appShell = document.getElementById('app-shell');
  const publicPages = ['welcome', 'login', 'signup'];

  if (publicPages.includes(pageId)) {
    if (appShell) appShell.style.display = 'none';
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.add('active');
  } else {
    if (!state.currentUser) {
      showToast('Please log in first.');
      go('login');
      return;
    }
    if (appShell) appShell.style.display = 'flex';
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.topbar__nav button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === pageId);
    });

    if (pageId === 'home') renderHome();
    if (pageId === 'discovery') fetchSkillsFromServer();
    if (pageId === 'exchanged') renderExchanged();
    if (pageId === 'upload') renderUpload();
  }
}

// ==========================================
// 4. AUTHENTICATION
// ==========================================
function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const errorEl = document.getElementById('loginError');

  const user = state.users.find(u => u.email === email && u.password === password);
  if (!user) {
    if (errorEl) errorEl.textContent = 'Invalid email or password.';
    return false;
  }

  state.currentUser = user;
  saveState();
  updateUserUI();
  form.reset();
  if (errorEl) errorEl.textContent = '';
  showToast(`Welcome back, ${state.currentUser.name}!`);
  go('home');
  return false;
}

function handleSignup(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const errorEl = document.getElementById('signupError');

  if (state.users.some(u => u.email === email)) {
    if (errorEl) errorEl.textContent = 'Email already registered.';
    return false;
  }

  const newUser = { id: 'usr_' + Date.now(), name, email, password };
  state.users.push(newUser);
  state.currentUser = newUser;
  saveState();
  updateUserUI();
  form.reset();
  if (errorEl) errorEl.textContent = '';
  showToast('Account created successfully!');
  go('home');
  return false;
}

function handleLogout() {
  state.currentUser = null;
  saveState();
  updateUserUI();
  showToast('Logged out.');
  go('welcome');
}

function updateUserUI() {
  const topbarUser = document.getElementById('topbarUserName');
  const homeUser = document.getElementById('homeUserName');
  const name = state.currentUser ? state.currentUser.name : 'Guest';
  if (topbarUser) topbarUser.textContent = name;
  if (homeUser) homeUser.textContent = name;
}

// ==========================================
// 5. HOME & DISCOVERY RENDER
// ==========================================
function renderHome() {
  updateUserUI();
  if (!state.currentUser) return;

  const mySkillsCount = state.skills.filter(s => s.ownerId === state.currentUser.id).length;
  const myExchanges = state.exchanges.filter(
    x => x.fromUserId === state.currentUser.id || x.toUserId === state.currentUser.id
  );
  const pendingCount = myExchanges.filter(x => x.status === 'Pending').length;
  const doneCount = myExchanges.filter(x => x.status === 'Completed').length;

  const elMySkills = document.getElementById('statMySkills');
  const elPending = document.getElementById('statPending');
  const elDone = document.getElementById('statDone');

  if (elMySkills) elMySkills.textContent = mySkillsCount;
  if (elPending) elPending.textContent = pendingCount;
  if (elDone) elDone.textContent = doneCount;
}

function renderDiscovery() {
  const grid = document.getElementById('discoveryGrid');
  if (!grid) return;

  const search = (document.getElementById('discoverySearch')?.value || '').toLowerCase();
  const filter = document.getElementById('discoveryFilter')?.value || '';

  const filtered = state.skills.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(search) || 
                          s.description.toLowerCase().includes(search) ||
                          s.ownerName.toLowerCase().includes(search);
    const matchesFilter = !filter || s.category === filter;
    return matchesSearch && matchesFilter;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No skills found matching your search.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(skill => `
    <div class="skill-card">
      <div class="skill-card__header">
        <span class="skill-card__tag">${escapeHtml(skill.category)}</span>
        <span class="skill-card__level">${escapeHtml(skill.level)}</span>
      </div>
      <h3 class="skill-card__title">${escapeHtml(skill.title)}</h3>
      <p class="skill-card__desc">${escapeHtml(skill.description)}</p>
      <div class="skill-card__footer">
        <span class="skill-card__owner">Offered by <strong>${escapeHtml(skill.ownerName)}</strong></span>
        ${state.currentUser && state.currentUser.id !== skill.ownerId ? `
          <button class="btn btn--primary btn--block" onclick="openExchange('${skill.id}')">Exchange</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// ==========================================
// 6. UPLOAD SKILLS
// ==========================================
async function handleUploadSkill(e) {
  e.preventDefault();
  if (!state.currentUser) {
    showToast('Please log in first.');
    return false;
  }

  const form = e.target;
  const title = form.title.value.trim();
  const category = form.category.value;
  const level = form.level.value;
  const description = form.description.value.trim();
  const errorEl = document.getElementById('uploadError');

  if (!title || !category || !level || !description) {
    if (errorEl) errorEl.textContent = 'Please fill out all fields.';
    return false;
  }

  const newSkill = {
    id: 'skl_' + Date.now(),
    title,
    category,
    level,
    description,
    ownerId: state.currentUser.id,
    ownerName: state.currentUser.name,
    createdAt: new Date().toISOString()
  };

  // 1. الحفظ محلياً على جهازك
  state.skills.push(newSkill);
  saveState();

  // 2. إرسال البيانات للسيرفر عشان تظهر لباقي المستخدمين
  try {
    const res = await fetch(`${API_URL}/api/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSkill)
    });
    if (!res.ok) {
      console.log("Server rejected the skill:", res.status);
    }
  } catch (err) {
    console.log("Server sync error:", err);
  }

  // 3. تحديث القائمة من السيرفر عشان تفضل متزامنة مع باقي المستخدمين
  fetchSkillsFromServer();

  form.reset();
  if (errorEl) errorEl.textContent = '';
  showToast('Skill listed successfully!');
  renderUpload();
  renderDiscovery();
  return false;
}
function renderUpload() {
  const grid = document.getElementById('mySkillsGrid');
  if (!grid || !state.currentUser) return;

  const mySkills = state.skills.filter(s => s.ownerId === state.currentUser.id);

  if (mySkills.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">You haven't listed any skills yet.</p>`;
    return;
  }

  grid.innerHTML = mySkills.map(s => `
    <div class="skill-card" style="margin-top: 1rem;">
      <div class="skill-card__header">
        <span class="skill-card__tag">${escapeHtml(s.category)}</span>
        <span class="skill-card__level">${escapeHtml(s.level)}</span>
      </div>
      <h4 class="skill-card__title">${escapeHtml(s.title)}</h4>
      <p class="skill-card__desc">${escapeHtml(s.description)}</p>
    </div>
  `).join('');
}

// ==========================================
// 7. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  fetchSkillsFromServer();
  if (state.currentUser) {
    go('home');
  } else {
    go('welcome');
  }
});