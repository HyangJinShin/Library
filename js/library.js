// ── 상태 ──────────────────────────────────────────────────────
let allBooks = [];
let activeStatusFilter = 'all';
let activeLangFilter   = 'all';
let currentSort        = 'newest';
let currentBookId      = null;

// 리뷰 관련 상태
let currentReviews    = [];
let editingReviewDocId = null;  // null = 신규
let selectedRating     = 0;
let selectedReadStatus = 'read';
let editReadCount      = 1;

// ── 책 목록 로드 ──────────────────────────────────────────────
async function loadBooks() {
  const grid = document.getElementById('bookGrid');
  try {
    const snap = await db.collection('books').orderBy('addedAt', 'desc').get();
    allBooks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBooks();
    updateCount();
  } catch {
    grid.innerHTML = '<div class="loading">불러오기 실패.<br>SETUP.md 가이드를 따라 Firebase 설정을 완료해주세요.</div>';
  }
}

// ── 렌더링 ────────────────────────────────────────────────────
function renderBooks() {
  const grid  = document.getElementById('bookGrid');
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const me    = getCurrentMember();

  let filtered = allBooks.filter(book => {
    // 언어 필터
    if (activeLangFilter === 'korean'  && book.language !== 'korean') return false;
    if (activeLangFilter === 'foreign' && book.language !== 'foreign') return false;
    // 상태 필터
    const s = book.status || 'owned';
    if (activeStatusFilter !== 'all' && s !== activeStatusFilter) return false;
    // 검색
    if (query) {
      const target = `${book.title} ${book.author} ${book.publisher}`.toLowerCase();
      if (!target.includes(query)) return false;
    }
    return true;
  });

  // 정렬
  if (currentSort === 'title') {
    filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
  } else if (currentSort === 'author') {
    filtered.sort((a, b) => (a.author || '').localeCompare(b.author || '', 'ko'));
  } else if (currentSort === 'year') {
    filtered.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-grid">
      ${allBooks.length === 0
        ? '아직 추가된 책이 없습니다.<br><a href="add.html">첫 번째 책을 추가해보세요 →</a>'
        : '검색 결과가 없습니다.'}
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(book => {
    const status   = book.status || 'owned';
    const badgeMap = { owned: '소장', borrowed: '대출', wishlist: '위시리스트', returned: '반납' };
    const badge    = status !== 'owned'
      ? `<span class="book-cover-badge ${status}">${badgeMap[status] || ''}</span>` : '';

    // 내 별점 (denormalized)
    const myRating   = me && book.ratings ? (book.ratings[me] || 0) : 0;
    const myStatus   = me && book.readStatuses ? (book.readStatuses[me] || '') : '';
    const ratingHtml = myRating
      ? `<div class="book-card-rating">${'★'.repeat(myRating)}${'☆'.repeat(5 - myRating)}</div>`
      : myStatus === 'reading'
        ? `<div class="book-card-reading">읽는 중</div>` : '';

    return `
      <div class="book-card" data-id="${book.id}" onclick="openModal('${book.id}')">
        <div class="book-cover-wrap">
          ${badge}
          ${book.cover
            ? `<img src="${esc(book.cover)}" alt="${esc(book.title)}" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <div class="no-cover" style="${book.cover ? 'display:none' : ''}">
            <span class="no-cover-title">${esc(book.title)}</span>
          </div>
        </div>
        <div class="book-card-title">${esc(book.title)}</div>
        <div class="book-card-author">${esc(book.author || '')}</div>
        ${ratingHtml}
      </div>`;
  }).join('');
}

function updateCount() {
  document.getElementById('bookCount').textContent = allBooks.length > 0 ? `${allBooks.length}권` : '';
}

// ── 책 상세 모달 ──────────────────────────────────────────────
async function openModal(id) {
  const book = allBooks.find(b => b.id === id);
  if (!book) return;
  currentBookId = id;

  // 기본 정보
  document.getElementById('modalTitle').textContent       = book.title || '';
  document.getElementById('modalAuthor').textContent      = book.author || '';
  document.getElementById('modalDescription').textContent = book.description || '';

  const meta = [];
  if (book.publisher) meta.push(book.publisher);
  if (book.year)      meta.push(`${book.year}년`);
  meta.push(book.language === 'korean' ? '한국어' : '외서');
  document.getElementById('modalMeta').innerHTML = meta.map(m => `<span>${esc(m)}</span>`).join('');

  // 위치 / 상태 행
  const statusMap = { owned: '소장', borrowed: '대출 중', wishlist: '위시리스트', returned: '반납완료' };
  const status    = book.status || 'owned';
  const statusRow = document.getElementById('modalStatusRow');
  let statusHtml = `<span class="status-badge ${status}">${statusMap[status] || status}</span>`;
  if (book.location) statusHtml += `<span class="location-badge">📍 ${esc(book.location)}</span>`;
  if (book.addedBy)  statusHtml += `<span class="location-badge">✍️ ${esc(book.addedBy)}</span>`;
  statusRow.innerHTML = statusHtml;

  // 커버
  const coverEl  = document.getElementById('modalCover');
  const coverPh  = document.getElementById('modalCoverPlaceholder');
  if (book.cover) {
    coverEl.src          = book.cover;
    coverEl.style.display = 'block';
    coverPh.style.display = 'none';
    coverEl.onerror = () => { coverEl.style.display = 'none'; coverPh.style.display = 'block'; };
  } else {
    coverEl.style.display = 'none';
    coverPh.style.display = 'block';
  }

  // 기존 메모 (addedBy의 초기 메모)
  const memoWrap = document.getElementById('modalMemoWrap');
  if (book.memo) {
    document.getElementById('modalMemo').textContent = book.memo;
    memoWrap.style.display = '';
  } else {
    memoWrap.style.display = 'none';
  }

  // 추천 목록
  const recWrap = document.getElementById('modalRecWrap');
  if (book.recommendedBy && book.recommendedBy.length) {
    document.getElementById('modalRec').textContent = book.recommendedBy.join(', ') + '이(가) 추천';
    recWrap.style.display = '';
  } else {
    recWrap.style.display = 'none';
  }

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  // 리뷰 로드
  await loadAndRenderReviews(id);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  currentBookId = null;
  currentReviews = [];
  hideReviewForm();
}

async function deleteBook() {
  if (!currentBookId) return;
  if (!confirm('이 책을 서고에서 삭제할까요?')) return;
  try {
    await db.collection('books').doc(currentBookId).delete();
    allBooks = allBooks.filter(b => b.id !== currentBookId);
    renderBooks();
    updateCount();
    closeModal();
  } catch { alert('삭제에 실패했습니다.'); }
}

// ── 추천 ──────────────────────────────────────────────────────
async function toggleRecommend() {
  if (!currentBookId || !getCurrentMember()) return;
  const me   = getCurrentMember();
  const book = allBooks.find(b => b.id === currentBookId);
  if (!book) return;

  const rec     = book.recommendedBy || [];
  const already = rec.includes(me);
  const newRec  = already ? rec.filter(n => n !== me) : [...rec, me];

  await db.collection('books').doc(currentBookId).update({ recommendedBy: newRec });
  book.recommendedBy = newRec;

  const recWrap = document.getElementById('modalRecWrap');
  if (newRec.length) {
    document.getElementById('modalRec').textContent = newRec.join(', ') + '이(가) 추천';
    recWrap.style.display = '';
  } else {
    recWrap.style.display = 'none';
  }

  const recBtn = document.getElementById('modalRecommendBtn');
  recBtn.textContent = newRec.includes(me) ? '👍 추천 취소' : '👍 추천';
}

// ── 리뷰 로드 & 렌더 ──────────────────────────────────────────
async function loadAndRenderReviews(bookId) {
  const section = document.getElementById('reviewsList');
  section.innerHTML = '<div class="loading-reviews">불러오는 중...</div>';
  hideReviewForm();

  try {
    const snap = await db.collection('books').doc(bookId).collection('reviews').get();
    currentReviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderReviewsList(bookId);
  } catch {
    currentReviews = [];
    renderReviewsList(bookId);
  }
}

function renderReviewsList(bookId) {
  const me     = getCurrentMember();
  const myReview = me ? currentReviews.find(r => r.member === me) : null;
  const others   = currentReviews.filter(r => r.member !== me);

  let html = '';

  // 내 리뷰 / 추가 버튼
  if (me) {
    if (myReview) {
      html += renderReviewItem(myReview, true);
    } else {
      html += `
        <div class="review-add-row">
          <button class="btn-add-review" onclick="showReviewForm(null)">
            + ${esc(me)}의 독서 기록 남기기
          </button>
        </div>`;
    }
  }

  // 다른 가족 리뷰
  others.forEach(r => { html += renderReviewItem(r, false); });

  if (!me && currentReviews.length === 0) {
    html = '<p class="no-reviews">아직 독서 기록이 없습니다.</p>';
  }

  document.getElementById('reviewsList').innerHTML = html || '<p class="no-reviews">아직 독서 기록이 없습니다.</p>';

  // 추천 버튼 텍스트 갱신
  if (me) {
    const book  = allBooks.find(b => b.id === currentBookId);
    const isRec = book?.recommendedBy?.includes(me);
    const recBtn = document.getElementById('modalRecommendBtn');
    if (recBtn) recBtn.textContent = isRec ? '👍 추천 취소' : '👍 추천';
  }
}

function renderReviewItem(review, isOwn) {
  const statusLabel = { read: '읽었어요', reading: '읽는 중', 'want-to-read': '읽고싶어요' };
  const sl          = statusLabel[review.readStatus] || '';
  const readInfo    = review.readCount > 1 ? ` · ${review.readCount}회` : '';
  const stars       = review.rating
    ? `<span class="review-stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>`
    : '';

  const notesHtml = review.notes
    ? `<details class="review-notes">
         <summary>독서 노트 보기</summary>
         <p>${esc(review.notes).replace(/\n/g, '<br>')}</p>
       </details>` : '';

  const editBtn = isOwn
    ? `<button class="btn-edit-review" onclick="showReviewForm('${review.id}')">수정</button>` : '';

  return `
    <div class="review-item${isOwn ? ' own' : ''}">
      <div class="review-header">
        <span class="review-member-name">${esc(review.member)}</span>
        ${stars}
        ${sl ? `<span class="review-read-status ${review.readStatus}">${esc(sl)}${esc(readInfo)}</span>` : ''}
        ${editBtn}
      </div>
      ${review.oneLineMemo ? `<p class="review-memo">"${esc(review.oneLineMemo)}"</p>` : ''}
      ${notesHtml}
    </div>`;
}

// ── 리뷰 편집 폼 ──────────────────────────────────────────────
function showReviewForm(reviewDocId) {
  editingReviewDocId = reviewDocId;
  const existing = reviewDocId ? currentReviews.find(r => r.id === reviewDocId) : null;

  // 초기값 세팅
  selectedRating     = existing?.rating     || 0;
  selectedReadStatus = existing?.readStatus || 'read';
  editReadCount      = existing?.readCount  || 1;

  document.getElementById('reviewOneLiner').value = existing?.oneLineMemo || '';
  document.getElementById('reviewNotes').value    = existing?.notes       || '';

  // 읽기 횟수 표시
  document.getElementById('readCountDisplay').textContent = editReadCount;
  updateReadCountUI();

  // 별점 UI
  updateStarsUI();

  // 상태 버튼 UI
  document.querySelectorAll('.review-status-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === selectedReadStatus);
  });

  document.getElementById('reviewFormWrap').classList.remove('hidden');
  document.getElementById('reviewsList').classList.add('hidden');
}

function hideReviewForm() {
  document.getElementById('reviewFormWrap')?.classList.add('hidden');
  document.getElementById('reviewsList')?.classList.remove('hidden');
  editingReviewDocId = null;
}

// ── 별점 ─────────────────────────────────────────────────────
function setRating(n) {
  selectedRating = (selectedRating === n) ? 0 : n; // 같은 별 클릭 시 취소
  updateStarsUI();
}

function previewRating(n) {
  document.querySelectorAll('.star-btn').forEach((el, i) => {
    el.classList.toggle('filled', i < (n || selectedRating));
  });
}

function updateStarsUI() {
  document.querySelectorAll('.star-btn').forEach((el, i) => {
    el.classList.toggle('filled', i < selectedRating);
  });
}

// ── 읽기 횟수 ──────────────────────────────────────────────────
function adjustReadCount(delta) {
  editReadCount = Math.max(1, editReadCount + delta);
  document.getElementById('readCountDisplay').textContent = editReadCount;
  updateReadCountUI();
}

function updateReadCountUI() {
  const wrap = document.getElementById('readCountWrap');
  if (wrap) wrap.style.display = selectedReadStatus === 'read' ? '' : 'none';
}

// ── 리뷰 저장 ─────────────────────────────────────────────────
async function submitReview() {
  const me = getCurrentMember();
  if (!me || !currentBookId) return;

  const saveBtn = document.getElementById('reviewSaveBtn');
  saveBtn.disabled   = true;
  saveBtn.textContent = '저장 중...';

  const reviewData = {
    member:      me,
    readStatus:  selectedReadStatus,
    readCount:   selectedReadStatus === 'read' ? editReadCount : 1,
    rating:      selectedRating,
    oneLineMemo: document.getElementById('reviewOneLiner').value.trim(),
    notes:       document.getElementById('reviewNotes').value.trim(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  };

  // 읽은 날짜 (읽었어요일 때만)
  if (selectedReadStatus === 'read') {
    reviewData.readDates = firebase.firestore.FieldValue.arrayUnion(
      new Date().toISOString().slice(0, 7)
    );
  }

  try {
    const reviewsRef = db.collection('books').doc(currentBookId).collection('reviews');

    if (editingReviewDocId) {
      await reviewsRef.doc(editingReviewDocId).update(reviewData);
    } else {
      const existing = currentReviews.find(r => r.member === me);
      if (existing) {
        await reviewsRef.doc(existing.id).update(reviewData);
      } else {
        await reviewsRef.add(reviewData);
      }
    }

    // denormalize: 책 문서에 별점·상태 저장 (카드 표시용)
    const bookUpdate = {};
    if (selectedRating) bookUpdate[`ratings.${me}`]     = selectedRating;
    bookUpdate[`readStatuses.${me}`] = selectedReadStatus;
    await db.collection('books').doc(currentBookId).update(bookUpdate);

    // 로컬 업데이트
    const bookIdx = allBooks.findIndex(b => b.id === currentBookId);
    if (bookIdx >= 0) {
      allBooks[bookIdx].ratings      = allBooks[bookIdx].ratings      || {};
      allBooks[bookIdx].readStatuses = allBooks[bookIdx].readStatuses || {};
      if (selectedRating) allBooks[bookIdx].ratings[me]     = selectedRating;
      allBooks[bookIdx].readStatuses[me] = selectedReadStatus;
    }

    renderBooks();
    await loadAndRenderReviews(currentBookId);
  } catch (e) {
    alert('저장에 실패했습니다.');
    console.error(e);
  } finally {
    saveBtn.disabled   = false;
    saveBtn.textContent = '저장';
  }
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('input', renderBooks);

// 언어 필터
document.querySelectorAll('.lang-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lang-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLangFilter = btn.dataset.lang;
    renderBooks();
  });
});

// 상태 필터
document.querySelectorAll('.status-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStatusFilter = btn.dataset.status;
    renderBooks();
  });
});

document.getElementById('sortSelect').addEventListener('change', e => {
  currentSort = e.target.value;
  renderBooks();
});

// 책 모달
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalDelete').addEventListener('click', deleteBook);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// 추천 버튼
document.getElementById('modalRecommendBtn')?.addEventListener('click', toggleRecommend);

// 리뷰 폼 - 상태 버튼
document.querySelectorAll('.review-status-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedReadStatus = btn.dataset.status;
    document.querySelectorAll('.review-status-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateReadCountUI();
  });
});

// 리뷰 폼 - 별점
document.querySelectorAll('.star-btn').forEach((btn, i) => {
  btn.addEventListener('click',     () => setRating(i + 1));
  btn.addEventListener('mouseover', () => previewRating(i + 1));
  btn.addEventListener('mouseout',  () => previewRating(0));
});

// 리뷰 폼 - 횟수
document.getElementById('countMinus')?.addEventListener('click', () => adjustReadCount(-1));
document.getElementById('countPlus')?.addEventListener('click',  () => adjustReadCount(1));

// 리뷰 폼 - 취소 / 저장
document.getElementById('reviewCancelBtn')?.addEventListener('click', hideReviewForm);
document.getElementById('reviewSaveBtn')?.addEventListener('click',   submitReview);

// 멤버 초기화 완료 후 책 로드
// (selectMember 내부에서도 loadBooks 호출되지만, 멤버 미선택·건너뛰기 시에도 동작)
initMembers().then(() => {
  loadBooks();
});
