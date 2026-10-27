// 크로스핏 레벤 존다 챌린지 프론트엔드 애플리케이션

const AppState = {
  db: null,
  currentUserId: localStorage.getItem('leben_user_id') || 'u1',
  selectedDate: '',
  activeTab: 'diet',
  selectedTeamFilter: 'all',
  adminUnlocked: sessionStorage.getItem('leben_admin_unlocked') === 'true',
  // 식단 입력 폼 상태
  mealForm: {
    editingId: null,
    type: '아침',
    carb: 3,
    protein: 3,
    fat: 3,
    memo: '',
    photoDataUrl: ''
  },
  scannedViolations: null
};

function showToast(msg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 2600);
}

function formatBlock(n) {
  const num = Number(n || 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
}

function formatWon(amount) {
  return Number(amount || 0).toLocaleString('ko-KR') + '원';
}

async function copyToClipboard(text, successMsg = '클립보드에 복사되었습니다!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg);
    return true;
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(successMsg);
    return true;
  }
}

async function apiRequest(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || '요청 처리 중 오류가 발생했습니다.');
  }
  return res.json();
}

async function loadState() {
  const data = await apiRequest('/api/state');
  AppState.db = data;
  if (!AppState.selectedDate) {
    AppState.selectedDate = data.serverInfo?.todayKst || new Date().toISOString().slice(0, 10);
    const picker = document.getElementById('datePicker');
    if (picker) picker.value = AppState.selectedDate;
  }
  if (!data.participants.some(p => p.id === AppState.currentUserId) && data.participants.length > 0) {
    AppState.currentUserId = data.participants[0].id;
    localStorage.setItem('leben_user_id', AppState.currentUserId);
  }
  renderHeader();
  renderMain();
}

function getCurrentUser() {
  if (!AppState.db) return null;
  return (
    AppState.db.participants.find(p => p.id === AppState.currentUserId) ||
    AppState.db.participants[0]
  );
}

function getUserDailyLog(userId, date) {
  if (!AppState.db) return { meals: [], kakaoReported: false, cafePosted: false };
  return (
    AppState.db.dailyLogs.find(l => l.userId === userId && l.date === date) || {
      userId,
      date,
      meals: [],
      kakaoReported: false,
      cafePosted: false
    }
  );
}

function isUserWeeklyMissionDone(userId) {
  if (!AppState.db) return false;
  const weekLabel = AppState.db.settings?.weeklyMission?.weekLabel;
  return AppState.db.missionLogs.some(m => m.userId === userId && m.weekLabel === weekLabel);
}

function getUserPenalties(userId) {
  if (!AppState.db) return [];
  return AppState.db.penalties.filter(p => p.userId === userId);
}

function renderHeader() {
  const user = getCurrentUser();
  const titleEl = document.getElementById('headerChallengeTitle');
  if (titleEl && AppState.db?.settings?.challengeName) {
    titleEl.textContent = AppState.db.settings.challengeName;
  }
  const badgeEl = document.getElementById('currentUserBadge');
  if (badgeEl && user) {
    badgeEl.textContent = `👤 ${user.team}조 ${user.name} (${user.targetBlocks}블록)`;
  }
  const picker = document.getElementById('datePicker');
  if (picker && picker.value !== AppState.selectedDate) {
    picker.value = AppState.selectedDate;
  }
}

function updateMidnightCountdown() {
  const el = document.getElementById('midnightCountdown');
  if (!el) return;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = midnight - now;
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  const pad = n => String(n).padStart(2, '0');
  el.textContent = `⏰ 밤 12시 마감까지 ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

// 이미지 파일을 모바일 업로드에 적합하게 리사이즈 압축 (Canvas)
function compressImageFile(file, maxWidth = 720, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeQuickSampleFoodPhoto(mealType, c, p, f, memo) {
  const palettes = {
    아침: ['#0f766e', '#115e59', '🥗'],
    점심: ['#1d4ed8', '#1e3a8a', '🍱'],
    저녁: ['#4338ca', '#312e81', '🥩'],
    간식: ['#b45309', '#78350f', '🫐']
  };
  const [c1, c2, icon] = palettes[mealType] || palettes['아침'];
  const title = `${mealType} 존다 식단 (탄${c}·단${p}·지${f})`;
  const sub = memo || '클린 식단 인증 사진';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="480" height="360" rx="24" fill="url(#g)"/>
    <circle cx="240" cy="140" r="70" fill="rgba(255,255,255,0.15)"/>
    <text x="240" y="164" font-size="64" text-anchor="middle">${icon}</text>
    <text x="240" y="255" font-family="sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
    <text x="240" y="292" font-family="sans-serif" font-size="17" fill="rgba(255,255,255,0.85)" text-anchor="middle">${sub}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ============================================================================
// 메인 화면 렌더링 분기
// ============================================================================
function renderMain() {
  const container = document.getElementById('mainView');
  if (!container || !AppState.db) return;

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === AppState.activeTab);
  });

  if (AppState.activeTab === 'diet') {
    renderDietTab(container);
  } else if (AppState.activeTab === 'share') {
    renderShareTab(container);
  } else if (AppState.activeTab === 'teams') {
    renderTeamsTab(container);
  } else if (AppState.activeTab === 'penalty') {
    renderPenaltyTab(container);
  } else if (AppState.activeTab === 'admin') {
    renderAdminTab(container);
  }
}

// ============================================================================
// TAB 1: 식단 · 블록 기록
// ============================================================================
function renderDietTab(container) {
  const user = getCurrentUser();
  const log = getUserDailyLog(user.id, AppState.selectedDate);
  const meals = log.meals || [];
  const totals = window.ZoneShareHelper.computeTotals(meals);
  const target = Number(user.targetBlocks || 11);
  const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
  const ratioText = window.ZoneShareHelper.computeRatioText(totals);
  const myPenalties = getUserPenalties(user.id);
  const maxPenalties = AppState.db.settings?.maxPenaltyCount || 10;
  const penaltyCount = Math.min(maxPenalties, myPenalties.length);

  const macroRowsHtml = [
    { key: 'carb', label: '탄수화물 (C)', val: totals.carb, color: 'var(--carb-color)', unitInfo: '1블록 = 9g' },
    { key: 'protein', label: '단백질 (P)', val: totals.protein, color: 'var(--protein-color)', unitInfo: '1블록 = 7g' },
    { key: 'fat', label: '지방 (F)', val: totals.fat, color: 'var(--fat-color)', unitInfo: '1블록 = 1.5g' }
  ]
    .map(m => {
      const pct = Math.min(100, Math.round((m.val / Math.max(target, 1)) * 100));
      const overThis = m.val > target;
      const remain = target - m.val;
      const statusText = overThis
        ? `<span style="color:#fca5a5;">+${formatBlock(m.val - target)}블록 초과 ⚠️</span>`
        : remain === 0
        ? `<span style="color:#6ee7b7;">목표 달성 ✅</span>`
        : `<span style="color:#94a3b8;">남은 블록 ${formatBlock(remain)}</span>`;

      return `
        <div class="macro-row">
          <div class="macro-label-line">
            <span>${m.label} <small style="color:var(--text-muted);font-weight:600;">(${m.unitInfo})</small></span>
            <span>
              <strong style="color:${overThis ? '#fca5a5' : '#fff'};font-size:15px;">${formatBlock(m.val)}</strong>
              <span style="color:var(--text-sub);"> / ${target}블록</span>
              &nbsp;·&nbsp; ${statusText}
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%;background:${overThis ? 'var(--danger)' : m.color};"></div>
          </div>
        </div>
      `;
    })
    .join('');

  const mf = AppState.mealForm;

  container.innerHTML = `
    <!-- 오늘 내 블록 요약 카드 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">
            <span>📊 ${user.team}조 ${user.name}님의 일일 블록 현황</span>
          </div>
          <div class="card-subtitle">${AppState.selectedDate} 기준 · 하루 정해진 목표 각 ${target}블록</div>
        </div>
        <span class="badge ${isOver ? 'badge-danger' : meals.length > 0 ? 'badge-ok' : 'badge-warn'}">
          ${isOver ? '⚠️ 목표 블록 초과' : meals.length > 0 ? '✅ 블록 적정' : '⏳ 기록 전'}
        </span>
      </div>

      <div class="macro-grid">
        ${macroRowsHtml}
      </div>

      <div class="ratio-summary-box">
        <span style="color:var(--text-sub);font-weight:700;">⚖️ 오늘 탄:단:지 블록 비율</span>
        <strong style="color:#fdba74;">${ratioText}</strong>
      </div>

      ${
        isOver
          ? `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--danger-soft);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;font-size:12.5px;font-weight:700;">
              🚨 하루 목표(${target}블록)를 초과했습니다! 규칙에 따라 초과 시 1만원 패널티 대상이 됩니다.
            </div>`
          : ''
      }

      <!-- 밤 12시 전 단톡방 / 네이버 카페 인증 완료 체크 -->
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-subtle);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12.5px;font-weight:800;color:var(--text-sub);">☑️ 밤 12시 전 필수 보고 체크리스트</span>
          <span style="font-size:11.5px;color:var(--text-muted);">내 누적 패널티: ${penaltyCount}/${maxPenalties}회 (${formatWon(penaltyCount * 10000)})</span>
        </div>
        <div class="cert-check-grid">
          <button type="button" class="cert-toggle-btn ${log.kakaoReported ? 'done' : ''}" id="btnToggleKakao">
            <span class="cert-title">${log.kakaoReported ? '✅ 조 단톡방 보고 완료' : '⬜ 조 단톡방 보고 전'}</span>
            <span class="cert-sub">${log.kakaoReported ? '12시 전 식단·비율 보고됨' : '터치하여 완료 체크 또는 공유탭 이동'}</span>
          </button>
          <button type="button" class="cert-toggle-btn ${log.cafePosted ? 'done' : ''}" id="btnToggleCafe">
            <span class="cert-title">${log.cafePosted ? '✅ 네이버 카페 업로드 완료' : '⬜ 네이버 카페 작성 전'}</span>
            <span class="cert-sub">${log.cafePosted ? '12시 전 카페 게시글 완료됨' : '터치하여 완료 체크 또는 공유탭 이동'}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- 끼니별 식단 사진 & 탄단지 블록 입력 카드 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">
            <span>🍽️ ${mf.editingId ? '끼니 기록 수정하기' : '끼니 식단 & 블록 간편 추가'}</span>
          </div>
          <div class="card-subtitle">끼니 사진과 탄·단·지 블록 수만 간단히 선택하세요</div>
        </div>
        ${
          mf.editingId
            ? `<button type="button" class="btn btn-secondary btn-sm" id="btnCancelEditMeal">수정 취소</button>`
            : ''
        }
      </div>

      <!-- 끼니 구분 탭 -->
      <div class="meal-type-tabs">
        ${['아침', '점심', '저녁', '간식']
          .map(
            t =>
              `<button type="button" class="meal-type-tab ${mf.type === t ? 'active' : ''}" data-meal-type="${t}">${t}</button>`
          )
          .join('')}
      </div>

      <!-- 원터치 1:1:1 블록 프리셋 -->
      <div style="font-size:12px;font-weight:700;color:var(--text-sub);margin-bottom:6px;">
        ⚡ 원터치 정석 블록 선택 (탄·단·지 동일 세팅)
      </div>
      <div class="quick-preset-row">
        ${[1, 2, 3, 3.5, 4, 5]
          .map(
            b =>
              `<button type="button" class="preset-chip ${
                mf.carb === b && mf.protein === b && mf.fat === b ? 'active' : ''
              }" data-preset-block="${b}">${b}블록씩</button>`
          )
          .join('')}
      </div>

      <!-- 탄 / 단 / 지 개별 블록 조절 -->
      <div class="block-stepper-grid">
        <div class="stepper-box">
          <div class="stepper-title" style="color:var(--carb-color);">탄수화물(C)</div>
          <div class="stepper-val" id="valCarb">${formatBlock(mf.carb)}<small style="font-size:12px;color:var(--text-sub);">블록</small></div>
          <div class="stepper-btns">
            <button type="button" data-step-macro="carb" data-step-delta="-0.5">-0.5</button>
            <button type="button" data-step-macro="carb" data-step-delta="0.5">+0.5</button>
          </div>
        </div>
        <div class="stepper-box">
          <div class="stepper-title" style="color:var(--protein-color);">단백질(P)</div>
          <div class="stepper-val" id="valProtein">${formatBlock(mf.protein)}<small style="font-size:12px;color:var(--text-sub);">블록</small></div>
          <div class="stepper-btns">
            <button type="button" data-step-macro="protein" data-step-delta="-0.5">-0.5</button>
            <button type="button" data-step-macro="protein" data-step-delta="0.5">+0.5</button>
          </div>
        </div>
        <div class="stepper-box">
          <div class="stepper-title" style="color:var(--fat-color);">지방(F)</div>
          <div class="stepper-val" id="valFat">${formatBlock(mf.fat)}<small style="font-size:12px;color:var(--text-sub);">블록</small></div>
          <div class="stepper-btns">
            <button type="button" data-step-macro="fat" data-step-delta="-0.5">-0.5</button>
            <button type="button" data-step-macro="fat" data-step-delta="0.5">+0.5</button>
          </div>
        </div>
      </div>

      <!-- 식단 사진 업로드 -->
      <div class="photo-upload-box" id="photoUploadTrigger">
        <input type="file" id="mealPhotoInput" accept="image/*" style="display:none;" />
        <div style="font-size:13.5px;font-weight:800;color:#fdba74;">📷 식단 사진 촬영 또는 앨범에서 선택</div>
        <div style="font-size:11.5px;color:var(--text-sub);margin-top:2px;">사진을 등록하면 네이버 카페·단톡방 요약 카드가 자동으로 만들어집니다</div>
        ${
          mf.photoDataUrl
            ? `<img src="${mf.photoDataUrl}" class="photo-preview-img" alt="식단 미리보기" />`
            : ''
        }
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:-6px;margin-bottom:12px;">
        <button type="button" class="btn btn-secondary btn-sm" id="btnUseSamplePhoto">🥗 샘플 식단 이미지 자동 채우기</button>
        ${
          mf.photoDataUrl
            ? `<button type="button" class="btn btn-danger btn-sm" id="btnClearPhoto">사진 지우기</button>`
            : ''
        }
      </div>

      <!-- 식단 메모 -->
      <div style="margin-bottom:12px;">
        <input type="text" class="input-field" id="mealMemoInput" placeholder="식단 메모 (예: 닭가슴살 100g, 현미밥, 아몬드)" value="${
          mf.memo || ''
        }" />
      </div>

      <button type="button" class="btn btn-primary btn-block" id="btnSaveMeal">
        ${mf.editingId ? '💾 끼니 수정 완료' : '➕ 오늘 식단에 이 끼니 추가하기'}
      </button>
    </section>

    <!-- 오늘 등록된 끼니 리스트 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📋 오늘 기록한 식단 목록 (${meals.length}끼)</div>
          <div class="card-subtitle">등록 후 아래 공유 버튼으로 단톡방·카페 양식을 1초 만에 복사하세요</div>
        </div>
      </div>

      ${
        meals.length === 0
          ? `<div style="text-align:center;padding:24px 12px;color:var(--text-sub);font-size:13.5px;">
              아직 오늘 등록된 끼니가 없습니다.<br/>위에서 아침·점심·저녁 식단과 블록을 추가해보세요!
            </div>`
          : `<div class="meal-list">
              ${meals
                .map(
                  m => `
                <div class="meal-item">
                  ${
                    m.photoDataUrl
                      ? `<img src="${m.photoDataUrl}" class="meal-thumb" alt="${m.type}" />`
                      : `<div class="meal-thumb" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🥗</div>`
                  }
                  <div class="meal-info">
                    <div class="meal-info-top">
                      <span class="badge badge-accent">${m.type} ${m.time ? `· ${m.time}` : ''}</span>
                      <div style="display:flex;gap:6px;">
                        <button type="button" class="btn btn-secondary btn-sm" data-edit-meal="${m.id}">수정</button>
                        <button type="button" class="btn btn-danger btn-sm" data-delete-meal="${m.id}">삭제</button>
                      </div>
                    </div>
                    <div class="meal-blocks-tag">
                      탄 ${formatBlock(m.carb)} · 단 ${formatBlock(m.protein)} · 지 ${formatBlock(m.fat)} 블록
                    </div>
                    <div class="meal-memo-text">${m.memo || '메모 없음'}</div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>`
      }

      <div style="margin-top:16px;">
        <button type="button" class="btn btn-success btn-block" id="btnGoShareTab">
          📤 네이버 카페 · 조별 단톡방 요약카드 & 텍스트 복사하러 가기 →
        </button>
      </div>
    </section>
  `;

  bindDietTabEvents(user, log);
}

function bindDietTabEvents(user, log) {
  // 단톡방 / 카페 완료 토글
  document.getElementById('btnToggleKakao')?.addEventListener('click', async () => {
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      kakaoReported: !log.kakaoReported
    });
    showToast(!log.kakaoReported ? '💬 조 단톡방 보고 완료로 체크되었습니다!' : '단톡방 보고 체크가 해제되었습니다.');
    await loadState();
  });

  document.getElementById('btnToggleCafe')?.addEventListener('click', async () => {
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      cafePosted: !log.cafePosted
    });
    showToast(!log.cafePosted ? '☕ 네이버 카페 업로드 완료로 체크되었습니다!' : '네이버 카페 체크가 해제되었습니다.');
    await loadState();
  });

  // 끼니 종류 선택
  document.querySelectorAll('[data-meal-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.mealForm.type = btn.dataset.mealType;
      renderMain();
    });
  });

  // 원터치 블록 프리셋
  document.querySelectorAll('[data-preset-block]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.presetBlock);
      AppState.mealForm.carb = val;
      AppState.mealForm.protein = val;
      AppState.mealForm.fat = val;
      renderMain();
    });
  });

  // 개별 탄단지 증감
  document.querySelectorAll('[data-step-macro]').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.stepMacro;
      const delta = Number(btn.dataset.stepDelta);
      const next = Math.max(0, Math.min(20, Number(AppState.mealForm[macro] || 0) + delta));
      AppState.mealForm[macro] = next;
      renderMain();
    });
  });

  // 메모 동기화
  const memoInput = document.getElementById('mealMemoInput');
  memoInput?.addEventListener('input', e => {
    AppState.mealForm.memo = e.target.value;
  });

  // 사진 업로드
  const photoTrigger = document.getElementById('photoUploadTrigger');
  const photoInput = document.getElementById('mealPhotoInput');
  photoTrigger?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      AppState.mealForm.photoDataUrl = dataUrl;
      showToast('📷 식단 사진이 첨부되었습니다!');
      renderMain();
    } catch (err) {
      showToast('사진을 불러오지 못했습니다.');
    }
  });

  // 샘플 사진 채우기
  document.getElementById('btnUseSamplePhoto')?.addEventListener('click', () => {
    const mf = AppState.mealForm;
    mf.photoDataUrl = makeQuickSampleFoodPhoto(mf.type, mf.carb, mf.protein, mf.fat, mf.memo);
    showToast('🥗 샘플 식단 이미지가 적용되었습니다!');
    renderMain();
  });

  document.getElementById('btnClearPhoto')?.addEventListener('click', () => {
    AppState.mealForm.photoDataUrl = '';
    renderMain();
  });

  document.getElementById('btnCancelEditMeal')?.addEventListener('click', () => {
    AppState.mealForm = {
      editingId: null,
      type: '아침',
      carb: 3,
      protein: 3,
      fat: 3,
      memo: '',
      photoDataUrl: ''
    };
    renderMain();
  });

  // 끼니 저장
  document.getElementById('btnSaveMeal')?.addEventListener('click', async () => {
    const mf = AppState.mealForm;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const photo =
      mf.photoDataUrl || makeQuickSampleFoodPhoto(mf.type, mf.carb, mf.protein, mf.fat, mf.memo);

    await apiRequest('/api/meals', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      meal: {
        id: mf.editingId || undefined,
        type: mf.type,
        time: timeStr,
        carb: Number(mf.carb),
        protein: Number(mf.protein),
        fat: Number(mf.fat),
        memo: mf.memo.trim(),
        photoDataUrl: photo
      }
    });

    showToast(mf.editingId ? '✅ 끼니 기록이 수정되었습니다!' : '✅ 오늘 식단에 끼니가 추가되었습니다!');
    AppState.mealForm = {
      editingId: null,
      type: mf.type === '아침' ? '점심' : mf.type === '점심' ? '저녁' : '간식',
      carb: 3,
      protein: 3,
      fat: 3,
      memo: '',
      photoDataUrl: ''
    };
    await loadState();
  });

  // 끼니 수정 / 삭제
  document.querySelectorAll('[data-edit-meal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mealId = btn.dataset.editMeal;
      const targetMeal = (log.meals || []).find(m => m.id === mealId);
      if (!targetMeal) return;
      AppState.mealForm = {
        editingId: targetMeal.id,
        type: targetMeal.type,
        carb: targetMeal.carb,
        protein: targetMeal.protein,
        fat: targetMeal.fat,
        memo: targetMeal.memo || '',
        photoDataUrl: targetMeal.photoDataUrl || ''
      };
      window.scrollTo({ top: 180, behavior: 'smooth' });
      renderMain();
    });
  });

  document.querySelectorAll('[data-delete-meal]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mealId = btn.dataset.deleteMeal;
      await apiRequest('/api/meals/delete', 'POST', {
        userId: user.id,
        date: AppState.selectedDate,
        mealId
      });
      showToast('🗑️ 끼니 기록이 삭제되었습니다.');
      await loadState();
    });
  });

  document.getElementById('btnGoShareTab')?.addEventListener('click', () => {
    AppState.activeTab = 'share';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderMain();
  });
}

// ============================================================================
// TAB 2: 네이버 카페 · 조별 단톡방 공유 카드 & 텍스트 자동 생성
// ============================================================================
async function renderShareTab(container) {
  const user = getCurrentUser();
  const log = getUserDailyLog(user.id, AppState.selectedDate);
  const meals = log.meals || [];
  const missionDone = isUserWeeklyMissionDone(user.id);
  const settings = AppState.db.settings || {};

  const kakaoText = window.ZoneShareHelper.buildKakaoText({
    user,
    date: AppState.selectedDate,
    meals,
    missionDone,
    challengeName: settings.challengeName
  });

  const cafeTitle = window.ZoneShareHelper.buildCafeTitle({
    user,
    date: AppState.selectedDate,
    meals
  });

  const cafeBody = window.ZoneShareHelper.buildCafeBody({
    user,
    date: AppState.selectedDate,
    meals,
    missionDone,
    weeklyMissionTitle: settings.weeklyMission?.title
  });

  container.innerHTML = `
    <!-- 1. 하루 식단 요약 카드 이미지 생성기 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">🖼️ 오늘의 식단 요약 카드 이미지 (한 장으로 합치기)</div>
          <div class="card-subtitle">끼니 사진 여러 장을 따로 올릴 필요 없이 이 요약 카드 한 장만 저장해 카페·단톡방에 올리세요!</div>
        </div>
      </div>

      <div class="summary-canvas-wrap">
        <canvas id="summaryCardCanvas"></canvas>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <button type="button" class="btn btn-primary" id="btnDownloadCardImg">
          📥 요약 카드 이미지 저장
        </button>
        <button type="button" class="btn btn-success" id="btnNativeShareCard">
          📲 폰에서 카톡·카페 바로 공유
        </button>
      </div>
    </section>

    <!-- 2. 조별 단톡방 보고용 텍스트 원클릭 복사 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">💬 ${user.team}조 단톡방 보고 양식 복사</div>
          <div class="card-subtitle">오늘 먹은 식단과 탄·단·지 비율이 자동 계산된 단톡방 보고 문구입니다</div>
        </div>
        <span class="badge ${log.kakaoReported ? 'badge-ok' : 'badge-warn'}">
          ${log.kakaoReported ? '✅ 단톡 보고완료' : '⏳ 보고 전'}
        </span>
      </div>

      <div class="copy-preview" id="kakaoTextPreview">${kakaoText}</div>

      <button type="button" class="btn btn-primary btn-block" id="btnCopyKakao">
        📋 단톡방 보고 문구 복사 + '단톡 보고완료' 자동 체크
      </button>
    </section>

    <!-- 3. 네이버 크로스핏 카페 업로드용 양식 복사 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">☕ 네이버 카페 게시글 양식 복사 (밤 12시 전)</div>
          <div class="card-subtitle">카페 글쓰기에서 제목과 본문을 붙여넣고 위의 요약 카드 사진을 첨부하세요</div>
        </div>
        <span class="badge ${log.cafePosted ? 'badge-ok' : 'badge-warn'}">
          ${log.cafePosted ? '✅ 카페 업로드완료' : '⏳ 작성 전'}
        </span>
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--text-sub);margin-bottom:4px;">📌 카페 게시글 제목</div>
      <div class="copy-preview" style="max-height:70px;margin-top:0;">${cafeTitle}</div>
      <button type="button" class="btn btn-secondary btn-block" id="btnCopyCafeTitle" style="margin-bottom:12px;">
        📋 카페 게시글 [제목] 복사하기
      </button>

      <div style="font-size:12px;font-weight:700;color:var(--text-sub);margin-bottom:4px;">📝 카페 게시글 본문 (탄단지 블록 상세)</div>
      <div class="copy-preview" style="margin-top:0;">${cafeBody}</div>

      <div style="display:grid;grid-template-columns:1fr;gap:8px;">
        <button type="button" class="btn btn-success btn-block" id="btnCopyCafeBody">
          📋 카페 게시글 [본문] 복사 + '카페 업로드완료' 자동 체크
        </button>
        <a href="${settings.cafeUrl || 'https://cafe.naver.com/'}" target="_blank" rel="noopener" class="btn btn-secondary btn-block" style="text-decoration:none;">
          🌐 네이버 크로스핏 카페 바로 열기 ↗
        </a>
      </div>
    </section>
  `;

  // Canvas 렌더링
  const canvas = document.getElementById('summaryCardCanvas');
  if (canvas) {
    await window.ZoneShareHelper.renderSummaryCardCanvas(canvas, {
      user,
      date: AppState.selectedDate,
      meals,
      missionDone,
      settings
    });
  }

  // 요약 카드 PNG 다운로드
  document.getElementById('btnDownloadCardImg')?.addEventListener('click', () => {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `레벤존다_${user.team}조_${user.name}_${AppState.selectedDate}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('📥 오늘의 식단 요약 카드 이미지가 저장되었습니다!');
  });

  // 모바일 네이티브 공유 (Web Share API)
  document.getElementById('btnNativeShareCard')?.addEventListener('click', async () => {
    if (!canvas) return;
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `레벤존다_${user.team}조_${user.name}_${AppState.selectedDate}.png`, {
        type: 'image/png'
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: cafeTitle,
          text: kakaoText,
          files: [file]
        });
        showToast('📲 공유 창이 열렸습니다!');
      } else {
        await copyToClipboard(kakaoText, '📋 문구가 복사되었으며 요약 카드 이미지를 다운로드합니다!');
        const link = document.createElement('a');
        link.download = `레벤존다_${user.team}조_${user.name}_${AppState.selectedDate}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (e) {
      // 사용자가 공유 창 닫은 경우 무시
    }
  });

  // 단톡방 복사 + 완료 체크
  document.getElementById('btnCopyKakao')?.addEventListener('click', async () => {
    await copyToClipboard(kakaoText, '💬 단톡방 보고 문구가 복사되었습니다! 단톡방에 붙여넣기 하세요.');
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      kakaoReported: true
    });
    await loadState();
  });

  // 카페 제목 복사
  document.getElementById('btnCopyCafeTitle')?.addEventListener('click', async () => {
    await copyToClipboard(cafeTitle, '📋 네이버 카페 게시글 제목이 복사되었습니다!');
  });

  // 카페 본문 복사 + 완료 체크
  document.getElementById('btnCopyCafeBody')?.addEventListener('click', async () => {
    await copyToClipboard(cafeBody, '☕ 카페 본문이 복사되었고 [카페 업로드완료]로 체크되었습니다!');
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      cafePosted: true
    });
    await loadState();
  });
}

// ============================================================================
// TAB 3: 조별 현황 (5개 조 x 4명 = 20명 실시간 보드 & 피드)
// ============================================================================
function renderTeamsTab(container) {
  const participants = AppState.db.participants || [];
  const date = AppState.selectedDate;

  let loggedCount = 0;
  let kakaoCount = 0;
  let cafeCount = 0;
  let overBlockCount = 0;

  participants.forEach(p => {
    const l = getUserDailyLog(p.id, date);
    const meals = l.meals || [];
    const totals = window.ZoneShareHelper.computeTotals(meals);
    if (meals.length > 0) loggedCount++;
    if (l.kakaoReported) kakaoCount++;
    if (l.cafePosted) cafeCount++;
    if (totals.carb > p.targetBlocks || totals.protein > p.targetBlocks || totals.fat > p.targetBlocks) {
      overBlockCount++;
    }
  });

  const teams = [1, 2, 3, 4, 5].filter(
    t => AppState.selectedTeamFilter === 'all' || Number(AppState.selectedTeamFilter) === t
  );

  const teamCardsHtml = teams
    .map(teamNum => {
      const members = participants.filter(p => Number(p.team) === teamNum);
      const teamPenalties = members.reduce((sum, m) => sum + getUserPenalties(m.id).length, 0);
      const missingMembers = [];

      const memberRows = members
        .map(m => {
          const l = getUserDailyLog(m.id, date);
          const meals = l.meals || [];
          const totals = window.ZoneShareHelper.computeTotals(meals);
          const isOver =
            totals.carb > m.targetBlocks ||
            totals.protein > m.targetBlocks ||
            totals.fat > m.targetBlocks;
          const missionDone = isUserWeeklyMissionDone(m.id);
          const pCount = Math.min(10, getUserPenalties(m.id).length);

          if (!l.kakaoReported || !l.cafePosted || meals.length === 0) {
            missingMembers.push(m.name);
          }

          return `
            <div class="member-row" data-inspect-user="${m.id}" style="cursor:pointer;">
              <div class="member-row-top">
                <div class="member-name-wrap">
                  <span>${m.name}</span>
                  <span class="badge ${m.role === '조장' ? 'badge-accent' : ''}" style="font-size:10.5px;padding:2px 6px;">${
            m.role || '조원'
          }</span>
                  <span style="font-size:12px;color:var(--text-sub);font-weight:600;">목표 ${m.targetBlocks}블록</span>
                </div>
                <span style="font-size:12px;font-weight:800;color:${
                  isOver ? '#fca5a5' : meals.length > 0 ? '#fdba74' : 'var(--text-muted)'
                };">
                  ${
                    meals.length > 0
                      ? `탄${formatBlock(totals.carb)}·단${formatBlock(totals.protein)}·지${formatBlock(totals.fat)}`
                      : '식단 미입력'
                  }
                </span>
              </div>
              <div class="member-checks">
                <span class="check-pill ${meals.length > 0 && !isOver ? 'ok' : isOver ? 'missing' : ''}">
                  ${isOver ? '⚠️ 블록초과' : meals.length > 0 ? `🥗 ${meals.length}끼 기록` : '⏳ 식단 미기록'}
                </span>
                <span class="check-pill ${l.kakaoReported ? 'ok' : 'missing'}">
                  ${l.kakaoReported ? '💬 단톡완료' : '💬 단톡미보고'}
                </span>
                <span class="check-pill ${l.cafePosted ? 'ok' : 'missing'}">
                  ${l.cafePosted ? '☕ 카페완료' : '☕ 카페미작성'}
                </span>
                <span class="check-pill ${missionDone ? 'ok' : ''}">
                  ${missionDone ? '🏋️ 주간미션완료' : '🏋️ 주간미션전'}
                </span>
                ${
                  pCount > 0
                    ? `<span class="check-pill missing">🚨 패널티 ${pCount}회</span>`
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <section class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🚩 ${teamNum}조 현황 (${members.length}명)</div>
              <div class="card-subtitle">조 누적 패널티 ${teamPenalties}회 · 조원을 터치하면 오늘 식단 사진을 볼 수 있습니다</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-nudge-team="${teamNum}" data-missing-names="${missingMembers.join(
        ', '
      )}">
              📢 단톡 독촉문구 복사
            </button>
          </div>
          <div class="member-status-list">
            ${memberRows}
          </div>
        </section>
      `;
    })
    .join('');

  container.innerHTML = `
    <!-- 전체 20명 요약 대시보드 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📊 전체 5개 조 (${participants.length}명) 오늘 인증 현황</div>
          <div class="card-subtitle">${date} 밤 12시 마감 기준 실시간 집계</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;">
        <div style="background:#0b1120;padding:10px 6px;border-radius:12px;border:1px solid var(--border-subtle);">
          <div style="font-size:11.5px;color:var(--text-sub);font-weight:700;">식단 기록</div>
          <div style="font-size:18px;font-weight:900;color:#fff;margin-top:3px;">${loggedCount}<small style="font-size:12px;color:var(--text-sub);">/${participants.length}</small></div>
        </div>
        <div style="background:#0b1120;padding:10px 6px;border-radius:12px;border:1px solid var(--border-subtle);">
          <div style="font-size:11.5px;color:var(--text-sub);font-weight:700;">단톡방 보고</div>
          <div style="font-size:18px;font-weight:900;color:#6ee7b7;margin-top:3px;">${kakaoCount}<small style="font-size:12px;color:var(--text-sub);">/${participants.length}</small></div>
        </div>
        <div style="background:#0b1120;padding:10px 6px;border-radius:12px;border:1px solid var(--border-subtle);">
          <div style="font-size:11.5px;color:var(--text-sub);font-weight:700;">카페 업로드</div>
          <div style="font-size:18px;font-weight:900;color:#38bdf8;margin-top:3px;">${cafeCount}<small style="font-size:12px;color:var(--text-sub);">/${participants.length}</small></div>
        </div>
        <div style="background:#0b1120;padding:10px 6px;border-radius:12px;border:1px solid var(--border-subtle);">
          <div style="font-size:11.5px;color:var(--text-sub);font-weight:700;">블록 초과</div>
          <div style="font-size:18px;font-weight:900;color:#fca5a5;margin-top:3px;">${overBlockCount}<small style="font-size:12px;color:var(--text-sub);">명</small></div>
        </div>
      </div>
    </section>

    <!-- 조 선택 필터 -->
    <div class="team-filter-bar">
      <button type="button" class="team-chip ${AppState.selectedTeamFilter === 'all' ? 'active' : ''}" data-team-filter="all">전체 5개조</button>
      ${[1, 2, 3, 4, 5]
        .map(
          t =>
            `<button type="button" class="team-chip ${
              Number(AppState.selectedTeamFilter) === t ? 'active' : ''
            }" data-team-filter="${t}">${t}조 (4명)</button>`
        )
        .join('')}
    </div>

    ${teamCardsHtml}
  `;

  document.querySelectorAll('[data-team-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.selectedTeamFilter = btn.dataset.teamFilter;
      renderMain();
    });
  });

  document.querySelectorAll('[data-nudge-team]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const teamNum = btn.dataset.nudgeTeam;
      const missing = btn.dataset.missingNames;
      const msg = missing
        ? `⏰ [${teamNum}조 밤 12시 마감 알림]\n아직 오늘 식단 단톡 보고 또는 네이버 카페 인증이 완료되지 않은 조원: ${missing}님!\n밤 12시 지나면 1만원 패널티가 부여되니 지금 바로 어플에서 기록 후 올려주세요🔥`
        : `🎉 [${teamNum}조 전원 인증 완료!]\n오늘 ${teamNum}조 4명 전원 밤 12시 전 식단 및 카페 인증 완료했습니다! 고생하셨습니다💪`;
      await copyToClipboard(msg, `📢 ${teamNum}조 단톡방 알림 문구가 복사되었습니다!`);
    });
  });

  document.querySelectorAll('[data-inspect-user]').forEach(row => {
    row.addEventListener('click', () => {
      openMemberDetailModal(row.dataset.inspectUser);
    });
  });
}

function openMemberDetailModal(userId) {
  const member = AppState.db.participants.find(p => p.id === userId);
  if (!member) return;
  const log = getUserDailyLog(member.id, AppState.selectedDate);
  const meals = log.meals || [];
  const totals = window.ZoneShareHelper.computeTotals(meals);
  const modal = document.getElementById('userModal');
  const content = document.getElementById('userModalContent');
  if (!modal || !content) return;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div>
        <h3 style="font-size:17px;font-weight:900;">${member.team}조 ${member.name}님의 식단 상세</h3>
        <div style="font-size:12.5px;color:var(--text-sub);">${AppState.selectedDate} · 목표 각 ${
    member.targetBlocks
  }블록 (섭취 탄${formatBlock(totals.carb)}·단${formatBlock(totals.protein)}·지${formatBlock(
    totals.fat
  )})</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" id="btnCloseInspect">닫기</button>
    </div>
    ${
      meals.length === 0
        ? `<div style="padding:24px;text-align:center;color:var(--text-sub);">이 날짜에 등록된 식단이 없습니다.</div>`
        : `<div class="meal-list">
            ${meals
              .map(
                m => `
              <div class="meal-item">
                ${
                  m.photoDataUrl
                    ? `<img src="${m.photoDataUrl}" class="meal-thumb" alt="${m.type}" />`
                    : `<div class="meal-thumb">🥗</div>`
                }
                <div class="meal-info">
                  <span class="badge badge-accent">${m.type} ${m.time || ''}</span>
                  <div class="meal-blocks-tag">탄 ${formatBlock(m.carb)} · 단 ${formatBlock(
                  m.protein
                )} · 지 ${formatBlock(m.fat)} 블록</div>
                  <div class="meal-memo-text" style="white-space:normal;">${m.memo || ''}</div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>`
    }
    <div style="margin-top:14px;">
      <button type="button" class="btn btn-primary btn-block" id="btnSwitchToThisMember">
        👤 ${member.team}조 ${member.name}(으)로 사용자 전환하기
      </button>
    </div>
  `;

  modal.style.display = 'flex';
  document.getElementById('btnCloseInspect')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  document.getElementById('btnSwitchToThisMember')?.addEventListener('click', () => {
    modal.style.display = 'none';
    openUserSwitchModal(member.id);
  });
}

// ============================================================================
// TAB 4: 주간 미션 운동 & 패널티 (1만원 벌금 / 최대 10번 한도)
// ============================================================================
function renderPenaltyTab(container) {
  const user = getCurrentUser();
  const settings = AppState.db.settings || {};
  const wm = settings.weeklyMission || {};
  const unitAmount = settings.penaltyUnitAmount || 10000;
  const maxCount = settings.maxPenaltyCount || 10;

  const myMissionDone = isUserWeeklyMissionDone(user.id);
  const currentWeekMissions = (AppState.db.missionLogs || []).filter(
    m => m.weekLabel === wm.weekLabel
  );

  // 개인별 패널티 집계 (최대 10회 한도 적용)
  const participantPenaltyStats = (AppState.db.participants || []).map(p => {
    const list = getUserPenalties(p.id);
    const rawCount = list.length;
    const cappedCount = Math.min(maxCount, rawCount);
    const fineAmount = cappedCount * unitAmount;
    return {
      participant: p,
      list,
      rawCount,
      cappedCount,
      fineAmount
    };
  });

  const totalFinePool = participantPenaltyStats.reduce((sum, s) => sum + s.fineAmount, 0);
  const myStat = participantPenaltyStats.find(s => s.participant.id === user.id) || {
    cappedCount: 0,
    fineAmount: 0,
    list: []
  };

  const penaltyTypeLabels = {
    OVER_BLOCK: '⚠️ 일일 블록 초과',
    NO_CAFE: '☕ 카페 12시전 미작성',
    NO_KAKAO: '💬 단톡 12시전 미보고',
    NO_MISSION: '🏋️ 주간 미션운동 미수행',
    MANUAL: '📌 운영진 부여'
  };

  container.innerHTML = `
    <!-- 1. 이번 주 미션 운동 인증 카드 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">🏋️ ${wm.weekLabel || '이번 주 미션 운동'}</div>
          <div class="card-subtitle">${wm.deadlineDay || '일요일 밤 12시 마감'} · 미수행 시 패널티 1회(1만원)</div>
        </div>
        <span class="badge ${myMissionDone ? 'badge-ok' : 'badge-warn'}">
          ${myMissionDone ? '✅ 내 미션 완료' : '⏳ 미션 수행 전'}
        </span>
      </div>

      <div style="background:#0b1120;border:1px solid var(--border-subtle);border-radius:12px;padding:13px;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:900;color:#fdba74;margin-bottom:4px;">🎯 ${wm.title || ''}</div>
        <div style="font-size:12.5px;color:var(--text-sub);">${wm.description || ''}</div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input type="text" class="input-field" id="missionMemoInput" placeholder="운동 기록 입력 (예: 로잉 2,000m 7분 20초 완주!)" />
        <button type="button" class="btn btn-primary" id="btnSubmitMission" style="white-space:nowrap;">
          ✅ 미션 인증
        </button>
      </div>

      <div style="font-size:12.5px;font-weight:800;color:var(--text-sub);margin-bottom:8px;">
        👏 이번 주 미션 완료자 (${currentWeekMissions.length} / ${AppState.db.participants.length}명)
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:190px;overflow-y:auto;">
        ${
          currentWeekMissions.length === 0
            ? `<div style="font-size:12.5px;color:var(--text-muted);">아직 이번 주 미션 인증자가 없습니다. 첫 번째로 인증해보세요!</div>`
            : currentWeekMissions
                .slice()
                .reverse()
                .map(m => {
                  const p = AppState.db.participants.find(u => u.id === m.userId);
                  return `
                    <div style="display:flex;justify-content:space-between;align-items:center;background:#0b1120;padding:8px 11px;border-radius:8px;font-size:12.5px;">
                      <div>
                        <strong style="color:#6ee7b7;">${p ? `${p.team}조 ${p.name}` : '참가자'}</strong>
                        <span style="color:var(--text-main);margin-left:6px;">${m.memo}</span>
                      </div>
                      <span style="color:var(--text-muted);font-size:11px;">${m.date.slice(5)}</span>
                    </div>
                  `;
                })
                .join('')
        }
      </div>
    </section>

    <!-- 2. 패널티 규칙 & 내 벌금 게이지 (1만원 / 최대 10회) -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">💰 패널티 & 벌금 트래커 (최대 ${maxCount}회 한도)</div>
          <div class="card-subtitle">패널티 1회당 ${formatWon(unitAmount)} · 개인 최대 ${maxCount}회(${formatWon(
    maxCount * unitAmount
  )})</div>
        </div>
        <span class="badge badge-accent">총 모인 벌금: ${formatWon(totalFinePool)}</span>
      </div>

      <!-- 내 패널티 10칸 게이지 -->
      <div style="background:#0b1120;border:1px solid var(--border-subtle);border-radius:12px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13.5px;font-weight:800;">👤 ${user.team}조 ${user.name}님의 패널티 현황</span>
          <strong style="font-size:15px;color:${myStat.cappedCount >= 5 ? '#fca5a5' : '#fdba74'};">
            ${myStat.cappedCount} / ${maxCount}회 (${formatWon(myStat.fineAmount)})
          </strong>
        </div>
        <div class="penalty-slots">
          ${Array.from({ length: maxCount })
            .map(
              (_, i) =>
                `<div class="penalty-slot ${i < myStat.cappedCount ? 'filled' : ''} ${
                  myStat.cappedCount >= 7 ? 'high' : ''
                }"></div>`
            )
            .join('')}
        </div>
      </div>

      <!-- 4대 패널티 규칙 요약 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:14px;">
        <div style="background:rgba(15,23,42,0.7);padding:9px 10px;border-radius:8px;border:1px solid var(--border-subtle);">
          <strong style="color:#fca5a5;">① 하루 목표 블록 초과</strong>
          <div style="color:var(--text-sub);margin-top:2px;">정해진 블록보다 더 먹을 경우 +1만원</div>
        </div>
        <div style="background:rgba(15,23,42,0.7);padding:9px 10px;border-radius:8px;border:1px solid var(--border-subtle);">
          <strong style="color:#fca5a5;">② 단톡방 12시 전 미보고</strong>
          <div style="color:var(--text-sub);margin-top:2px;">조 단톡방 식단·비율 지각/누락 +1만원</div>
        </div>
        <div style="background:rgba(15,23,42,0.7);padding:9px 10px;border-radius:8px;border:1px solid var(--border-subtle);">
          <strong style="color:#fca5a5;">③ 네이버카페 12시 전 미작성</strong>
          <div style="color:var(--text-sub);margin-top:2px;">카페 식단글 밤 12시 전 미업로드 +1만원</div>
        </div>
        <div style="background:rgba(15,23,42,0.7);padding:9px 10px;border-radius:8px;border:1px solid var(--border-subtle);">
          <strong style="color:#fca5a5;">④ 주간 미션 운동 미수행</strong>
          <div style="color:var(--text-sub);margin-top:2px;">일주일 미션 운동 미인증 시 +1만원</div>
        </div>
      </div>

      <!-- 참가자별 패널티 현황 리스트 -->
      <div style="font-size:13px;font-weight:800;margin-bottom:8px;">📋 참가자별 누적 패널티 & 벌금 현황</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;">
        ${participantPenaltyStats
          .slice()
          .sort((a, b) => b.cappedCount - a.cappedCount || a.participant.team - b.participant.team)
          .map(
            s => `
            <div style="background:#0b1120;border:1px solid var(--border-subtle);border-radius:10px;padding:10px 12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:13.5px;font-weight:800;">
                  ${s.participant.team}조 ${s.participant.name}
                  ${
                    s.cappedCount >= maxCount
                      ? `<span class="badge badge-danger" style="margin-left:6px;">MAX 10회 도달</span>`
                      : ''
                  }
                </span>
                <span style="font-size:13px;font-weight:800;color:${
                  s.cappedCount > 0 ? '#fca5a5' : '#6ee7b7'
                };">
                  ${s.cappedCount} / ${maxCount}회 · ${formatWon(s.fineAmount)}
                </span>
              </div>
              <div class="penalty-slots">
                ${Array.from({ length: maxCount })
                  .map(
                    (_, i) =>
                      `<div class="penalty-slot ${i < s.cappedCount ? 'filled' : ''} ${
                        s.cappedCount >= 7 ? 'high' : ''
                      }"></div>`
                  )
                  .join('')}
              </div>
            </div>
          `
          )
          .join('')}
      </div>
    </section>

    <!-- 3. 최근 패널티 상세 부과 내역 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📜 전체 패널티 상세 기록 (${AppState.db.penalties.length}건)</div>
          <div class="card-subtitle">언제 어떤 사유로 패널티가 부여되었는지 투명하게 공개됩니다</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${
          AppState.db.penalties.length === 0
            ? `<div style="text-align:center;padding:18px;color:var(--text-sub);font-size:13px;">부여된 패널티가 없습니다!</div>`
            : AppState.db.penalties
                .slice()
                .reverse()
                .map(p => {
                  const member = AppState.db.participants.find(u => u.id === p.userId);
                  return `
                    <div style="background:#0b1120;border:1px solid var(--border-subtle);border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                      <div>
                        <div style="font-size:13px;font-weight:800;">
                          <span style="color:#fdba74;">${member ? `${member.team}조 ${member.name}` : '참가자'}</span>
                          &nbsp;·&nbsp;
                          <span>${penaltyTypeLabels[p.type] || '패널티'}</span>
                        </div>
                        <div style="font-size:12px;color:var(--text-sub);margin-top:2px;">${p.date} | ${p.reason}</div>
                      </div>
                      <strong style="color:#fca5a5;font-size:13px;white-space:nowrap;">+${formatWon(p.amount)}</strong>
                    </div>
                  `;
                })
                .join('')
        }
      </div>
    </section>
  `;

  document.getElementById('btnSubmitMission')?.addEventListener('click', async () => {
    const memoEl = document.getElementById('missionMemoInput');
    const memo = memoEl?.value.trim() || `${wm.title || '주간 미션 운동'} 완료 인증!`;
    await apiRequest('/api/missions', 'POST', {
      userId: user.id,
      weekLabel: wm.weekLabel,
      date: AppState.selectedDate,
      memo
    });
    showToast('🏋️ 이번 주 미션 운동 완료가 인증되었습니다!');
    await loadState();
  });
}

// ============================================================================
// TAB 5: 코치 · 운영진 관리 페이지 (조 편성 / 목표 블록 / 자동 패널티 스캔)
// ============================================================================
function renderAdminTab(container) {
  const settings = AppState.db.settings || {};
  const adminPin = settings.adminPin || '0000';

  if (!AppState.adminUnlocked) {
    container.innerHTML = `
      <section class="card" style="text-align:center;padding:28px 18px;">
        <div style="font-size:36px;margin-bottom:8px;">🔐</div>
        <h3 style="font-size:18px;font-weight:900;margin-bottom:6px;">코치 / 운영진 관리자 모드</h3>
        <p style="font-size:13px;color:var(--text-sub);margin-bottom:16px;">
          20명 조 편성(1~5조), 개인별 하루 목표 블록 설정, 주간 미션 등록,<br/>밤 12시 마감 미인증자 자동 패널티 정산을 관리합니다.
        </p>
        <div style="max-width:260px;margin:0 auto 12px;">
          <input type="password" class="input-field" id="adminPinInput" placeholder="관리자 PIN 4자리 (기본: 0000)" style="text-align:center;font-size:16px;letter-spacing:4px;" value="0000" />
        </div>
        <button type="button" class="btn btn-primary" id="btnUnlockAdmin">관리자 페이지 열기</button>
      </section>
    `;
    document.getElementById('btnUnlockAdmin')?.addEventListener('click', () => {
      const val = document.getElementById('adminPinInput')?.value.trim();
      if (val === adminPin) {
        AppState.adminUnlocked = true;
        sessionStorage.setItem('leben_admin_unlocked', 'true');
        showToast('🔓 코치 관리자 모드가 활성화되었습니다.');
        renderMain();
      } else {
        showToast('❌ 관리자 PIN 번호가 일치하지 않습니다. (기본값: 0000)');
      }
    });
    return;
  }

  const lanIps = AppState.db.serverInfo?.lanIps || [];
  const port = AppState.db.serverInfo?.port || 3000;
  const shareUrl = lanIps.length > 0 ? `http://${lanIps[0]}:${port}` : window.location.origin;

  container.innerHTML = `
    <!-- 1. 밤 12시 마감 위반자 자동 스캔 & 일괄 패널티 부여 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">⚡ 일일 마감 위반자 자동 스캔 & 패널티 정산</div>
          <div class="card-subtitle">${AppState.selectedDate} 기준 블록 초과·단톡 미보고·카페 미작성자를 자동 추출합니다</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <button type="button" class="btn btn-primary" id="btnScanViolations">
          🔍 ${AppState.selectedDate} 위반자 자동 스캔하기
        </button>
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-sub);cursor:pointer;">
          <input type="checkbox" id="chkScanWeeklyMission" />
          일요일 주간 미션 미수행자도 함께 포함
        </label>
      </div>

      <div id="scanResultArea">
        ${
          AppState.scannedViolations
            ? renderScannedViolationsHtml(AppState.scannedViolations)
            : `<div style="font-size:12.5px;color:var(--text-sub);background:#0b1120;padding:12px;border-radius:10px;">
                위 버튼을 누르면 20명 전원의 오늘 목표 블록 초과 여부, 단톡방 보고 여부, 네이버 카페 업로드 여부를 1초 만에 검사합니다.
              </div>`
        }
      </div>
    </section>

    <!-- 2. 수동 패널티 추가 및 취소 관리 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">➕ 수동 패널티 부여 / 기존 패널티 취소</div>
          <div class="card-subtitle">특정 참가자에게 패널티(1만원)를 추가하거나 잘못 부과된 내역을 삭제합니다</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <select class="input-field" id="manualPenaltyUser">
          ${AppState.db.participants
            .map(p => `<option value="${p.id}">${p.team}조 ${p.name}</option>`)
            .join('')}
        </select>
        <select class="input-field" id="manualPenaltyType">
          <option value="OVER_BLOCK">하루 목표 블록 초과</option>
          <option value="NO_CAFE">밤 12시 전 카페 미작성</option>
          <option value="NO_KAKAO">밤 12시 전 단톡 미보고</option>
          <option value="NO_MISSION">주간 미션 운동 미수행</option>
          <option value="MANUAL">기타 규칙 위반</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input type="text" class="input-field" id="manualPenaltyReason" placeholder="사유 입력 (예: 10/27 밤 12시 이후 지각 업로드)" />
        <button type="button" class="btn btn-primary" id="btnAddManualPenalty" style="white-space:nowrap;">+ 1만원 부과</button>
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--text-sub);margin-bottom:6px;">최근 부과된 패널티 내역 (삭제 가능)</div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;">
        ${AppState.db.penalties
          .slice()
          .reverse()
          .map(p => {
            const m = AppState.db.participants.find(u => u.id === p.userId);
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;background:#0b1120;padding:7px 10px;border-radius:8px;font-size:12px;">
                <span><strong>${m ? `${m.team}조 ${m.name}` : ''}</strong> · ${p.date} · ${p.reason}</span>
                <button type="button" class="btn btn-danger btn-sm" data-del-penalty="${p.id}" style="padding:3px 8px;font-size:11px;">삭제</button>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>

    <!-- 3. 주간 미션 운동 & 카페 주소 설정 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">🏋️ 주간 미션 운동 & 챌린지 기본 설정</div>
          <div class="card-subtitle">이번 주 미션 운동과 네이버 크로스핏 카페 링크를 설정합니다</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:12px;color:var(--text-sub);font-weight:700;">챌린지 이름</label>
          <input type="text" class="input-field" id="cfgChallengeName" value="${settings.challengeName || ''}" />
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-sub);font-weight:700;">네이버 크로스핏 카페 URL</label>
          <input type="text" class="input-field" id="cfgCafeUrl" value="${settings.cafeUrl || ''}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;">
          <div>
            <label style="font-size:12px;color:var(--text-sub);font-weight:700;">주차 표시</label>
            <input type="text" class="input-field" id="cfgWeekLabel" value="${settings.weeklyMission?.weekLabel || ''}" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-sub);font-weight:700;">주간 미션 운동 제목</label>
            <input type="text" class="input-field" id="cfgMissionTitle" value="${settings.weeklyMission?.title || ''}" />
          </div>
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-sub);font-weight:700;">주간 미션 상세 안내</label>
          <input type="text" class="input-field" id="cfgMissionDesc" value="${settings.weeklyMission?.description || ''}" />
        </div>
        <button type="button" class="btn btn-primary btn-block" id="btnSaveSettings">💾 챌린지 & 주간 미션 설정 저장</button>
      </div>
    </section>

    <!-- 4. 참가자 20명 & 5개 조 명단/목표블록 관리 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">👥 참가자 명단 · 조 편성(1~5조) · 일일 목표 블록 설정</div>
          <div class="card-subtitle">참가자 이름, 소속 조, 하루 정해진 블록 수, 개인 PIN(4자리)을 수정할 수 있습니다</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnAddParticipant">+ 인원 추가</button>
      </div>

      <div style="overflow-x:auto;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>조</th>
              <th>이름</th>
              <th>역할</th>
              <th>목표블록</th>
              <th>PIN</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody id="adminParticipantTbody">
            ${AppState.db.participants
              .map(
                (p, idx) => `
              <tr data-p-id="${p.id}">
                <td style="width:68px;">
                  <select class="p-team">
                    ${[1, 2, 3, 4, 5]
                      .map(t => `<option value="${t}" ${Number(p.team) === t ? 'selected' : ''}>${t}조</option>`)
                      .join('')}
                  </select>
                </td>
                <td><input type="text" class="p-name" value="${p.name}" /></td>
                <td style="width:72px;">
                  <select class="p-role">
                    <option value="조장" ${p.role === '조장' ? 'selected' : ''}>조장</option>
                    <option value="조원" ${p.role !== '조장' ? 'selected' : ''}>조원</option>
                  </select>
                </td>
                <td style="width:74px;"><input type="number" class="p-blocks" value="${p.targetBlocks}" min="5" max="25" step="1" /></td>
                <td style="width:74px;"><input type="text" class="p-pin" value="${p.pin || '1234'}" maxlength="4" /></td>
                <td style="width:52px;">
                  <button type="button" class="btn btn-danger btn-sm" data-remove-idx="${idx}" style="padding:4px 7px;">삭제</button>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:12px;">
        <button type="button" class="btn btn-success btn-block" id="btnSaveParticipants">
          💾 참가자 명단 및 목표 블록 일괄 저장
        </button>
      </div>
    </section>

    <!-- 5. 카톡방 링크 공유 & 데이터 초기화 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📱 단톡방 공유 안내 & 데이터 초기화</div>
          <div class="card-subtitle">같은 와이파이에서는 아래 주소로 스마트폰 접속이 가능하며, 외부 배포 시 어디서나 접속됩니다</div>
        </div>
      </div>
      <div style="background:#0b1120;padding:12px;border-radius:10px;font-size:13px;margin-bottom:12px;">
        <div>🔗 <strong>현재 접속 링크:</strong> <span style="color:#fdba74;">${shareUrl}</span></div>
        <div style="color:var(--text-sub);font-size:12px;margin-top:4px;">
          스마트폰 브라우저(크롬/사파리)에서 접속 후 <strong>[홈 화면에 추가]</strong>를 누르면 일반 앱처럼 아이콘이 생성됩니다.
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button type="button" class="btn btn-danger" id="btnClearAllLogs">🧹 기록만 비우기 (새 챌린지 시작)</button>
        <button type="button" class="btn btn-secondary" id="btnResetDemo">🔄 샘플 데모 데이터 복원</button>
      </div>
    </section>
  `;

  bindAdminEvents();
}

function renderScannedViolationsHtml(violations) {
  if (violations.length === 0) {
    return `<div style="padding:14px;background:var(--success-soft);border:1px solid var(--success);border-radius:10px;color:#6ee7b7;font-size:13px;font-weight:700;">
      🎉 선택한 날짜(${AppState.selectedDate})에 새로 부과할 규칙 위반자가 없습니다!
    </div>`;
  }
  return `
    <div style="background:#0b1120;border:1px solid var(--border-subtle);border-radius:12px;padding:12px;">
      <div style="font-size:13px;font-weight:800;color:#fca5a5;margin-bottom:8px;">
        🚨 총 ${violations.length}건의 규칙 위반(미인증/블록초과)이 감지되었습니다
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;margin-bottom:12px;">
        ${violations
          .map(
            (v, idx) => `
          <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;background:var(--bg-card);padding:8px 10px;border-radius:8px;cursor:pointer;">
            <input type="checkbox" class="chk-violation-item" data-v-idx="${idx}" checked />
            <span><strong>${v.team}조 ${v.userName}</strong> — ${v.reason} <span style="color:#fca5a5;">(+10,000원)</span></span>
          </label>
        `
          )
          .join('')}
      </div>
      <button type="button" class="btn btn-primary btn-block" id="btnApplyScannedPenalties">
        ⚡ 선택된 항목 일괄 패널티(건당 1만원) 부여하기
      </button>
    </div>
  `;
}

function bindAdminEvents() {
  // 위반자 자동 스캔
  document.getElementById('btnScanViolations')?.addEventListener('click', () => {
    const date = AppState.selectedDate;
    const includeMission = document.getElementById('chkScanWeeklyMission')?.checked;
    const maxCount = AppState.db.settings?.maxPenaltyCount || 10;
    const violations = [];

    AppState.db.participants.forEach(p => {
      const existingCount = getUserPenalties(p.id).length;
      if (existingCount >= maxCount) return; // 최대 10번 한도 도달자 제외

      const log = getUserDailyLog(p.id, date);
      const meals = log.meals || [];
      const totals = window.ZoneShareHelper.computeTotals(meals);

      // 1) 하루 목표 블록 초과 검사
      if (
        totals.carb > p.targetBlocks ||
        totals.protein > p.targetBlocks ||
        totals.fat > p.targetBlocks
      ) {
        violations.push({
          userId: p.id,
          userName: p.name,
          team: p.team,
          date,
          type: 'OVER_BLOCK',
          reason: `일일 목표 블록(${p.targetBlocks}) 초과 섭취 (탄${formatBlock(totals.carb)}·단${formatBlock(
            totals.protein
          )}·지${formatBlock(totals.fat)})`
        });
      }

      // 2) 밤 12시 전 단톡방 미보고 검사
      if (!log.kakaoReported) {
        violations.push({
          userId: p.id,
          userName: p.name,
          team: p.team,
          date,
          type: 'NO_KAKAO',
          reason: `밤 12시 전 ${p.team}조 단톡방 식단·비율 미보고`
        });
      }

      // 3) 밤 12시 전 네이버 카페 미작성 검사
      if (!log.cafePosted) {
        violations.push({
          userId: p.id,
          userName: p.name,
          team: p.team,
          date,
          type: 'NO_CAFE',
          reason: `밤 12시 전 네이버 카페 식단 게시글 미작성`
        });
      }

      // 4) 주간 미션 미수행 검사 (체크 시)
      if (includeMission && !isUserWeeklyMissionDone(p.id)) {
        violations.push({
          userId: p.id,
          userName: p.name,
          team: p.team,
          date,
          type: 'NO_MISSION',
          reason: `${AppState.db.settings?.weeklyMission?.weekLabel || '주간'} 미션 운동 미수행`
        });
      }
    });

    AppState.scannedViolations = violations;
    renderMain();
  });

  // 스캔된 위반자 일괄 부과
  document.getElementById('btnApplyScannedPenalties')?.addEventListener('click', async () => {
    const checks = document.querySelectorAll('.chk-violation-item:checked');
    const selected = [];
    checks.forEach(chk => {
      const idx = Number(chk.dataset.vIdx);
      if (AppState.scannedViolations?.[idx]) {
        selected.push(AppState.scannedViolations[idx]);
      }
    });
    if (selected.length === 0) {
      showToast('선택된 패널티 항목이 없습니다.');
      return;
    }
    await apiRequest('/api/penalties', 'POST', {
      action: 'bulk_add',
      penalties: selected
    });
    AppState.scannedViolations = null;
    showToast(`⚡ ${selected.length}건의 패널티가 일괄 반영되었습니다!`);
    await loadState();
  });

  // 수동 패널티 추가
  document.getElementById('btnAddManualPenalty')?.addEventListener('click', async () => {
    const userId = document.getElementById('manualPenaltyUser')?.value;
    const type = document.getElementById('manualPenaltyType')?.value;
    const reasonInput = document.getElementById('manualPenaltyReason')?.value.trim();
    const defaultReasons = {
      OVER_BLOCK: '하루 목표 블록 초과 섭취',
      NO_CAFE: '밤 12시 전 네이버 카페 미작성',
      NO_KAKAO: '밤 12시 전 조별 단톡방 미보고',
      NO_MISSION: '주간 미션 운동 미수행',
      MANUAL: '챌린지 규칙 미준수'
    };
    await apiRequest('/api/penalties', 'POST', {
      penalty: {
        userId,
        date: AppState.selectedDate,
        type,
        reason: reasonInput || defaultReasons[type]
      }
    });
    showToast('➕ 패널티 1회(1만원)가 부여되었습니다.');
    await loadState();
  });

  // 패널티 삭제
  document.querySelectorAll('[data-del-penalty]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await apiRequest('/api/penalties', 'POST', {
        action: 'delete',
        penaltyId: btn.dataset.delPenalty
      });
      showToast('🗑️ 해당 패널티 내역이 삭제(취소)되었습니다.');
      await loadState();
    });
  });

  // 설정 저장
  document.getElementById('btnSaveSettings')?.addEventListener('click', async () => {
    const challengeName = document.getElementById('cfgChallengeName')?.value.trim();
    const cafeUrl = document.getElementById('cfgCafeUrl')?.value.trim();
    const weekLabel = document.getElementById('cfgWeekLabel')?.value.trim();
    const title = document.getElementById('cfgMissionTitle')?.value.trim();
    const description = document.getElementById('cfgMissionDesc')?.value.trim();

    await apiRequest('/api/admin/update', 'POST', {
      settings: {
        challengeName,
        cafeUrl,
        weeklyMission: {
          weekLabel,
          title,
          description,
          deadlineDay: '일요일 24:00 마감'
        }
      }
    });
    showToast('💾 챌린지 및 주간 미션 설정이 저장되었습니다!');
    await loadState();
  });

  // 참가자 추가
  document.getElementById('btnAddParticipant')?.addEventListener('click', async () => {
    const list = [...AppState.db.participants];
    const nextNum = list.length + 1;
    const team = ((nextNum - 1) % 5) + 1;
    list.push({
      id: `u_${Date.now()}`,
      name: `새참가자${nextNum}`,
      team,
      role: '조원',
      targetBlocks: 11,
      pin: '1234'
    });
    await apiRequest('/api/admin/update', 'POST', { participants: list });
    showToast('👤 새 참가자가 추가되었습니다.');
    await loadState();
  });

  // 참가자 삭제
  document.querySelectorAll('[data-remove-idx]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.removeIdx);
      const list = AppState.db.participants.filter((_, i) => i !== idx);
      await apiRequest('/api/admin/update', 'POST', { participants: list });
      showToast('참가자가 명단에서 삭제되었습니다.');
      await loadState();
    });
  });

  // 참가자 명단 일괄 저장
  document.getElementById('btnSaveParticipants')?.addEventListener('click', async () => {
    const rows = document.querySelectorAll('#adminParticipantTbody tr');
    const updated = [];
    rows.forEach(tr => {
      const id = tr.dataset.pId;
      const team = Number(tr.querySelector('.p-team')?.value || 1);
      const name = tr.querySelector('.p-name')?.value.trim() || '참가자';
      const role = tr.querySelector('.p-role')?.value || '조원';
      const targetBlocks = Number(tr.querySelector('.p-blocks')?.value || 11);
      const pin = tr.querySelector('.p-pin')?.value.trim() || '1234';
      updated.push({ id, name, team, role, targetBlocks, pin });
    });
    await apiRequest('/api/admin/update', 'POST', { participants: updated });
    showToast('💾 참가자 조 편성 및 목표 블록이 모두 저장되었습니다!');
    await loadState();
  });

  // 기록 비우기 / 데모 복원
  document.getElementById('btnClearAllLogs')?.addEventListener('click', async () => {
    await apiRequest('/api/admin/update', 'POST', { action: 'clear_logs' });
    showToast('🧹 식단·미션·패널티 기록이 초기화되었습니다! (명단은 유지됨)');
    await loadState();
  });

  document.getElementById('btnResetDemo')?.addEventListener('click', async () => {
    await apiRequest('/api/admin/update', 'POST', { action: 'reset_demo' });
    showToast('🔄 샘플 데모 데이터가 복원되었습니다!');
    await loadState();
  });
}

// ============================================================================
// 참가자 전환 & 4자리 PIN 모달
// ============================================================================
function openUserSwitchModal(preselectUserId = null) {
  const modal = document.getElementById('userModal');
  const content = document.getElementById('userModalContent');
  if (!modal || !content || !AppState.db) return;

  let chosenId = preselectUserId || AppState.currentUserId;

  function renderModalInner() {
    const chosenUser = AppState.db.participants.find(p => p.id === chosenId) || AppState.db.participants[0];
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <h3 style="font-size:17px;font-weight:900;">👤 내 이름 선택 & 간편 접속</h3>
          <div style="font-size:12px;color:var(--text-sub);">소속 조와 이름을 선택하고 4자리 PIN(초기값 1234)을 입력하세요</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnCloseUserModal">닫기</button>
      </div>

      <div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
        ${[1, 2, 3, 4, 5]
          .map(teamNum => {
            const members = AppState.db.participants.filter(p => Number(p.team) === teamNum);
            return `
              <div>
                <div style="font-size:12px;font-weight:800;color:#fdba74;margin-bottom:5px;">🚩 ${teamNum}조</div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
                  ${members
                    .map(
                      m => `
                    <button type="button" class="btn ${
                      m.id === chosenId ? 'btn-primary' : 'btn-secondary'
                    } btn-sm" data-pick-uid="${m.id}" style="justify-content:space-between;">
                      <span>${m.name}</span>
                      <small style="opacity:0.8;">${m.targetBlocks}블록</small>
                    </button>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `;
          })
          .join('')}
      </div>

      <div style="background:#0b1120;padding:12px;border-radius:12px;border:1px solid var(--border-subtle);">
        <div style="font-size:13px;font-weight:800;margin-bottom:6px;">
          🔐 <strong>${chosenUser.team}조 ${chosenUser.name}</strong>님의 4자리 PIN 번호
        </div>
        <div style="display:flex;gap:8px;">
          <input type="password" class="input-field" id="pinVerifyInput" maxlength="4" value="${
            chosenUser.pin || '1234'
          }" placeholder="4자리 숫자 (기본 1234)" style="letter-spacing:4px;text-align:center;font-weight:800;" />
          <button type="button" class="btn btn-primary" id="btnConfirmUserSwitch" style="white-space:nowrap;">
            접속하기
          </button>
        </div>
      </div>
    `;

    content.querySelector('#btnCloseUserModal')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    content.querySelectorAll('[data-pick-uid]').forEach(btn => {
      btn.addEventListener('click', () => {
        chosenId = btn.dataset.pickUid;
        renderModalInner();
      });
    });

    content.querySelector('#btnConfirmUserSwitch')?.addEventListener('click', () => {
      const enteredPin = content.querySelector('#pinVerifyInput')?.value.trim();
      if (enteredPin !== (chosenUser.pin || '1234')) {
        showToast('❌ PIN 번호가 일치하지 않습니다.');
        return;
      }
      AppState.currentUserId = chosenUser.id;
      localStorage.setItem('leben_user_id', chosenUser.id);
      modal.style.display = 'none';
      showToast(`👋 반갑습니다! ${chosenUser.team}조 ${chosenUser.name}님으로 접속되었습니다.`);
      renderHeader();
      renderMain();
    });
  }

  renderModalInner();
  modal.style.display = 'flex';
}

// ============================================================================
// 초기화 및 글로벌 이벤트 연결
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
  // PWA Service Worker 등록
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // 탭 전환
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.activeTab = btn.dataset.tab;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      renderMain();
    });
  });

  // 참가자 전환 모달
  document.getElementById('btnSwitchUser')?.addEventListener('click', () => {
    openUserSwitchModal();
  });

  // 날짜 이동
  const picker = document.getElementById('datePicker');
  picker?.addEventListener('change', e => {
    if (e.target.value) {
      AppState.selectedDate = e.target.value;
      AppState.scannedViolations = null;
      renderMain();
    }
  });

  document.getElementById('btnPrevDate')?.addEventListener('click', () => {
    const d = new Date(AppState.selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    AppState.selectedDate = d.toISOString().slice(0, 10);
    if (picker) picker.value = AppState.selectedDate;
    AppState.scannedViolations = null;
    renderMain();
  });

  document.getElementById('btnNextDate')?.addEventListener('click', () => {
    const d = new Date(AppState.selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    AppState.selectedDate = d.toISOString().slice(0, 10);
    if (picker) picker.value = AppState.selectedDate;
    AppState.scannedViolations = null;
    renderMain();
  });

  document.getElementById('btnTodayDate')?.addEventListener('click', () => {
    AppState.selectedDate =
      AppState.db?.serverInfo?.todayKst || new Date().toISOString().slice(0, 10);
    if (picker) picker.value = AppState.selectedDate;
    AppState.scannedViolations = null;
    renderMain();
  });

  updateMidnightCountdown();
  setInterval(updateMidnightCountdown, 1000);

  await loadState();
});
