// ── 가족 멤버 관리 ─────────────────────────────────────────────
// members.js — index.html 전용. add.html은 localStorage 직접 읽음.

const MEMBER_KEY = 'library_current_member';
let currentMember = null;
let allMembers = [];

// shared utility (library.js보다 먼저 로드됨)
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 초기화 ────────────────────────────────────────────────────
async function initMembers() {
  await loadMembers();
  const saved = localStorage.getItem(MEMBER_KEY);
  if (saved && allMembers.some(m => m.name === saved)) {
    currentMember = saved;
    updateMemberBadge();
  } else {
    localStorage.removeItem(MEMBER_KEY);
    showMemberPicker(false);
  }
  initMemberEvents();
}

async function loadMembers() {
  try {
    const snap = await db.collection('members').orderBy('createdAt').get();
    allMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { allMembers = []; }
  return allMembers;
}

// ── CRUD ──────────────────────────────────────────────────────
async function doAddMember(rawName) {
  const trimmed = rawName.replace(/\./g, '').trim(); // dot은 Firestore path 구분자라 제거
  if (!trimmed) return;

  const existing = allMembers.find(m => m.name === trimmed);
  if (existing) { selectMember(trimmed); return; }

  try {
    const ref = await db.collection('members').add({
      name: trimmed,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    allMembers.push({ id: ref.id, name: trimmed });
    selectMember(trimmed);
  } catch {
    alert('멤버 추가에 실패했습니다.');
  }
}

// ── 선택 / 상태 관리 ──────────────────────────────────────────
function selectMember(name) {
  currentMember = name;
  localStorage.setItem(MEMBER_KEY, name);
  closeMemberPicker();
  updateMemberBadge();
  // 책 데이터는 이미 로드됐으면 re-render만, 아직 없으면 load
  if (typeof renderBooks === 'function' && typeof allBooks !== 'undefined' && allBooks.length >= 0) {
    renderBooks();
  } else if (typeof loadBooks === 'function') {
    loadBooks();
  }
}

function getCurrentMember() { return currentMember; }

// ── 피커 모달 ─────────────────────────────────────────────────
function showMemberPicker(allowSkip = true) {
  renderMemberPickerList();
  document.getElementById('memberPickerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  const skipBtn = document.getElementById('memberPickerSkip');
  if (skipBtn) skipBtn.style.display = (allowSkip && allMembers.length > 0) ? '' : 'none';
  document.getElementById('newMemberNameInput')?.focus();
}

function closeMemberPicker() {
  document.getElementById('memberPickerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderMemberPickerList() {
  const list = document.getElementById('memberPickerList');
  if (!list) return;
  if (allMembers.length === 0) {
    list.innerHTML = '<p class="no-members-hint">아직 등록된 가족이 없어요.<br>이름을 입력해 시작하세요.</p>';
    return;
  }
  list.innerHTML = allMembers.map(m => `
    <button class="member-btn ${m.name === currentMember ? 'active' : ''}"
            onclick="selectMember('${esc(m.name)}')">
      ${esc(m.name)}
    </button>
  `).join('');
}

function updateMemberBadge() {
  const btn = document.getElementById('currentMemberBtn');
  if (!btn) return;
  btn.textContent = currentMember ? `${currentMember} ▾` : '독자 선택';
}

// ── 이벤트 ────────────────────────────────────────────────────
function initMemberEvents() {
  document.getElementById('currentMemberBtn')?.addEventListener('click', () => {
    loadMembers().then(() => showMemberPicker(true));
  });

  document.getElementById('addMemberSubmit')?.addEventListener('click', () => {
    const input = document.getElementById('newMemberNameInput');
    doAddMember(input.value);
    input.value = '';
  });

  document.getElementById('newMemberNameInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      doAddMember(e.target.value);
      e.target.value = '';
    }
  });

  document.getElementById('memberPickerSkip')?.addEventListener('click', closeMemberPicker);
}
