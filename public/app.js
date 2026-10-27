// LEBEN ZONE CHALLENGE 프론트엔드 클라이언트

const Icons = {
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  camera: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  copy: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  download: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
  share: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>`,
  arrowRight: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  external: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>`,
  lock: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
};

const AppState = {
  db: null,
  currentUserId: localStorage.getItem('leben_user_id') || 'u1',
  selectedDate: '',
  activeTab: 'diet',
  selectedTeamFilter: 'all',
  adminUnlocked: sessionStorage.getItem('leben_admin_unlocked') === 'true',
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
  }, 2400);
}

function formatBlock(n) {
  const num = Number(n || 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
}

function formatWon(amount) {
  return Number(amount || 0).toLocaleString('ko-KR') + '원';
}

async function copyToClipboard(text, successMsg = '클립보드에 복사되었습니다') {
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
  const teamTagEl = document.getElementById('currentUserTeamTag');
  const badgeEl = document.getElementById('currentUserBadge');
  if (user) {
    if (teamTagEl) teamTagEl.textContent = `${user.team}조`;
    if (badgeEl) badgeEl.textContent = `${user.name} · ${user.targetBlocks}B`;
  }
  const picker = document.getElementById('datePicker');
  if (picker && picker.value !== AppState.selectedDate) {
    picker.value = AppState.selectedDate;
  }
}

function updateMidnightCountdown() {
  const el = document.getElementById('midnightCountdownText');
  if (!el) return;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = midnight - now;
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  const pad = n => String(n).padStart(2, '0');
  el.textContent = `자정 마감 ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function compressImageFile(file, maxWidth = 720, quality = 0.84) {
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
  const presets = {
    아침: ['BREAKFAST', '#E07A5F', '#F2CC8F'],
    점심: ['LUNCH', '#BC4749', '#E6CCB2'],
    저녁: ['DINNER', '#F4845F', '#84A59D'],
    간식: ['SNACK', '#6D597A', '#E56B6F']
  };
  const [label, c1, c2] = presets[mealType] || presets['아침'];
  const macroTag = `${formatBlock(c)} · ${formatBlock(p)} · ${formatBlock(f)} BLOCK`;
  const sub = memo || `${mealType} 존 다이어트 식단`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">
    <rect width="600" height="450" fill="#18191C"/>
    <circle cx="300" cy="210" r="168" fill="#23252A"/>
    <circle cx="300" cy="210" r="144" fill="#F7F7F5" stroke="#E4E4E0" stroke-width="4"/>
    <line x1="300" y1="66" x2="300" y2="354" stroke="#E5E5E0" stroke-width="2" stroke-dasharray="4 4"/>
    <line x1="300" y1="210" x2="444" y2="210" stroke="#E5E5E0" stroke-width="2" stroke-dasharray="4 4"/>
    <circle cx="232" cy="185" r="46" fill="${c1}" opacity="0.88"/>
    <circle cx="242" cy="256" r="34" fill="#4D7C5D" opacity="0.85"/>
    <rect x="322" y="128" width="68" height="54" rx="22" fill="${c2}" opacity="0.9"/>
    <circle cx="356" cy="264" r="36" fill="#D9A05B" opacity="0.9"/>
    <rect x="28" y="26" width="96" height="32" rx="16" fill="rgba(255,255,255,0.1)"/>
    <text x="76" y="47" font-family="Pretendard, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#FFFFFF" text-anchor="middle">${label}</text>
    <rect x="444" y="26" width="128" height="32" rx="16" fill="#C8F904"/>
    <text x="508" y="47" font-family="Pretendard, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#111315" text-anchor="middle">${macroTag}</text>
    <rect x="0" y="376" width="600" height="74" fill="rgba(17,19,21,0.86)"/>
    <text x="32" y="420" font-family="Pretendard, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#F4F5F7">${sub}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ============================================================================
// 메인 화면 렌더링
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
// TAB 1: 식단 기록
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

  const macroCellsHtml = [
    { key: 'carb', label: '탄수화물 C', val: totals.carb, color: '#38BDF8', unit: '9g/블록' },
    { key: 'protein', label: '단백질 P', val: totals.protein, color: '#C8F904', unit: '7g/블록' },
    { key: 'fat', label: '지방 F', val: totals.fat, color: '#FBBF24', unit: '1.5g/블록' }
  ]
    .map(m => {
      const pct = Math.min(100, Math.round((m.val / Math.max(target, 1)) * 100));
      const overThis = m.val > target;
      const remain = target - m.val;
      const footLabel = overThis
        ? `<span style="color:#FF6B57;">+${formatBlock(m.val - target)}B 초과</span>`
        : remain === 0
        ? `<span style="color:#C8F904;">목표 달성</span>`
        : `잔여 ${formatBlock(remain)}B`;

      return `
        <div class="hero-macro-cell">
          <div class="hero-macro-label">
            <span>${m.label}</span>
          </div>
          <div class="hero-macro-num" style="color:${overThis ? '#FF6B57' : '#FFFFFF'};">
            ${formatBlock(m.val)}<small>/ ${target}</small>
          </div>
          <div class="hero-bar-track">
            <div class="hero-bar-fill" style="width:${pct}%;background:${overThis ? '#FF4E36' : m.color};"></div>
          </div>
          <div class="hero-macro-foot">${footLabel}</div>
        </div>
      `;
    })
    .join('');

  const mf = AppState.mealForm;

  container.innerHTML = `
    <!-- 다크 카본 히어로 요약 카드 -->
    <section class="card-hero">
      <div class="card-header" style="margin-bottom:12px;">
        <div>
          <div class="section-eyebrow">DAILY ZONE BLOCKS</div>
          <div class="card-title">${user.team}조 ${user.name} · 목표 ${target}블록</div>
          <div class="card-subtitle">${AppState.selectedDate.replace(/-/g, '.')} 기준 섭취량</div>
        </div>
        <span class="tag ${isOver ? 'tag-danger' : meals.length > 0 ? 'tag-volt' : 'tag-neutral'}">
          ${isOver ? '목표 초과' : meals.length > 0 ? '정상 범위' : '기록 대기'}
        </span>
      </div>

      <div class="hero-macro-grid">
        ${macroCellsHtml}
      </div>

      <div class="hero-ratio-bar">
        <span style="color:#9CA3AF;font-weight:600;">탄 : 단 : 지 블록 비율</span>
        <strong style="color:#FFFFFF;font-weight:700;">${ratioText}</strong>
      </div>

      ${
        isOver
          ? `<div style="margin-top:10px;padding:10px 13px;border-radius:11px;background:rgba(255,78,54,0.14);border:1px solid rgba(255,78,54,0.35);color:#FF8575;font-size:12.5px;font-weight:600;">
              일일 목표(${target}블록)를 초과하여 패널티 부과 대상입니다.
            </div>`
          : ''
      }

      <!-- 자정 전 필수 인증 스위치 -->
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:#9CA3AF;">24:00 마감 필수 체크</span>
          <span style="font-size:11.5px;color:#6B7280;">누적 벌금 ${formatWon(penaltyCount * 10000)} (${penaltyCount}/${maxPenalties}회)</span>
        </div>
        <div class="cert-switch-grid">
          <button type="button" class="cert-switch-btn ${log.kakaoReported ? 'done' : ''}" id="btnToggleKakao">
            <div>
              <div class="cert-switch-label">조 단톡방 보고</div>
              <div class="cert-switch-sub">${log.kakaoReported ? '보고 완료됨' : '미보고 상태'}</div>
            </div>
            <span class="check-circle">${log.kakaoReported ? Icons.check : ''}</span>
          </button>
          <button type="button" class="cert-switch-btn ${log.cafePosted ? 'done' : ''}" id="btnToggleCafe">
            <div>
              <div class="cert-switch-label">네이버 카페 인증</div>
              <div class="cert-switch-sub">${log.cafePosted ? '작성 완료됨' : '미작성 상태'}</div>
            </div>
            <span class="check-circle">${log.cafePosted ? Icons.check : ''}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- 끼니 입력 카드 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">MEAL ENTRY</div>
          <div class="card-title">${mf.editingId ? '끼니 기록 수정' : '식단 및 블록 기록'}</div>
        </div>
        ${
          mf.editingId
            ? `<button type="button" class="btn btn-secondary btn-sm" id="btnCancelEditMeal">취소</button>`
            : ''
        }
      </div>

      <!-- 끼니 세그먼트 탭 -->
      <div class="segmented-tabs">
        ${['아침', '점심', '저녁', '간식']
          .map(
            t =>
              `<button type="button" class="seg-tab ${mf.type === t ? 'active' : ''}" data-meal-type="${t}">${t}</button>`
          )
          .join('')}
      </div>

      <!-- 1:1:1 빠른 블록 선택 -->
      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:8px;">
        균형 블록 빠른 선택 (탄·단·지 동일 적용)
      </div>
      <div class="preset-strip">
        ${[1, 2, 3, 3.5, 4, 5]
          .map(
            b =>
              `<button type="button" class="preset-pill ${
                mf.carb === b && mf.protein === b && mf.fat === b ? 'active' : ''
              }" data-preset-block="${b}">${b}블록</button>`
          )
          .join('')}
      </div>

      <!-- 탄 / 단 / 지 개별 스테퍼 -->
      <div class="stepper-grid">
        <div class="stepper-card">
          <div class="stepper-label">탄수화물 C</div>
          <div class="stepper-value">${formatBlock(mf.carb)}<small>B</small></div>
          <div class="stepper-actions">
            <button type="button" data-step-macro="carb" data-step-delta="-0.5">-0.5</button>
            <button type="button" data-step-macro="carb" data-step-delta="0.5">+0.5</button>
          </div>
        </div>
        <div class="stepper-card">
          <div class="stepper-label">단백질 P</div>
          <div class="stepper-value">${formatBlock(mf.protein)}<small>B</small></div>
          <div class="stepper-actions">
            <button type="button" data-step-macro="protein" data-step-delta="-0.5">-0.5</button>
            <button type="button" data-step-macro="protein" data-step-delta="0.5">+0.5</button>
          </div>
        </div>
        <div class="stepper-card">
          <div class="stepper-label">지방 F</div>
          <div class="stepper-value">${formatBlock(mf.fat)}<small>B</small></div>
          <div class="stepper-actions">
            <button type="button" data-step-macro="fat" data-step-delta="-0.5">-0.5</button>
            <button type="button" data-step-macro="fat" data-step-delta="0.5">+0.5</button>
          </div>
        </div>
      </div>

      <!-- 사진 업로드 -->
      <div class="photo-dropzone" id="photoUploadTrigger">
        <input type="file" id="mealPhotoInput" accept="image/*" style="display:none;" />
        <div style="display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;color:var(--text-primary);">
          ${Icons.camera}
          <span>식단 사진 첨부</span>
        </div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:3px;">
          등록한 사진은 일일 요약 카드 이미지로 자동 병합됩니다
        </div>
        ${
          mf.photoDataUrl
            ? `<img src="${mf.photoDataUrl}" class="photo-preview-img" alt="식단 미리보기" />`
            : ''
        }
      </div>

      <div style="display:flex;justify-content:flex-end;gap:6px;margin-bottom:12px;">
        <button type="button" class="btn btn-secondary btn-sm" id="btnUseSamplePhoto">플레이트 그래픽 자동 적용</button>
        ${
          mf.photoDataUrl
            ? `<button type="button" class="btn btn-danger btn-sm" id="btnClearPhoto">사진 삭제</button>`
            : ''
        }
      </div>

      <div style="margin-bottom:14px;">
        <input type="text" class="input-field" id="mealMemoInput" placeholder="식단 메모 (예: 닭가슴살 100g, 현미밥, 아몬드)" value="${
          mf.memo || ''
        }" />
      </div>

      <button type="button" class="btn btn-primary btn-block" id="btnSaveMeal">
        ${mf.editingId ? '끼니 수정 저장' : '오늘 식단에 추가'}
      </button>
    </section>

    <!-- 오늘 기록된 끼니 리스트 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">TODAY'S LOGS</div>
          <div class="card-title">기록된 끼니 (${meals.length})</div>
        </div>
      </div>

      ${
        meals.length === 0
          ? `<div style="text-align:center;padding:28px 12px;color:var(--text-tertiary);font-size:13.5px;">
              아직 기록된 끼니가 없습니다.
            </div>`
          : `<div class="meal-list">
              ${meals
                .map(
                  m => `
                <div class="meal-item">
                  ${
                    m.photoDataUrl
                      ? `<img src="${m.photoDataUrl}" class="meal-thumb" alt="${m.type}" />`
                      : `<div class="meal-thumb"></div>`
                  }
                  <div class="meal-info">
                    <div class="meal-info-top">
                      <span class="tag tag-neutral">${m.type}${m.time ? ` · ${m.time}` : ''}</span>
                      <div style="display:flex;gap:5px;">
                        <button type="button" class="btn btn-outline btn-sm" data-edit-meal="${m.id}">수정</button>
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
        <button type="button" class="btn btn-outline btn-block" id="btnGoShareTab">
          <span>인증 카드 생성 및 카페·단톡 공유</span>
          ${Icons.arrowRight}
        </button>
      </div>
    </section>
  `;

  bindDietTabEvents(user, log);
}

function bindDietTabEvents(user, log) {
  document.getElementById('btnToggleKakao')?.addEventListener('click', async () => {
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      kakaoReported: !log.kakaoReported
    });
    showToast(!log.kakaoReported ? '조 단톡방 보고 완료로 변경되었습니다' : '단톡방 보고 체크가 해제되었습니다');
    await loadState();
  });

  document.getElementById('btnToggleCafe')?.addEventListener('click', async () => {
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      cafePosted: !log.cafePosted
    });
    showToast(!log.cafePosted ? '네이버 카페 인증 완료로 변경되었습니다' : '네이버 카페 체크가 해제되었습니다');
    await loadState();
  });

  document.querySelectorAll('[data-meal-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.mealForm.type = btn.dataset.mealType;
      renderMain();
    });
  });

  document.querySelectorAll('[data-preset-block]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.presetBlock);
      AppState.mealForm.carb = val;
      AppState.mealForm.protein = val;
      AppState.mealForm.fat = val;
      renderMain();
    });
  });

  document.querySelectorAll('[data-step-macro]').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.stepMacro;
      const delta = Number(btn.dataset.stepDelta);
      const next = Math.max(0, Math.min(20, Number(AppState.mealForm[macro] || 0) + delta));
      AppState.mealForm[macro] = next;
      renderMain();
    });
  });

  const memoInput = document.getElementById('mealMemoInput');
  memoInput?.addEventListener('input', e => {
    AppState.mealForm.memo = e.target.value;
  });

  const photoTrigger = document.getElementById('photoUploadTrigger');
  const photoInput = document.getElementById('mealPhotoInput');
  photoTrigger?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      AppState.mealForm.photoDataUrl = dataUrl;
      showToast('식단 사진이 첨부되었습니다');
      renderMain();
    } catch (err) {
      showToast('사진을 불러오지 못했습니다');
    }
  });

  document.getElementById('btnUseSamplePhoto')?.addEventListener('click', () => {
    const mf = AppState.mealForm;
    mf.photoDataUrl = makeQuickSampleFoodPhoto(mf.type, mf.carb, mf.protein, mf.fat, mf.memo);
    showToast('플레이트 그래픽이 적용되었습니다');
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

    showToast(mf.editingId ? '끼니 기록이 수정되었습니다' : '식단이 추가되었습니다');
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
      window.scrollTo({ top: 200, behavior: 'smooth' });
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
      showToast('끼니 기록이 삭제되었습니다');
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
// TAB 2: 인증 카드 & 카페·단톡 공유
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
    <!-- 1. 에디토리얼 요약 카드 이미지 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">SUMMARY CARD</div>
          <div class="card-title">일일 식단 인증 카드</div>
          <div class="card-subtitle">오늘 기록한 끼니 사진과 블록 현황을 한 장의 이미지로 저장합니다</div>
        </div>
      </div>

      <div class="summary-canvas-wrap">
        <canvas id="summaryCardCanvas"></canvas>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <button type="button" class="btn btn-primary" id="btnDownloadCardImg">
          ${Icons.download}
          <span>이미지 저장</span>
        </button>
        <button type="button" class="btn btn-secondary" id="btnNativeShareCard">
          ${Icons.share}
          <span>모바일 공유</span>
        </button>
      </div>
    </section>

    <!-- 2. 조별 단톡방 보고 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">TEAM CHAT REPORT</div>
          <div class="card-title">${user.team}조 단톡방 보고 문구</div>
          <div class="card-subtitle">복사 시 단톡방 보고 완료 상태로 자동 전환됩니다</div>
        </div>
        <span class="tag ${log.kakaoReported ? 'tag-ok' : 'tag-neutral'}">
          ${log.kakaoReported ? '보고 완료' : '보고 전'}
        </span>
      </div>

      <div class="copy-preview" id="kakaoTextPreview">${kakaoText}</div>

      <button type="button" class="btn btn-primary btn-block" id="btnCopyKakao">
        ${Icons.copy}
        <span>단톡방 문구 복사 및 보고 완료 체크</span>
      </button>
    </section>

    <!-- 3. 네이버 카페 게시글 양식 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">NAVER CAFE POST</div>
          <div class="card-title">네이버 카페 게시글 양식</div>
          <div class="card-subtitle">24:00 전까지 카페에 제목·본문과 인증 카드를 업로드하세요</div>
        </div>
        <span class="tag ${log.cafePosted ? 'tag-ok' : 'tag-neutral'}">
          ${log.cafePosted ? '업로드 완료' : '작성 전'}
        </span>
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:4px;">게시글 제목</div>
      <div class="copy-preview" style="max-height:68px;margin-top:0;">${cafeTitle}</div>
      <button type="button" class="btn btn-secondary btn-block" id="btnCopyCafeTitle" style="margin-bottom:14px;">
        ${Icons.copy}
        <span>제목 복사</span>
      </button>

      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:4px;">게시글 본문</div>
      <div class="copy-preview" style="margin-top:0;">${cafeBody}</div>

      <div style="display:grid;grid-template-columns:1fr;gap:8px;">
        <button type="button" class="btn btn-primary btn-block" id="btnCopyCafeBody">
          ${Icons.copy}
          <span>본문 복사 및 카페 인증 완료 체크</span>
        </button>
        <a href="${settings.cafeUrl || 'https://cafe.naver.com/'}" target="_blank" rel="noopener" class="btn btn-outline btn-block">
          <span>네이버 카페 열기</span>
          ${Icons.external}
        </a>
      </div>
    </section>
  `;

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

  document.getElementById('btnDownloadCardImg')?.addEventListener('click', () => {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `LEBEN_ZONE_${user.team}조_${user.name}_${AppState.selectedDate}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('인증 카드 이미지가 저장되었습니다');
  });

  document.getElementById('btnNativeShareCard')?.addEventListener('click', async () => {
    if (!canvas) return;
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `LEBEN_ZONE_${user.team}조_${user.name}_${AppState.selectedDate}.png`, {
        type: 'image/png'
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: cafeTitle,
          text: kakaoText,
          files: [file]
        });
      } else {
        await copyToClipboard(kakaoText, '문구가 복사되었으며 이미지를 저장합니다');
        const link = document.createElement('a');
        link.download = `LEBEN_ZONE_${user.team}조_${user.name}_${AppState.selectedDate}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (e) {}
  });

  document.getElementById('btnCopyKakao')?.addEventListener('click', async () => {
    await copyToClipboard(kakaoText, '단톡방 보고 문구가 복사되었습니다');
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      kakaoReported: true
    });
    await loadState();
  });

  document.getElementById('btnCopyCafeTitle')?.addEventListener('click', async () => {
    await copyToClipboard(cafeTitle, '카페 게시글 제목이 복사되었습니다');
  });

  document.getElementById('btnCopyCafeBody')?.addEventListener('click', async () => {
    await copyToClipboard(cafeBody, '카페 본문이 복사되었으며 인증 완료로 체크되었습니다');
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      cafePosted: true
    });
    await loadState();
  });
}

// ============================================================================
// TAB 3: 조별 현황 (5개 조 x 4명 = 20명)
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
                  ${
                    m.role === '조장'
                      ? `<span class="tag tag-dark" style="font-size:10px;padding:2px 7px;">조장</span>`
                      : ''
                  }
                  <span style="font-size:12px;color:var(--text-tertiary);font-weight:600;">목표 ${m.targetBlocks}B</span>
                </div>
                <span style="font-size:12.5px;font-weight:800;color:${
                  isOver ? 'var(--signal)' : meals.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)'
                };">
                  ${
                    meals.length > 0
                      ? `C ${formatBlock(totals.carb)} · P ${formatBlock(totals.protein)} · F ${formatBlock(totals.fat)}`
                      : '미기록'
                  }
                </span>
              </div>
              <div class="member-checks">
                <span class="status-chip ${meals.length > 0 && !isOver ? 'ok' : isOver ? 'missing' : ''}">
                  <span class="dot"></span>
                  <span>${isOver ? '블록 초과' : meals.length > 0 ? `${meals.length}끼 기록` : '식단 대기'}</span>
                </span>
                <span class="status-chip ${l.kakaoReported ? 'ok' : 'missing'}">
                  <span class="dot"></span>
                  <span>${l.kakaoReported ? '단톡 완료' : '단톡 미보고'}</span>
                </span>
                <span class="status-chip ${l.cafePosted ? 'ok' : 'missing'}">
                  <span class="dot"></span>
                  <span>${l.cafePosted ? '카페 완료' : '카페 미작성'}</span>
                </span>
                <span class="status-chip ${missionDone ? 'ok' : ''}">
                  <span class="dot"></span>
                  <span>${missionDone ? '주간미션 완료' : '미션 진행중'}</span>
                </span>
                ${
                  pCount > 0
                    ? `<span class="status-chip missing"><span class="dot"></span><span>패널티 ${pCount}회</span></span>`
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
              <div class="section-eyebrow">TEAM 0${teamNum}</div>
              <div class="card-title">${teamNum}조 현황 (${members.length}명)</div>
              <div class="card-subtitle">누적 패널티 ${teamPenalties}회 · 이름을 누르면 식단 상세를 확인합니다</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-nudge-team="${teamNum}" data-missing-names="${missingMembers.join(
        ', '
      )}">
              ${Icons.copy}
              <span>미인증 알림 복사</span>
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
    <section class="card-hero">
      <div class="card-header" style="margin-bottom:14px;">
        <div>
          <div class="section-eyebrow">LIVE OVERVIEW</div>
          <div class="card-title">전체 5개 조 (${participants.length}명) 인증 현황</div>
          <div class="card-subtitle">${date.replace(/-/g, '.')} 24:00 마감 기준</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;">
        <div style="background:var(--bg-carbon-sub);padding:12px 6px;border-radius:13px;">
          <div style="font-size:11px;color:#9CA3AF;font-weight:600;">식단 기록</div>
          <div style="font-size:20px;font-weight:800;color:#FFFFFF;margin-top:4px;">${loggedCount}<small style="font-size:12px;color:#6B7280;">/${participants.length}</small></div>
        </div>
        <div style="background:var(--bg-carbon-sub);padding:12px 6px;border-radius:13px;">
          <div style="font-size:11px;color:#9CA3AF;font-weight:600;">단톡 보고</div>
          <div style="font-size:20px;font-weight:800;color:#C8F904;margin-top:4px;">${kakaoCount}<small style="font-size:12px;color:#6B7280;">/${participants.length}</small></div>
        </div>
        <div style="background:var(--bg-carbon-sub);padding:12px 6px;border-radius:13px;">
          <div style="font-size:11px;color:#9CA3AF;font-weight:600;">카페 인증</div>
          <div style="font-size:20px;font-weight:800;color:#38BDF8;margin-top:4px;">${cafeCount}<small style="font-size:12px;color:#6B7280;">/${participants.length}</small></div>
        </div>
        <div style="background:var(--bg-carbon-sub);padding:12px 6px;border-radius:13px;">
          <div style="font-size:11px;color:#9CA3AF;font-weight:600;">블록 초과</div>
          <div style="font-size:20px;font-weight:800;color:#FF6B57;margin-top:4px;">${overBlockCount}<small style="font-size:12px;color:#6B7280;">명</small></div>
        </div>
      </div>
    </section>

    <div class="team-filter-bar">
      <button type="button" class="team-chip ${AppState.selectedTeamFilter === 'all' ? 'active' : ''}" data-team-filter="all">전체 5개조</button>
      ${[1, 2, 3, 4, 5]
        .map(
          t =>
            `<button type="button" class="team-chip ${
              Number(AppState.selectedTeamFilter) === t ? 'active' : ''
            }" data-team-filter="${t}">${t}조</button>`
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
        ? `[${teamNum}조 24:00 마감 안내]\n아직 오늘 식단 단톡 보고 또는 네이버 카페 업로드가 완료되지 않은 조원: ${missing}님\n자정 이후에는 10,000원 패널티가 부과되니 시간 내 인증 부탁드립니다.`
        : `[${teamNum}조 전원 인증 완료]\n오늘 ${teamNum}조 4명 전원 식단 및 카페 인증 완료되었습니다. 수고하셨습니다.`;
      await copyToClipboard(msg, `${teamNum}조 안내 문구가 복사되었습니다`);
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
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
      <div>
        <div class="section-eyebrow">${member.team}조 · 목표 ${member.targetBlocks}블록</div>
        <h3 style="font-size:18px;font-weight:800;">${member.name}님의 식단 기록</h3>
        <div style="font-size:12.5px;color:var(--text-tertiary);margin-top:2px;">${AppState.selectedDate.replace(
          /-/g,
          '.'
        )} · 총 탄 ${formatBlock(totals.carb)} / 단 ${formatBlock(totals.protein)} / 지 ${formatBlock(
    totals.fat
  )}</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" id="btnCloseInspect">닫기</button>
    </div>
    ${
      meals.length === 0
        ? `<div style="padding:28px 12px;text-align:center;color:var(--text-tertiary);font-size:13.5px;">등록된 끼니 기록이 없습니다.</div>`
        : `<div class="meal-list">
            ${meals
              .map(
                m => `
              <div class="meal-item">
                ${
                  m.photoDataUrl
                    ? `<img src="${m.photoDataUrl}" class="meal-thumb" alt="${m.type}" />`
                    : `<div class="meal-thumb"></div>`
                }
                <div class="meal-info">
                  <span class="tag tag-neutral">${m.type} ${m.time || ''}</span>
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
    <div style="margin-top:16px;">
      <button type="button" class="btn btn-primary btn-block" id="btnSwitchToThisMember">
        ${member.team}조 ${member.name} 계정으로 전환
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
// TAB 4: 주간 미션 & 패널티/벌금 트래커
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
    OVER_BLOCK: '일일 블록 초과',
    NO_CAFE: '카페 자정 미작성',
    NO_KAKAO: '단톡 자정 미보고',
    NO_MISSION: '주간 미션 미수행',
    MANUAL: '운영진 부여'
  };

  container.innerHTML = `
    <!-- 1. 주간 미션 운동 카드 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">${wm.weekLabel || 'WEEKLY MISSION'}</div>
          <div class="card-title">${wm.title || '주간 미션 운동'}</div>
          <div class="card-subtitle">${wm.deadlineDay || '일요일 24:00 마감'} · 미이행 시 10,000원 패널티</div>
        </div>
        <span class="tag ${myMissionDone ? 'tag-ok' : 'tag-neutral'}">
          ${myMissionDone ? '인증 완료' : '미완료'}
        </span>
      </div>

      <div style="background:var(--bg-subtle);border:1px solid var(--border-hairline);border-radius:12px;padding:13px 14px;margin-bottom:12px;font-size:13px;color:var(--text-secondary);">
        ${wm.description || ''}
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <input type="text" class="input-field" id="missionMemoInput" placeholder="수행 기록 입력 (예: 로잉 2,000m 7분 20초 완료)" />
        <button type="button" class="btn btn-primary" id="btnSubmitMission" style="white-space:nowrap;">
          인증 등록
        </button>
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:8px;">
        이번 주 완료 인원 (${currentWeekMissions.length} / ${AppState.db.participants.length}명)
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:190px;overflow-y:auto;">
        ${
          currentWeekMissions.length === 0
            ? `<div style="font-size:12.5px;color:var(--text-tertiary);">아직 등록된 미션 인증이 없습니다.</div>`
            : currentWeekMissions
                .slice()
                .reverse()
                .map(m => {
                  const p = AppState.db.participants.find(u => u.id === m.userId);
                  return `
                    <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-subtle);padding:9px 12px;border-radius:10px;font-size:12.5px;">
                      <div>
                        <strong style="color:var(--text-primary);">${p ? `${p.team}조 ${p.name}` : '참가자'}</strong>
                        <span style="color:var(--text-secondary);margin-left:8px;">${m.memo}</span>
                      </div>
                      <span style="color:var(--text-tertiary);font-size:11.5px;">${m.date.slice(5).replace('-', '.')}</span>
                    </div>
                  `;
                })
                .join('')
        }
      </div>
    </section>

    <!-- 2. 패널티 및 벌금 트래커 (히어로 다크 카드 + 리스트) -->
    <section class="card-hero">
      <div class="card-header" style="margin-bottom:14px;">
        <div>
          <div class="section-eyebrow">PENALTY TRACKER</div>
          <div class="card-title">패널티 및 벌금 현황</div>
          <div class="card-subtitle">1회당 ${formatWon(unitAmount)} · 개인 최대 ${maxCount}회(${formatWon(
    maxCount * unitAmount
  )}) 상한</div>
        </div>
        <span class="tag tag-volt">누적 벌금 풀 ${formatWon(totalFinePool)}</span>
      </div>

      <div style="background:var(--bg-carbon-sub);border-radius:14px;padding:15px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13.5px;font-weight:700;color:#E5E7EB;">${user.team}조 ${user.name} (내 현황)</span>
          <strong style="font-size:15px;color:${myStat.cappedCount >= 5 ? '#FF6B57' : '#C8F904'};">
            ${myStat.cappedCount} / ${maxCount}회 · ${formatWon(myStat.fineAmount)}
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

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-top:12px;">
        <div style="background:var(--bg-carbon-sub);padding:10px 12px;border-radius:11px;">
          <div style="color:#FFFFFF;font-weight:700;">01. 일일 블록 초과</div>
          <div style="color:#8B95A1;margin-top:2px;">개인 목표 블록 초과 시 +1만원</div>
        </div>
        <div style="background:var(--bg-carbon-sub);padding:10px 12px;border-radius:11px;">
          <div style="color:#FFFFFF;font-weight:700;">02. 단톡방 자정 미보고</div>
          <div style="color:#8B95A1;margin-top:2px;">24:00 전 조 단톡 미보고 +1만원</div>
        </div>
        <div style="background:var(--bg-carbon-sub);padding:10px 12px;border-radius:11px;">
          <div style="color:#FFFFFF;font-weight:700;">03. 카페 자정 미작성</div>
          <div style="color:#8B95A1;margin-top:2px;">24:00 전 카페 글 미업로드 +1만원</div>
        </div>
        <div style="background:var(--bg-carbon-sub);padding:10px 12px;border-radius:11px;">
          <div style="color:#FFFFFF;font-weight:700;">04. 주간 미션 미수행</div>
          <div style="color:#8B95A1;margin-top:2px;">주간 운동 미션 미인증 +1만원</div>
        </div>
      </div>
    </section>

    <!-- 참가자별 벌금 랭킹 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">MEMBER STATUS</div>
          <div class="card-title">개인별 누적 패널티</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:290px;overflow-y:auto;">
        ${participantPenaltyStats
          .slice()
          .sort((a, b) => b.cappedCount - a.cappedCount || a.participant.team - b.participant.team)
          .map(
            s => `
            <div style="background:var(--bg-subtle);border:1px solid var(--border-hairline);border-radius:12px;padding:11px 13px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:13.5px;font-weight:700;">
                  ${s.participant.team}조 ${s.participant.name}
                  ${
                    s.cappedCount >= maxCount
                      ? `<span class="tag tag-danger" style="margin-left:6px;padding:2px 7px;font-size:10.5px;">MAX 도달</span>`
                      : ''
                  }
                </span>
                <span style="font-size:13px;font-weight:800;color:${
                  s.cappedCount > 0 ? 'var(--signal)' : 'var(--text-secondary)'
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

    <!-- 상세 패널티 부과 내역 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">PENALTY LOGS</div>
          <div class="card-title">상세 부과 내역 (${AppState.db.penalties.length})</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${
          AppState.db.penalties.length === 0
            ? `<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px;">부과된 패널티 내역이 없습니다.</div>`
            : AppState.db.penalties
                .slice()
                .reverse()
                .map(p => {
                  const member = AppState.db.participants.find(u => u.id === p.userId);
                  return `
                    <div style="background:var(--bg-subtle);border:1px solid var(--border-hairline);border-radius:12px;padding:11px 13px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                      <div>
                        <div style="font-size:13px;font-weight:700;">
                          <span>${member ? `${member.team}조 ${member.name}` : '참가자'}</span>
                          <span style="color:var(--text-tertiary);margin:0 5px;">·</span>
                          <span style="color:var(--signal);">${penaltyTypeLabels[p.type] || '패널티'}</span>
                        </div>
                        <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">${p.date.replace(
                          /-/g,
                          '.'
                        )} · ${p.reason}</div>
                      </div>
                      <strong style="color:var(--text-primary);font-size:13px;white-space:nowrap;">+${formatWon(
                        p.amount
                      )}</strong>
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
    const memo = memoEl?.value.trim() || `${wm.title || '주간 미션 운동'} 완료`;
    await apiRequest('/api/missions', 'POST', {
      userId: user.id,
      weekLabel: wm.weekLabel,
      date: AppState.selectedDate,
      memo
    });
    showToast('주간 미션 완료가 등록되었습니다');
    await loadState();
  });
}

// ============================================================================
// TAB 5: 코치 관리
// ============================================================================
function renderAdminTab(container) {
  const settings = AppState.db.settings || {};
  const adminPin = settings.adminPin || '0000';

  if (!AppState.adminUnlocked) {
    container.innerHTML = `
      <section class="card" style="text-align:center;padding:36px 20px;">
        <div style="width:48px;height:48px;border-radius:14px;background:var(--bg-muted);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;color:var(--text-primary);">
          ${Icons.lock}
        </div>
        <h3 style="font-size:18px;font-weight:800;margin-bottom:6px;">코치 및 운영진 관리</h3>
        <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:20px;">
          조 편성(1~5조), 개인별 목표 블록 설정, 주간 미션 등록 및<br/>자정 마감 미인증자 일괄 패널티 정산을 관리합니다.
        </p>
        <div style="max-width:240px;margin:0 auto 12px;">
          <input type="password" class="input-field" id="adminPinInput" placeholder="PIN 4자리 (기본 0000)" style="text-align:center;font-size:16px;letter-spacing:4px;font-weight:700;" value="0000" />
        </div>
        <button type="button" class="btn btn-primary" id="btnUnlockAdmin">관리자 잠금 해제</button>
      </section>
    `;
    document.getElementById('btnUnlockAdmin')?.addEventListener('click', () => {
      const val = document.getElementById('adminPinInput')?.value.trim();
      if (val === adminPin) {
        AppState.adminUnlocked = true;
        sessionStorage.setItem('leben_admin_unlocked', 'true');
        showToast('관리자 모드가 활성화되었습니다');
        renderMain();
      } else {
        showToast('PIN 번호가 일치하지 않습니다 (기본값 0000)');
      }
    });
    return;
  }

  const lanIps = AppState.db.serverInfo?.lanIps || [];
  const port = AppState.db.serverInfo?.port || 3000;
  const shareUrl = lanIps.length > 0 ? `http://${lanIps[0]}:${port}` : window.location.origin;

  container.innerHTML = `
    <!-- 1. 일일 마감 위반자 자동 스캔 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">AUTO SETTLEMENT</div>
          <div class="card-title">일일 마감 위반자 자동 스캔</div>
          <div class="card-subtitle">${AppState.selectedDate.replace(
            /-/g,
            '.'
          )} 기준 블록 초과·단톡 미보고·카페 미작성 인원을 추출합니다</div>
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
        <button type="button" class="btn btn-primary" id="btnScanViolations">
          ${AppState.selectedDate} 위반 내역 스캔
        </button>
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-secondary);cursor:pointer;">
          <input type="checkbox" id="chkScanWeeklyMission" />
          주간 미션 미수행자 포함
        </label>
      </div>

      <div id="scanResultArea">
        ${
          AppState.scannedViolations
            ? renderScannedViolationsHtml(AppState.scannedViolations)
            : `<div style="font-size:12.5px;color:var(--text-tertiary);background:var(--bg-subtle);padding:13px;border-radius:11px;">
                스캔 버튼을 누르면 20명 전원의 목표 블록 초과 여부와 단톡·카페 인증 상태를 검사합니다.
              </div>`
        }
      </div>
    </section>

    <!-- 2. 수동 패널티 추가 및 삭제 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">MANUAL PENALTY</div>
          <div class="card-title">패널티 수동 부과 및 취소</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <select class="input-field" id="manualPenaltyUser">
          ${AppState.db.participants
            .map(p => `<option value="${p.id}">${p.team}조 ${p.name}</option>`)
            .join('')}
        </select>
        <select class="input-field" id="manualPenaltyType">
          <option value="OVER_BLOCK">일일 목표 블록 초과</option>
          <option value="NO_CAFE">자정 전 카페 미작성</option>
          <option value="NO_KAKAO">자정 전 단톡 미보고</option>
          <option value="NO_MISSION">주간 미션 운동 미수행</option>
          <option value="MANUAL">기타 규칙 위반</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <input type="text" class="input-field" id="manualPenaltyReason" placeholder="사유 입력 (예: 00:15 지각 업로드)" />
        <button type="button" class="btn btn-primary" id="btnAddManualPenalty" style="white-space:nowrap;">부과</button>
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:6px;">최근 부과 내역 (취소 가능)</div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;">
        ${AppState.db.penalties
          .slice()
          .reverse()
          .map(p => {
            const m = AppState.db.participants.find(u => u.id === p.userId);
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-subtle);padding:8px 11px;border-radius:9px;font-size:12px;">
                <span><strong>${m ? `${m.team}조 ${m.name}` : ''}</strong> · ${p.date} · ${p.reason}</span>
                <button type="button" class="btn btn-danger btn-sm" data-del-penalty="${p.id}" style="padding:4px 8px;font-size:11px;">취소</button>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>

    <!-- 3. 주간 미션 및 카페 설정 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">CHALLENGE CONFIG</div>
          <div class="card-title">주간 미션 및 링크 설정</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">챌린지 타이틀</label>
          <input type="text" class="input-field" id="cfgChallengeName" value="${settings.challengeName || ''}" />
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">네이버 카페 주소</label>
          <input type="text" class="input-field" id="cfgCafeUrl" value="${settings.cafeUrl || ''}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;">
          <div>
            <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">주차 표기</label>
            <input type="text" class="input-field" id="cfgWeekLabel" value="${settings.weeklyMission?.weekLabel || ''}" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">미션 제목</label>
            <input type="text" class="input-field" id="cfgMissionTitle" value="${settings.weeklyMission?.title || ''}" />
          </div>
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">미션 상세 설명</label>
          <input type="text" class="input-field" id="cfgMissionDesc" value="${settings.weeklyMission?.description || ''}" />
        </div>
        <button type="button" class="btn btn-primary btn-block" id="btnSaveSettings">설정 저장</button>
      </div>
    </section>

    <!-- 4. 참가자 20명 조 편성 및 목표 블록 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">PARTICIPANTS</div>
          <div class="card-title">참가자 명단 및 목표 블록 (${AppState.db.participants.length}명)</div>
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
              <th></th>
            </tr>
          </thead>
          <tbody id="adminParticipantTbody">
            ${AppState.db.participants
              .map(
                (p, idx) => `
              <tr data-p-id="${p.id}">
                <td style="width:66px;">
                  <select class="p-team">
                    ${[1, 2, 3, 4, 5]
                      .map(t => `<option value="${t}" ${Number(p.team) === t ? 'selected' : ''}>${t}조</option>`)
                      .join('')}
                  </select>
                </td>
                <td><input type="text" class="p-name" value="${p.name}" /></td>
                <td style="width:70px;">
                  <select class="p-role">
                    <option value="조장" ${p.role === '조장' ? 'selected' : ''}>조장</option>
                    <option value="조원" ${p.role !== '조장' ? 'selected' : ''}>조원</option>
                  </select>
                </td>
                <td style="width:70px;"><input type="number" class="p-blocks" value="${p.targetBlocks}" min="5" max="25" step="1" /></td>
                <td style="width:72px;"><input type="text" class="p-pin" value="${p.pin || '1234'}" maxlength="4" /></td>
                <td style="width:50px;">
                  <button type="button" class="btn btn-danger btn-sm" data-remove-idx="${idx}" style="padding:5px 8px;">삭제</button>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:14px;">
        <button type="button" class="btn btn-primary btn-block" id="btnSaveParticipants">
          참가자 명단 일괄 저장
        </button>
      </div>
    </section>

    <!-- 5. 접속 주소 및 데이터 초기화 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">SYSTEM & DATA</div>
          <div class="card-title">접속 링크 및 데이터 관리</div>
        </div>
      </div>
      <div style="background:var(--bg-subtle);padding:13px;border-radius:12px;font-size:13px;margin-bottom:12px;">
        <div><strong>모바일 접속 주소 :</strong> <span style="color:var(--text-primary);font-weight:700;">${shareUrl}</span></div>
        <div style="color:var(--text-tertiary);font-size:12px;margin-top:4px;">
          스마트폰 브라우저에서 접속 후 '홈 화면에 추가'를 선택하면 앱 아이콘으로 설치됩니다.
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button type="button" class="btn btn-danger" id="btnClearAllLogs">기록 초기화 (새 기수 시작)</button>
        <button type="button" class="btn btn-secondary" id="btnResetDemo">샘플 데이터 복원</button>
      </div>
    </section>
  `;

  bindAdminEvents();
}

function renderScannedViolationsHtml(violations) {
  if (violations.length === 0) {
    return `<div style="padding:14px;background:var(--emerald-soft);border-radius:11px;color:var(--emerald-text);font-size:13px;font-weight:700;">
      선택한 날짜(${AppState.selectedDate})에 감지된 규칙 위반 내역이 없습니다.
    </div>`;
  }
  return `
    <div style="background:var(--bg-subtle);border:1px solid var(--border-hairline);border-radius:12px;padding:13px;">
      <div style="font-size:13px;font-weight:800;color:var(--signal);margin-bottom:8px;">
        총 ${violations.length}건의 미인증·블록초과 항목이 감지되었습니다
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;margin-bottom:12px;">
        ${violations
          .map(
            (v, idx) => `
          <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;background:var(--bg-surface);border:1px solid var(--border-hairline);padding:9px 11px;border-radius:9px;cursor:pointer;">
            <input type="checkbox" class="chk-violation-item" data-v-idx="${idx}" checked />
            <span><strong>${v.team}조 ${v.userName}</strong> · ${v.reason} <span style="color:var(--signal);font-weight:700;">(+10,000원)</span></span>
          </label>
        `
          )
          .join('')}
      </div>
      <button type="button" class="btn btn-primary btn-block" id="btnApplyScannedPenalties">
        선택 항목 일괄 패널티 부과
      </button>
    </div>
  `;
}

function bindAdminEvents() {
  document.getElementById('btnScanViolations')?.addEventListener('click', () => {
    const date = AppState.selectedDate;
    const includeMission = document.getElementById('chkScanWeeklyMission')?.checked;
    const maxCount = AppState.db.settings?.maxPenaltyCount || 10;
    const violations = [];

    AppState.db.participants.forEach(p => {
      const existingCount = getUserPenalties(p.id).length;
      if (existingCount >= maxCount) return;

      const log = getUserDailyLog(p.id, date);
      const meals = log.meals || [];
      const totals = window.ZoneShareHelper.computeTotals(meals);

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
          reason: `목표 블록(${p.targetBlocks}B) 초과 섭취 (탄${formatBlock(totals.carb)}·단${formatBlock(
            totals.protein
          )}·지${formatBlock(totals.fat)})`
        });
      }

      if (!log.kakaoReported) {
        violations.push({
          userId: p.id,
          userName: p.name,
          team: p.team,
          date,
          type: 'NO_KAKAO',
          reason: `자정 전 ${p.team}조 단톡방 식단 미보고`
        });
      }

      if (!log.cafePosted) {
        violations.push({
          userId: p.id,
          userName: p.name,
          team: p.team,
          date,
          type: 'NO_CAFE',
          reason: `자정 전 네이버 카페 식단글 미작성`
        });
      }

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
      showToast('선택된 항목이 없습니다');
      return;
    }
    await apiRequest('/api/penalties', 'POST', {
      action: 'bulk_add',
      penalties: selected
    });
    AppState.scannedViolations = null;
    showToast(`${selected.length}건의 패널티가 반영되었습니다`);
    await loadState();
  });

  document.getElementById('btnAddManualPenalty')?.addEventListener('click', async () => {
    const userId = document.getElementById('manualPenaltyUser')?.value;
    const type = document.getElementById('manualPenaltyType')?.value;
    const reasonInput = document.getElementById('manualPenaltyReason')?.value.trim();
    const defaultReasons = {
      OVER_BLOCK: '일일 목표 블록 초과 섭취',
      NO_CAFE: '자정 전 네이버 카페 미작성',
      NO_KAKAO: '자정 전 조별 단톡방 미보고',
      NO_MISSION: '주간 미션 운동 미수행',
      MANUAL: '챌린지 규칙 위반'
    };
    await apiRequest('/api/penalties', 'POST', {
      penalty: {
        userId,
        date: AppState.selectedDate,
        type,
        reason: reasonInput || defaultReasons[type]
      }
    });
    showToast('패널티 1회(10,000원)가 부과되었습니다');
    await loadState();
  });

  document.querySelectorAll('[data-del-penalty]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await apiRequest('/api/penalties', 'POST', {
        action: 'delete',
        penaltyId: btn.dataset.delPenalty
      });
      showToast('패널티 내역이 취소되었습니다');
      await loadState();
    });
  });

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
    showToast('설정이 저장되었습니다');
    await loadState();
  });

  document.getElementById('btnAddParticipant')?.addEventListener('click', async () => {
    const list = [...AppState.db.participants];
    const nextNum = list.length + 1;
    const team = ((nextNum - 1) % 5) + 1;
    list.push({
      id: `u_${Date.now()}`,
      name: `참가자${nextNum}`,
      team,
      role: '조원',
      targetBlocks: 11,
      pin: '1234'
    });
    await apiRequest('/api/admin/update', 'POST', { participants: list });
    showToast('새 참가자가 추가되었습니다');
    await loadState();
  });

  document.querySelectorAll('[data-remove-idx]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.removeIdx);
      const list = AppState.db.participants.filter((_, i) => i !== idx);
      await apiRequest('/api/admin/update', 'POST', { participants: list });
      showToast('참가자가 삭제되었습니다');
      await loadState();
    });
  });

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
    showToast('참가자 명단이 저장되었습니다');
    await loadState();
  });

  document.getElementById('btnClearAllLogs')?.addEventListener('click', async () => {
    await apiRequest('/api/admin/update', 'POST', { action: 'clear_logs' });
    showToast('전체 기록이 초기화되었습니다');
    await loadState();
  });

  document.getElementById('btnResetDemo')?.addEventListener('click', async () => {
    await apiRequest('/api/admin/update', 'POST', { action: 'reset_demo' });
    showToast('샘플 데이터가 복원되었습니다');
    await loadState();
  });
}

// ============================================================================
// 참가자 전환 모달
// ============================================================================
function openUserSwitchModal(preselectUserId = null) {
  const modal = document.getElementById('userModal');
  const content = document.getElementById('userModalContent');
  if (!modal || !content || !AppState.db) return;

  let chosenId = preselectUserId || AppState.currentUserId;

  function renderModalInner() {
    const chosenUser = AppState.db.participants.find(p => p.id === chosenId) || AppState.db.participants[0];
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
        <div>
          <div class="section-eyebrow">SWITCH MEMBER</div>
          <h3 style="font-size:18px;font-weight:800;">참가자 선택</h3>
          <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">이름을 선택하고 4자리 PIN(초기값 1234)을 입력하세요</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnCloseUserModal">닫기</button>
      </div>

      <div style="max-height:270px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;margin-bottom:16px;padding-right:2px;">
        ${[1, 2, 3, 4, 5]
          .map(teamNum => {
            const members = AppState.db.participants.filter(p => Number(p.team) === teamNum);
            return `
              <div>
                <div style="font-size:11.5px;font-weight:800;color:var(--text-tertiary);margin-bottom:6px;">${teamNum}조</div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
                  ${members
                    .map(
                      m => `
                    <button type="button" class="btn ${
                      m.id === chosenId ? 'btn-primary' : 'btn-outline'
                    } btn-sm" data-pick-uid="${m.id}" style="justify-content:space-between;padding:9px 12px;">
                      <span>${m.name}</span>
                      <small style="opacity:0.7;">${m.targetBlocks}B</small>
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

      <div style="background:var(--bg-subtle);padding:14px;border-radius:14px;border:1px solid var(--border-hairline);">
        <div style="font-size:12.5px;font-weight:700;margin-bottom:8px;color:var(--text-secondary);">
          <strong>${chosenUser.team}조 ${chosenUser.name}</strong> PIN 번호
        </div>
        <div style="display:flex;gap:8px;">
          <input type="password" class="input-field" id="pinVerifyInput" maxlength="4" value="${
            chosenUser.pin || '1234'
          }" placeholder="4자리 PIN" style="letter-spacing:4px;text-align:center;font-weight:800;background:var(--bg-surface);" />
          <button type="button" class="btn btn-primary" id="btnConfirmUserSwitch" style="white-space:nowrap;">
            전환하기
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
        showToast('PIN 번호가 일치하지 않습니다');
        return;
      }
      AppState.currentUserId = chosenUser.id;
      localStorage.setItem('leben_user_id', chosenUser.id);
      modal.style.display = 'none';
      showToast(`${chosenUser.team}조 ${chosenUser.name}님으로 전환되었습니다`);
      renderHeader();
      renderMain();
    });
  }

  renderModalInner();
  modal.style.display = 'flex';
}

// ============================================================================
// 초기화
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.activeTab = btn.dataset.tab;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      renderMain();
    });
  });

  document.getElementById('btnSwitchUser')?.addEventListener('click', () => {
    openUserSwitchModal();
  });

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
