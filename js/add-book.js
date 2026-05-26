let html5QrCode    = null;
let currentCoverUrl = '';

// ── 위치 자동완성 (멤버 이름 기반) ───────────────────────────
async function loadLocationSuggestions() {
  try {
    const snap = await db.collection('members').get();
    const datalist = document.getElementById('locationSuggestions');
    snap.docs.forEach(d => {
      const opt = document.createElement('option');
      opt.value = `${d.data().name}집`;
      datalist.appendChild(opt);
    });
  } catch { /* 실패해도 무방 */ }
}

// ── 책 상태에 따라 위치 필드 토글 ────────────────────────────
function initStatusToggle() {
  document.querySelectorAll('input[name="bookStatus"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const locGroup = document.getElementById('locationGroup');
      if (radio.value === 'wishlist') {
        locGroup.style.opacity = '0.4';
        locGroup.style.pointerEvents = 'none';
        document.getElementById('fieldLocation').value = '';
      } else {
        locGroup.style.opacity = '';
        locGroup.style.pointerEvents = '';
      }
    });
  });
}

// ── ISBN 조회 ─────────────────────────────────────────────────
async function lookupBook(rawIsbn) {
  const isbn = rawIsbn.replace(/[^0-9X]/gi, '');
  if (isbn.length < 10) { setStatus('ISBN은 10자리 또는 13자리 숫자입니다.', 'error'); return; }

  setStatus('책 정보를 검색 중...');

  const result = await fetchKakaoBooks(isbn)
             || await fetchGoogleBooks(isbn)
             || await fetchOpenLibrary(isbn);

  if (result) {
    fillForm(result);
    setStatus('✓ 책 정보를 불러왔습니다. 내용을 확인 후 저장하세요.', 'success');
  } else {
    setStatus('검색 결과가 없습니다. 직접 입력해주세요.', 'error');
    fillForm({ isbn, title: '', author: '', publisher: '', year: '', cover: '', description: '', language: 'korean' });
  }
}

async function fetchKakaoBooks(isbn) {
  if (!KAKAO_API_KEY || KAKAO_API_KEY === 'YOUR_KAKAO_REST_API_KEY') return null;
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v3/search/book?target=isbn&query=${isbn}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.documents?.length) return null;
    const book = data.documents[0];
    const isKorean = isbn.startsWith('9788') || isbn.startsWith('9791');
    return {
      isbn, title: book.title || '',
      author: (book.authors || []).join(', '),
      publisher: book.publisher || '',
      year: (book.datetime || '').slice(0, 4),
      description: book.contents || '',
      cover: book.thumbnail || '',
      language: isKorean ? 'korean' : 'foreign',
    };
  } catch { return null; }
}

async function fetchGoogleBooks(isbn) {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.totalItems || !data.items) return null;
    const info = data.items[0].volumeInfo;
    return {
      isbn, title: info.title || '',
      author: (info.authors || []).join(', '),
      publisher: info.publisher || '',
      year: (info.publishedDate || '').slice(0, 4),
      description: info.description || '',
      cover: (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '')
               .replace('http://', 'https://').replace('&zoom=1', '&zoom=2'),
      language: info.language === 'ko' ? 'korean' : 'foreign',
    };
  } catch { return null; }
}

async function fetchOpenLibrary(isbn) {
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    if (!res.ok) return null;
    const data = await res.json();
    const key = `ISBN:${isbn}`;
    if (!data[key]) return null;
    const book = data[key];
    return {
      isbn, title: book.title || '',
      author: (book.authors || []).map(a => a.name).join(', '),
      publisher: (book.publishers || []).map(p => p.name).join(', '),
      year: String(book.publish_date || '').slice(-4),
      description: book.notes || '',
      cover: book.cover?.large || book.cover?.medium || book.cover?.small || '',
      language: 'foreign',
    };
  } catch { return null; }
}

// ── 폼 채우기 ─────────────────────────────────────────────────
const BLANK_COVER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='135' height='202'%3E%3Crect width='135' height='202' fill='%23f5ede0'/%3E%3Ctext x='50%25' y='52%25' font-family='sans-serif' font-size='11' fill='%23b8a898' text-anchor='middle'%3E표지 없음%3C/text%3E%3C/svg%3E`;

function fillForm(book) {
  document.getElementById('fieldTitle').value       = book.title;
  document.getElementById('fieldAuthor').value      = book.author;
  document.getElementById('fieldPublisher').value   = book.publisher;
  document.getElementById('fieldYear').value        = book.year;
  document.getElementById('fieldIsbn').value        = book.isbn;
  document.getElementById('fieldDescription').value = book.description;

  currentCoverUrl = book.cover || '';
  document.getElementById('fieldCover').value   = currentCoverUrl;
  document.getElementById('coverPreview').src   = currentCoverUrl || BLANK_COVER;

  document.getElementById(book.language === 'foreign' ? 'langForeign' : 'langKorean').checked = true;

  document.getElementById('bookForm').classList.remove('hidden');
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('fieldTitle').focus();
}

// ── 바코드 스캔 ───────────────────────────────────────────────
function startScan() {
  document.getElementById('scanArea').classList.remove('hidden');
  document.getElementById('emptyState').classList.add('hidden');
  html5QrCode = new Html5Qrcode('reader');
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 260, height: 100 } },
    decoded => {
      stopScan();
      const cleaned = decoded.replace(/[^0-9]/g, '');
      document.getElementById('isbnInput').value = cleaned;
      lookupBook(cleaned);
    },
    () => {}
  ).catch(() => {
    setStatus('카메라 접근 권한이 필요합니다. 브라우저 설정을 확인해주세요.', 'error');
    document.getElementById('scanArea').classList.add('hidden');
  });
}

function stopScan() {
  if (html5QrCode) { html5QrCode.stop().catch(() => {}); html5QrCode = null; }
  document.getElementById('scanArea').classList.add('hidden');
}

// ── 저장 ──────────────────────────────────────────────────────
async function saveBook() {
  const title = document.getElementById('fieldTitle').value.trim();
  if (!title) { alert('제목을 입력해주세요.'); document.getElementById('fieldTitle').focus(); return; }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled   = true;
  saveBtn.textContent = '저장 중...';

  const langVal     = document.querySelector('input[name="language"]:checked')?.value || 'korean';
  const statusVal   = document.querySelector('input[name="bookStatus"]:checked')?.value || 'owned';
  const coverVal    = document.getElementById('fieldCover').value.trim() || currentCoverUrl;
  const locationVal = statusVal !== 'wishlist' ? document.getElementById('fieldLocation').value.trim() : '';
  const addedByVal  = localStorage.getItem('library_current_member') || '';

  const bookData = {
    title,
    author:      document.getElementById('fieldAuthor').value.trim(),
    publisher:   document.getElementById('fieldPublisher').value.trim(),
    year:        document.getElementById('fieldYear').value.trim(),
    isbn:        document.getElementById('fieldIsbn').value.trim(),
    cover:       coverVal,
    description: document.getElementById('fieldDescription').value.trim(),
    memo:        document.getElementById('fieldMemo').value.trim(),
    language:    langVal,
    status:      statusVal,
    location:    locationVal,
    addedBy:     addedByVal,
    addedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await db.collection('books').add(bookData);
    window.location.href = 'index.html';
  } catch {
    alert('저장에 실패했습니다. Firebase 설정(js/config.js)을 확인해주세요.');
    saveBtn.disabled   = false;
    saveBtn.textContent = '서고에 추가';
  }
}

// ── 상태 메시지 ───────────────────────────────────────────────
function setStatus(msg, type = '') {
  const el = document.getElementById('searchStatus');
  el.textContent = msg;
  el.className   = `search-status${type ? ' ' + type : ''}`;
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────
document.getElementById('scanBtn').addEventListener('click', startScan);
document.getElementById('stopScanBtn').addEventListener('click', stopScan);
document.getElementById('searchBtn').addEventListener('click', () => lookupBook(document.getElementById('isbnInput').value));
document.getElementById('isbnInput').addEventListener('keydown', e => { if (e.key === 'Enter') lookupBook(e.target.value); });
document.getElementById('saveBtn').addEventListener('click', saveBook);
document.getElementById('cancelBtn').addEventListener('click', () => { window.location.href = 'index.html'; });

document.getElementById('changeCoverBtn').addEventListener('click', () => {
  document.getElementById('coverUrlInput').classList.toggle('hidden');
  document.getElementById('coverUrlInput').focus();
});

document.getElementById('coverUrlInput').addEventListener('input', e => {
  const url = e.target.value.trim();
  if (url) {
    currentCoverUrl = url;
    document.getElementById('coverPreview').src  = url;
    document.getElementById('fieldCover').value  = url;
  }
});

// 초기화
initStatusToggle();
loadLocationSuggestions();
