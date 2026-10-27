// LEBEN ZONE CHALLENGE 프론트엔드 클라이언트
// 워크플로우:
// 1) 개인: 아침·점심·저녁 사진(다중 첨부 가능)과 하루 먹은 탄·단·지 블록 수를 입력해 소속 조 공간에 등록
// 2) 식단담당: 조원 4명이 올린 사진과 블록 수를 취합해 '전체 20명 공간'에 원클릭 보고 (기존 카톡 캡처 대체)
// 3) 네이버 카페: 아침·점심·저녁 식단 사진 + 하단 탄단지 블록 수 양식을 '전문 복사' 후 네이버 카페로 바로 이동해 붙여넣기

const Icons = {
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  camera: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  copy: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  download: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
  share: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>`,
  arrowRight: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  external: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>`,
  lock: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  send: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`
};

const AppState = {
  db: null,
  currentUserId: localStorage.getItem('leben_user_id') || 'u1',
  selectedDate: '',
  activeTab: 'diet',
  // 조별·전체방 탭 서브모드: 'teamSpace' (조별 4인 공간) | 'allSpace' (전체 20인 보고 공간)
  teamSpaceMode: 'teamSpace',
  selectedTeamNum: null,
  adminUnlocked: sessionStorage.getItem('leben_admin_unlocked') === 'true',
  mealForm: {
    editingId: null,
    type: '아침',
    carb: 4,
    protein: 4,
    fat: 4,
    memo: '',
    photos: []
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

// Canvas를 실제 이미지(image/png)로 클립보드에 복사 -> 네이버 카페 에디터에서 Ctrl+V 시 사진이 바로 업로드됨!
async function copyCanvasImageToClipboard(canvas, successMsg = '식단 이미지가 클립보드에 복사되었습니다! 카페 본문에서 Ctrl+V 하세요') {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blobPromise = window.ZoneShareHelper.canvasToPngBlob(canvas);
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blobPromise
        })
      ]);
      showToast(successMsg);
      return true;
    }
  } catch (err) {
    console.error(err);
  }
  // 클립보드 이미지 미지원 브라우저의 경우 자동 파일 다운로드로 폴백
  const link = document.createElement('a');
  link.download = `LEBEN_ZONE_CAFE_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('이미지가 저장되었습니다. 카페에 첨부해 주세요.');
  return false;
}

// 개별 사진 1장을 실제 image/png로 클립보드에 복사
async function copySinglePhotoToClipboard(src, label = '식단 사진') {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blobPromise = window.ZoneShareHelper.dataUrlToPngBlob(src);
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blobPromise
        })
      ]);
      showToast(`${label}이(가) 복사되었습니다! 카페 본문에서 Ctrl+V 하세요`);
      return true;
    }
  } catch (err) {
    console.error(err);
  }
  showToast('이 브라우저에서는 이미지 직접 복사를 지원하지 않습니다.');
  return false;
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
  const user = getCurrentUser();
  if (user && !AppState.selectedTeamNum) {
    AppState.selectedTeamNum = Number(user.team);
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

function makeQuickSampleFoodPhoto(mealType, c, p, f, memo, subIndex = 1) {
  const presets = {
    아침: ['아침 식단', '#E07A5F', '#F2CC8F'],
    점심: ['점심 식단', '#BC4749', '#E6CCB2'],
    저녁: ['저녁 식단', '#F4845F', '#84A59D'],
    간식: ['간식 식단', '#6D597A', '#E56B6F']
  };
  const [label, c1, c2] = presets[mealType] || presets['아침'];
  const macroTag = `${formatBlock(c)} · ${formatBlock(p)} · ${formatBlock(f)} BLOCK`;
  const sub = memo || `${mealType} 식단 사진 ${subIndex}`;
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
    <rect x="28" y="26" width="110" height="32" rx="16" fill="rgba(255,255,255,0.12)"/>
    <text x="83" y="47" font-family="Pretendard, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#FFFFFF" text-anchor="middle">${label} #${subIndex}</text>
    <rect x="444" y="26" width="128" height="32" rx="16" fill="#C8F904"/>
    <text x="508" y="47" font-family="Pretendard, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#111315" text-anchor="middle">${macroTag}</text>
    <rect x="0" y="376" width="600" height="74" fill="rgba(17,19,21,0.88)"/>
    <text x="32" y="420" font-family="Pretendard, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#F4F5F7">${sub}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ============================================================================
// 메인 화면 분기
// ============================================================================
function renderMain() {
  const container = document.getElementById('mainView');
  if (!container || !AppState.db) return;

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === AppState.activeTab);
  });

  if (AppState.activeTab === 'diet') {
    renderDietTab(container);
  } else if (AppState.activeTab === 'teams') {
    renderTeamsTab(container);
  } else if (AppState.activeTab === 'share') {
    renderShareTab(container);
  } else if (AppState.activeTab === 'penalty') {
    renderPenaltyTab(container);
  } else if (AppState.activeTab === 'admin') {
    renderAdminTab(container);
  }
}

// ============================================================================
// TAB 1: 식단 등록 (아침·점심·저녁 다중 사진 + 하루 탄·단·지 블록 입력 → 조별 공간 보고)
// ============================================================================
function renderDietTab(container) {
  const user = getCurrentUser();
  const log = getUserDailyLog(user.id, AppState.selectedDate);
  const meals = log.meals || [];
  const totals = window.ZoneShareHelper.computeTotals(meals);
  const target = Number(user.targetBlocks || 11);
  const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
  const ratioText = window.ZoneShareHelper.computeRatioText(totals);

  const macroCellsHtml = [
    { key: 'carb', label: '탄수화물 C', val: totals.carb, color: '#38BDF8' },
    { key: 'protein', label: '단백질 P', val: totals.protein, color: '#C8F904' },
    { key: 'fat', label: '지방 F', val: totals.fat, color: '#FBBF24' }
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
          <div class="hero-macro-label"><span>${m.label}</span></div>
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
  const currentPhotos = Array.isArray(mf.photos) ? mf.photos : [];

  container.innerHTML = `
    <!-- 1. 오늘 하루 총 섭취 탄·단·지 블록 히어로 카드 -->
    <section class="card-hero">
      <div class="card-header" style="margin-bottom:12px;">
        <div>
          <div class="section-eyebrow">STEP 1 · DAILY ZONE REPORT</div>
          <div class="card-title">${user.team}조 ${user.name} · 오늘 총 섭취 블록</div>
          <div class="card-subtitle">${AppState.selectedDate.replace(/-/g, '.')} · 일일 목표 각 ${target}블록</div>
        </div>
        <span class="tag ${isOver ? 'tag-danger' : meals.length > 0 ? 'tag-volt' : 'tag-neutral'}">
          ${isOver ? '목표 초과' : meals.length > 0 ? '기록 완료' : '입력 대기'}
        </span>
      </div>

      <div class="hero-macro-grid">
        ${macroCellsHtml}
      </div>

      <div class="hero-ratio-bar">
        <span style="color:#9CA3AF;font-weight:600;">하루 탄 : 단 : 지 비율</span>
        <strong style="color:#FFFFFF;font-weight:700;">${ratioText}</strong>
      </div>

      <!-- 자정 전 필수 인증 상태 -->
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);">
        <div class="cert-switch-grid">
          <button type="button" class="cert-switch-btn ${log.kakaoReported ? 'done' : ''}" id="btnToggleKakao">
            <div>
              <div class="cert-switch-label">${user.team}조 공간 식단 보고</div>
              <div class="cert-switch-sub">${log.kakaoReported ? '우리 조 공간 등록됨' : '식단 등록 시 자동 완료'}</div>
            </div>
            <span class="check-circle">${log.kakaoReported ? Icons.check : ''}</span>
          </button>
          <button type="button" class="cert-switch-btn ${log.cafePosted ? 'done' : ''}" id="btnToggleCafe">
            <div>
              <div class="cert-switch-label">네이버 카페 업로드</div>
              <div class="cert-switch-sub">${log.cafePosted ? '카페 작성 완료됨' : '전문복사 탭에서 진행'}</div>
            </div>
            <span class="check-circle">${log.cafePosted ? Icons.check : ''}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- 2. 아침 · 점심 · 저녁 사진(다중 첨부) & 블록 입력 카드 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">MEAL & PHOTO UPLOAD</div>
          <div class="card-title">${mf.editingId ? `${mf.type} 식단 수정` : '아침 · 점심 · 저녁 식단 올리기'}</div>
          <div class="card-subtitle">끼니별 사진(여러 장 가능)과 먹은 블록 수를 등록하면 ${user.team}조 공간에 바로 공유됩니다</div>
        </div>
        ${
          mf.editingId
            ? `<button type="button" class="btn btn-secondary btn-sm" id="btnCancelEditMeal">취소</button>`
            : ''
        }
      </div>

      <!-- 아침 / 점심 / 저녁 / 간식 탭 -->
      <div class="segmented-tabs">
        ${['아침', '점심', '저녁', '간식']
          .map(t => {
            const existsMeal = meals.find(m => m.type === t);
            return `<button type="button" class="seg-tab ${mf.type === t ? 'active' : ''}" data-meal-type="${t}">
              ${t}${existsMeal ? ' · 완료' : ''}
            </button>`;
          })
          .join('')}
      </div>

      <!-- 사진 다중 업로드 영역 -->
      <div class="photo-dropzone" id="photoUploadTrigger">
        <input type="file" id="mealPhotoInput" accept="image/*" multiple style="display:none;" />
        <div style="display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;color:var(--text-primary);">
          ${Icons.camera}
          <span>${mf.type} 식단 사진 선택 (2장 이상 다중 선택 가능)</span>
        </div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:3px;">
          현재 첨부된 사진 ${currentPhotos.length}장 · 터치하여 앨범에서 사진을 추가하세요
        </div>
      </div>

      ${
        currentPhotos.length > 0
          ? `<div class="multi-photo-grid">
              ${currentPhotos
                .map(
                  (src, idx) => `
                <div class="multi-photo-item">
                  <img src="${src}" alt="첨부사진 ${idx + 1}" />
                  <button type="button" class="multi-photo-remove" data-remove-photo-idx="${idx}" title="사진 제거">×</button>
                </div>
              `
                )
                .join('')}
            </div>`
          : ''
      }

      <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px;margin-bottom:14px;">
        <button type="button" class="btn btn-secondary btn-sm" id="btnAddSamplePhotos">샘플 사진 2장 자동 첨부</button>
        ${
          currentPhotos.length > 0
            ? `<button type="button" class="btn btn-danger btn-sm" id="btnClearAllPhotos">사진 전체 비우기</button>`
            : ''
        }
      </div>

      <!-- 빠른 블록 선택 -->
      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:8px;">
        ${mf.type} 섭취 블록 선택 (또는 하루 총 블록을 한 번에 입력해도 됩니다)
      </div>
      <div class="preset-strip">
        ${[2, 3, 3.5, 4, 5, 11, 14]
          .map(
            b =>
              `<button type="button" class="preset-pill ${
                mf.carb === b && mf.protein === b && mf.fat === b ? 'active' : ''
              }" data-preset-block="${b}">${b >= 11 ? `하루총합 ${b}B` : `${b}블록`}</button>`
          )
          .join('')}
      </div>

      <!-- 탄 / 단 / 지 블록 스테퍼 -->
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

      <div style="margin-bottom:14px;">
        <input type="text" class="input-field" id="mealMemoInput" placeholder="${mf.type} 식단 메모 (예: 닭가슴살 120g, 고구마 150g, 아몬드)" value="${
          mf.memo || ''
        }" />
      </div>

      <button type="button" class="btn btn-primary btn-block" id="btnSaveMeal">
        ${mf.editingId ? `${mf.type} 식단 수정 완료` : `${mf.type} 식단 저장 및 ${user.team}조 공간에 올리기`}
      </button>
    </section>

    <!-- 3. 오늘 내가 올린 아침·점심·저녁 식단 확인 및 다음 단계 이동 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">MY UPLOADED MEALS</div>
          <div class="card-title">오늘 등록한 식단 (${meals.length}끼 · 총 탄${formatBlock(totals.carb)} 단${formatBlock(
    totals.protein
  )} 지${formatBlock(totals.fat)})</div>
        </div>
      </div>

      ${
        meals.length === 0
          ? `<div style="text-align:center;padding:26px 12px;color:var(--text-tertiary);font-size:13.5px;">
              아직 등록된 식단이 없습니다. 위에서 아침·점심·저녁 사진을 등록해 주세요.
            </div>`
          : `<div class="meal-list">
              ${meals
                .map(m => {
                  const photos = window.ZoneShareHelper.getMealPhotos(m);
                  return `
                    <div class="meal-item" style="flex-direction:column;align-items:stretch;">
                      <div class="meal-info-top">
                        <div>
                          <span class="tag tag-dark">${m.type} · 사진 ${photos.length}장</span>
                          <span style="font-size:14px;font-weight:800;margin-left:8px;">탄 ${formatBlock(
                            m.carb
                          )} · 단 ${formatBlock(m.protein)} · 지 ${formatBlock(m.fat)} 블록</span>
                        </div>
                        <div style="display:flex;gap:5px;">
                          <button type="button" class="btn btn-outline btn-sm" data-edit-meal="${m.id}">수정</button>
                          <button type="button" class="btn btn-danger btn-sm" data-delete-meal="${m.id}">삭제</button>
                        </div>
                      </div>
                      ${
                        m.memo
                          ? `<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px;">${m.memo}</div>`
                          : ''
                      }
                      ${
                        photos.length > 0
                          ? `<div class="team-photo-strip" style="margin-top:6px;">
                              ${photos
                                .map(
                                  (src, pIdx) => `
                                <div class="team-photo-card">
                                  <img src="${src}" alt="${m.type} ${pIdx + 1}" />
                                  <span class="team-photo-badge">${m.type} ${pIdx + 1}</span>
                                </div>
                              `
                                )
                                .join('')}
                            </div>`
                          : ''
                      }
                    </div>
                  `;
                })
                .join('')}
            </div>`
      }

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px;">
        <button type="button" class="btn btn-secondary" id="btnGoTeamSpace">
          <span>${user.team}조 공간 확인</span>
          ${Icons.arrowRight}
        </button>
        <button type="button" class="btn btn-primary" id="btnGoCafeShare">
          <span>네이버 카페 전문복사</span>
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
    showToast(!log.kakaoReported ? `${user.team}조 공간 보고 완료로 표시되었습니다` : '보고 완료 표시가 해제되었습니다');
    await loadState();
  });

  document.getElementById('btnToggleCafe')?.addEventListener('click', async () => {
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      cafePosted: !log.cafePosted
    });
    showToast(!log.cafePosted ? '네이버 카페 업로드 완료로 표시되었습니다' : '카페 업로드 표시가 해제되었습니다');
    await loadState();
  });

  document.querySelectorAll('[data-meal-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedType = btn.dataset.mealType;
      const existing = (log.meals || []).find(m => m.type === selectedType);
      if (existing) {
        AppState.mealForm = {
          editingId: existing.id,
          type: existing.type,
          carb: existing.carb,
          protein: existing.protein,
          fat: existing.fat,
          memo: existing.memo || '',
          photos: [...window.ZoneShareHelper.getMealPhotos(existing)]
        };
      } else {
        AppState.mealForm = {
          editingId: null,
          type: selectedType,
          carb: 4,
          protein: 4,
          fat: 4,
          memo: '',
          photos: []
        };
      }
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
      const next = Math.max(0, Math.min(25, Number(AppState.mealForm[macro] || 0) + delta));
      AppState.mealForm[macro] = next;
      renderMain();
    });
  });

  const memoInput = document.getElementById('mealMemoInput');
  memoInput?.addEventListener('input', e => {
    AppState.mealForm.memo = e.target.value;
  });

  // 다중 사진 업로드 처리
  const photoTrigger = document.getElementById('photoUploadTrigger');
  const photoInput = document.getElementById('mealPhotoInput');
  photoTrigger?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', async e => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      const compressedList = await Promise.all(files.map(f => compressImageFile(f)));
      AppState.mealForm.photos = [...(AppState.mealForm.photos || []), ...compressedList];
      showToast(`사진 ${compressedList.length}장이 첨부되었습니다`);
      renderMain();
    } catch (err) {
      showToast('사진을 불러오지 못했습니다');
    }
  });

  document.querySelectorAll('[data-remove-photo-idx]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = Number(btn.dataset.removePhotoIdx);
      AppState.mealForm.photos = (AppState.mealForm.photos || []).filter((_, i) => i !== idx);
      renderMain();
    });
  });

  document.getElementById('btnAddSamplePhotos')?.addEventListener('click', () => {
    const mf = AppState.mealForm;
    const p1 = makeQuickSampleFoodPhoto(mf.type, mf.carb, mf.protein, mf.fat, mf.memo, 1);
    const p2 = makeQuickSampleFoodPhoto(mf.type, mf.carb, mf.protein, mf.fat, mf.memo ? `${mf.memo} (추가)` : `${mf.type} 서브 사진`, 2);
    mf.photos = [...(mf.photos || []), p1, p2];
    showToast(`${mf.type} 샘플 사진 2장이 첨부되었습니다`);
    renderMain();
  });

  document.getElementById('btnClearAllPhotos')?.addEventListener('click', () => {
    AppState.mealForm.photos = [];
    renderMain();
  });

  document.getElementById('btnCancelEditMeal')?.addEventListener('click', () => {
    AppState.mealForm = {
      editingId: null,
      type: '아침',
      carb: 4,
      protein: 4,
      fat: 4,
      memo: '',
      photos: []
    };
    renderMain();
  });

  document.getElementById('btnSaveMeal')?.addEventListener('click', async () => {
    const mf = AppState.mealForm;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const photos =
      Array.isArray(mf.photos) && mf.photos.length > 0
        ? mf.photos
        : [makeQuickSampleFoodPhoto(mf.type, mf.carb, mf.protein, mf.fat, mf.memo, 1)];

    await apiRequest('/api/meals', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      markTeamReported: true,
      meal: {
        id: mf.editingId || undefined,
        type: mf.type,
        time: timeStr,
        carb: Number(mf.carb),
        protein: Number(mf.protein),
        fat: Number(mf.fat),
        memo: mf.memo.trim(),
        photos,
        photoDataUrl: photos[0]
      }
    });

    showToast(`${mf.type} 식단이 ${user.team}조 공간에 등록되었습니다`);
    const nextType = mf.type === '아침' ? '점심' : mf.type === '점심' ? '저녁' : '간식';
    AppState.mealForm = {
      editingId: null,
      type: nextType,
      carb: 4,
      protein: 4,
      fat: 4,
      memo: '',
      photos: []
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
        photos: [...window.ZoneShareHelper.getMealPhotos(targetMeal)]
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
      showToast('식단 기록이 삭제되었습니다');
      await loadState();
    });
  });

  document.getElementById('btnGoTeamSpace')?.addEventListener('click', () => {
    AppState.activeTab = 'teams';
    AppState.teamSpaceMode = 'teamSpace';
    AppState.selectedTeamNum = Number(user.team);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderMain();
  });

  document.getElementById('btnGoCafeShare')?.addEventListener('click', () => {
    AppState.activeTab = 'share';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderMain();
  });
}

// ============================================================================
// TAB 2: 조별 공간 (4명 식단·블록) & 식단 담당의 '전체 20명 공간' 취합 보고
// ============================================================================
async function renderTeamsTab(container) {
  const user = getCurrentUser();
  const participants = AppState.db.participants || [];
  const date = AppState.selectedDate;
  const activeTeam = Number(AppState.selectedTeamNum || user.team || 1);
  const teamReports = AppState.db.teamReports || [];

  // 상단 서브 모드 스위치: [조별 식단 공간 (4명)] vs [전체 20명 보고 공간 (5개 조 종합)]
  const modeSwitchHtml = `
    <div class="segmented-tabs" style="grid-template-columns:1fr 1fr;margin-bottom:2px;">
      <button type="button" class="seg-tab ${AppState.teamSpaceMode === 'teamSpace' ? 'active' : ''}" id="btnModeTeamSpace">
        조별 식단 공간 (1~5조)
      </button>
      <button type="button" class="seg-tab ${AppState.teamSpaceMode === 'allSpace' ? 'active' : ''}" id="btnModeAllSpace">
        전체 20명 보고방 (${teamReports.filter(r => r.date === date).length}/5조 보고됨)
      </button>
    </div>
  `;

  if (AppState.teamSpaceMode === 'allSpace') {
    renderAll20MemberSpace(container, modeSwitchHtml, date, participants, teamReports);
    return;
  }

  // [조별 식단 공간]: 선택된 조(예: 1조)의 4명이 올린 아침·점심·저녁 사진과 총 블록 표시 + 식단 담당의 '전체 20명 공간 보고' 기능
  const teamMembers = participants.filter(p => Number(p.team) === activeTeam);
  const membersData = teamMembers.map(m => {
    const l = getUserDailyLog(m.id, date);
    return {
      member: m,
      log: l,
      meals: l.meals || []
    };
  });

  const uploadedMemberCount = membersData.filter(md => md.meals.length > 0).length;
  const existingReport = teamReports.find(
    r => Number(r.team) === activeTeam && r.date === date
  );
  const dietManager = teamMembers.find(m => m.role === '식단담당' || m.role === '조장') || teamMembers[0];

  const memberCardsHtml = membersData
    .map(({ member, log, meals }) => {
      const totals = window.ZoneShareHelper.computeTotals(meals);
      const isOver =
        totals.carb > member.targetBlocks ||
        totals.protein > member.targetBlocks ||
        totals.fat > member.targetBlocks;
      const allPhotos = [];
      const order = ['아침', '점심', '저녁', '간식'];
      [...meals]
        .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
        .forEach(m => {
          window.ZoneShareHelper.getMealPhotos(m).forEach((src, idx) => {
            allPhotos.push({ type: m.type, idx: idx + 1, src, memo: m.memo });
          });
        });

      return `
        <div class="team-member-card">
          <div class="member-row-top">
            <div class="member-name-wrap">
              <span>${member.name}</span>
              ${
                member.role === '식단담당' || member.role === '조장'
                  ? `<span class="tag tag-dark" style="font-size:10.5px;padding:2px 8px;">식단담당</span>`
                  : ''
              }
              <span style="font-size:12px;color:var(--text-tertiary);font-weight:600;">목표 ${member.targetBlocks}블록</span>
            </div>
            <span class="tag ${meals.length === 0 ? 'tag-neutral' : isOver ? 'tag-danger' : 'tag-ok'}">
              ${
                meals.length === 0
                  ? '식단 미등록'
                  : `총 탄 ${formatBlock(totals.carb)} · 단 ${formatBlock(totals.protein)} · 지 ${formatBlock(
                      totals.fat
                    )} 블록`
              }
            </span>
          </div>

          ${
            allPhotos.length === 0
              ? `<div style="font-size:12.5px;color:var(--text-tertiary);padding:8px 0;">아직 오늘 올린 아침·점심·저녁 식단 사진이 없습니다.</div>`
              : `<div class="team-photo-strip">
                  ${allPhotos
                    .map(
                      p => `
                    <div class="team-photo-card">
                      <img src="${p.src}" alt="${p.type}" />
                      <span class="team-photo-badge">${p.type}</span>
                    </div>
                  `
                    )
                    .join('')}
                </div>`
          }

          <div class="member-checks">
            <span class="status-chip ${meals.length > 0 ? 'ok' : 'missing'}">
              <span class="dot"></span>
              <span>사진 ${allPhotos.length}장 (${meals.map(m => m.type).join('·') || '없음'})</span>
            </span>
            <span class="status-chip ${log.cafePosted ? 'ok' : 'missing'}">
              <span class="dot"></span>
              <span>${log.cafePosted ? '카페 업로드 완료' : '카페 미작성'}</span>
            </span>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    ${modeSwitchHtml}

    <!-- 조 선택 칩 -->
    <div class="team-filter-bar">
      ${[1, 2, 3, 4, 5]
        .map(
          t =>
            `<button type="button" class="team-chip ${activeTeam === t ? 'active' : ''}" data-select-team="${t}">
              ${t}조 공간 ${Number(user.team) === t ? '(우리 조)' : ''}
            </button>`
        )
        .join('')}
    </div>

    <!-- 조원 4명 식단 & 블록 현황 -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">TEAM 0${activeTeam} DIET SPACE</div>
          <div class="card-title">${activeTeam}조 오늘의 식단 공간 (${uploadedMemberCount}/${teamMembers.length}명 완료)</div>
          <div class="card-subtitle">조원 4명이 오늘 먹은 아침·점심·저녁 사진과 총 탄단지 블록 수입니다</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        ${memberCardsHtml}
      </div>
    </section>

    <!-- 식단 담당 전용: 4명이 올린 사진과 블록 수를 전체 20명 공간에 보고 -->
    <section class="card-hero">
      <div class="card-header" style="margin-bottom:10px;">
        <div>
          <div class="section-eyebrow">STEP 2 · DIET MANAGER REPORT</div>
          <div class="card-title">${activeTeam}조 식단 담당 (${dietManager ? dietManager.name : '담당자'}) 전체방 보고</div>
          <div class="card-subtitle">기존에 카톡을 캡처해서 전체방에 올리던 과정을 버튼 하나로 처리합니다</div>
        </div>
        <span class="tag ${existingReport ? 'tag-volt' : 'tag-neutral'}">
          ${existingReport ? '전체방 보고 완료' : '보고 대기'}
        </span>
      </div>

      <div style="margin-bottom:12px;">
        <input type="text" class="input-field" id="teamReportCommentInput" style="background:var(--bg-carbon-sub);border-color:rgba(255,255,255,0.1);color:#fff;" placeholder="전체 20명 방에 남길 한줄 코멘트" value="${
          existingReport?.comment ||
          `${activeTeam}조 4명(${teamMembers.map(m => m.name).join(', ')}) 오늘 식단 사진 및 탄단지 블록 보고합니다.`
        }" />
      </div>

      <button type="button" class="btn btn-volt btn-block" id="btnSubmitTeamReport" style="margin-bottom:12px;">
        ${Icons.send}
        <span>${activeTeam}조 4명 사진·블록을 '전체 20명 보고방'에 올리기</span>
      </button>

      <!-- 카톡 전체 단톡방에도 바로 올릴 수 있는 4인 합본 보드 이미지 & 텍스트 -->
      <div style="background:var(--bg-carbon-sub);padding:14px;border-radius:14px;">
        <div style="font-size:12px;font-weight:700;color:#9CA3AF;margin-bottom:8px;">
          ${activeTeam}조 4명 합본 보고 이미지 (카톡 전체방 공유 겸용)
        </div>
        <div class="summary-canvas-wrap" style="margin:0 0 10px 0;">
          <canvas id="teamReportCanvas"></canvas>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btnDownloadTeamBoard">
            ${Icons.download}
            <span>4명 합본 이미지 저장</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btnCopyTeamSummaryText">
            ${Icons.copy}
            <span>4명 블록 요약문구 복사</span>
          </button>
        </div>
      </div>
    </section>
  `;

  // 4명 합본 보드 Canvas 렌더링
  const teamCanvas = document.getElementById('teamReportCanvas');
  if (teamCanvas) {
    await window.ZoneShareHelper.renderTeamReportCanvas(teamCanvas, {
      teamNum: activeTeam,
      date,
      membersData
    });
  }

  bindTeamSpaceEvents(activeTeam, date, user, membersData, teamCanvas);
}

function bindTeamSpaceEvents(activeTeam, date, user, membersData, teamCanvas) {
  document.getElementById('btnModeTeamSpace')?.addEventListener('click', () => {
    AppState.teamSpaceMode = 'teamSpace';
    renderMain();
  });
  document.getElementById('btnModeAllSpace')?.addEventListener('click', () => {
    AppState.teamSpaceMode = 'allSpace';
    renderMain();
  });

  document.querySelectorAll('[data-select-team]').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.selectedTeamNum = Number(btn.dataset.selectTeam);
      renderMain();
    });
  });

  document.getElementById('btnSubmitTeamReport')?.addEventListener('click', async () => {
    const comment = document.getElementById('teamReportCommentInput')?.value.trim();
    await apiRequest('/api/team-reports', 'POST', {
      team: activeTeam,
      date,
      reportedByUserId: user.id,
      reportedByName: user.name,
      comment
    });
    showToast(`${activeTeam}조 4명의 식단과 블록이 전체 20명 보고방에 게시되었습니다!`);
    AppState.teamSpaceMode = 'allSpace';
    await loadState();
  });

  document.getElementById('btnDownloadTeamBoard')?.addEventListener('click', () => {
    if (!teamCanvas) return;
    const link = document.createElement('a');
    link.download = `LEBEN_${activeTeam}조_4인식단보고_${date}.png`;
    link.href = teamCanvas.toDataURL('image/png');
    link.click();
    showToast(`${activeTeam}조 4명 합본 보고 이미지가 저장되었습니다`);
  });

  document.getElementById('btnCopyTeamSummaryText')?.addEventListener('click', async () => {
    const txt = window.ZoneShareHelper.buildTeamReportText({
      teamNum: activeTeam,
      date,
      membersData
    });
    await copyToClipboard(txt, `${activeTeam}조 4명 블록 요약 문구가 복사되었습니다`);
  });
}

// 전체 20명 모두가 보는 5개 조 식단 담당 종합 보고 공간
function renderAll20MemberSpace(container, modeSwitchHtml, date, participants, teamReports) {
  const todayReports = teamReports.filter(r => r.date === date);

  const teamSectionsHtml = [1, 2, 3, 4, 5]
    .map(teamNum => {
      const report = todayReports.find(r => Number(r.team) === teamNum);
      const members = participants.filter(p => Number(p.team) === teamNum);
      const dietManager = members.find(m => m.role === '식단담당' || m.role === '조장') || members[0];

      const memberGridHtml = members
        .map(m => {
          const l = getUserDailyLog(m.id, date);
          const meals = l.meals || [];
          const totals = window.ZoneShareHelper.computeTotals(meals);
          const isOver =
            totals.carb > m.targetBlocks ||
            totals.protein > m.targetBlocks ||
            totals.fat > m.targetBlocks;
          const photos = [];
          meals.forEach(meal => {
            window.ZoneShareHelper.getMealPhotos(meal).forEach(src => {
              photos.push({ type: meal.type, src });
            });
          });

          return `
            <div style="background:var(--bg-subtle);border:1px solid var(--border-hairline);border-radius:12px;padding:11px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <strong style="font-size:13.5px;">${m.name} <small style="color:var(--text-tertiary);font-weight:600;">(${m.targetBlocks}B)</small></strong>
                <span style="font-size:12px;font-weight:800;color:${
                  meals.length === 0 ? 'var(--text-tertiary)' : isOver ? 'var(--signal)' : 'var(--text-primary)'
                };">
                  ${
                    meals.length === 0
                      ? '미등록'
                      : `탄${formatBlock(totals.carb)}·단${formatBlock(totals.protein)}·지${formatBlock(totals.fat)}`
                  }
                </span>
              </div>
              ${
                photos.length === 0
                  ? `<div style="font-size:11.5px;color:var(--text-tertiary);padding:10px 0;">사진 없음</div>`
                  : `<div class="team-photo-strip">
                      ${photos
                        .map(
                          p => `
                        <div class="team-photo-card" style="width:78px;height:60px;">
                          <img src="${p.src}" alt="${p.type}" />
                          <span class="team-photo-badge" style="font-size:9.5px;padding:1px 5px;">${p.type}</span>
                        </div>
                      `
                        )
                        .join('')}
                    </div>`
              }
            </div>
          `;
        })
        .join('');

      return `
        <section class="card">
          <div class="card-header">
            <div>
              <div class="section-eyebrow">TEAM 0${teamNum} REPORT · 식단담당 ${dietManager ? dietManager.name : ''}</div>
              <div class="card-title">${teamNum}조 4인 식단 & 블록 보고</div>
              <div class="card-subtitle">${
                report ? report.comment : '아직 식단 담당의 전체방 공식 보고가 등록되지 않았습니다 (실시간 현황 표시 중)'
              }</div>
            </div>
            <span class="tag ${report ? 'tag-ok' : 'tag-neutral'}">
              ${report ? '보고 완료' : '보고 전'}
            </span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${memberGridHtml}
          </div>

          <div style="margin-top:12px;display:flex;justify-content:flex-end;">
            <button type="button" class="btn btn-secondary btn-sm" data-jump-team-space="${teamNum}">
              ${teamNum}조 공간으로 이동해서 보고하기
            </button>
          </div>
        </section>
      `;
    })
    .join('');

  container.innerHTML = `
    ${modeSwitchHtml}

    <section class="card-hero">
      <div class="card-header" style="margin-bottom:6px;">
        <div>
          <div class="section-eyebrow">ALL 20 MEMBERS LOUNGE</div>
          <div class="card-title">전체 20명 식단 보고 공간</div>
          <div class="card-subtitle">각 조의 식단 담당이 취합해 올린 1조~5조(20명) 전체 식단 사진과 블록 현황입니다</div>
        </div>
        <span class="tag tag-volt">${todayReports.length} / 5개 조 보고 완료</span>
      </div>
    </section>

    ${teamSectionsHtml}
  `;

  document.getElementById('btnModeTeamSpace')?.addEventListener('click', () => {
    AppState.teamSpaceMode = 'teamSpace';
    renderMain();
  });
  document.getElementById('btnModeAllSpace')?.addEventListener('click', () => {
    AppState.teamSpaceMode = 'allSpace';
    renderMain();
  });
  document.querySelectorAll('[data-jump-team-space]').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.selectedTeamNum = Number(btn.dataset.jumpTeamSpace);
      AppState.teamSpaceMode = 'teamSpace';
      renderMain();
    });
  });
}

// ============================================================================
// TAB 3: 네이버 카페 사진+블록 복사 & 카페로 바로 이동
// 네이버 카페 에디터(SmartEditor ONE)는 HTML 내 Base64 이미지를 차단하고,
// 클립보드의 순수 이미지(image/png)만 Ctrl+V 시 실제 사진으로 업로드합니다.
// ============================================================================
async function renderShareTab(container) {
  const user = getCurrentUser();
  const log = getUserDailyLog(user.id, AppState.selectedDate);
  const meals = log.meals || [];
  const missionDone = isUserWeeklyMissionDone(user.id);
  const settings = AppState.db.settings || {};
  const cafeUrl = settings.cafeUrl || 'https://cafe.naver.com/';

  const cafeTitle = window.ZoneShareHelper.buildCafeTitle({
    user,
    date: AppState.selectedDate,
    meals
  });

  const cafeBottomText = window.ZoneShareHelper.buildCafeBottomBlockText({
    user,
    date: AppState.selectedDate,
    meals,
    missionDone
  });

  const order = ['아침', '점심', '저녁', '간식'];
  const sortedMeals = [...meals].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const individualPhotos = [];
  sortedMeals.forEach(m => {
    const photos = window.ZoneShareHelper.getMealPhotos(m);
    photos.forEach((src, idx) => {
      individualPhotos.push({
        label: photos.length > 1 ? `${m.type} 사진 ${idx + 1}` : `${m.type} 사진`,
        src
      });
    });
  });

  container.innerHTML = `
    <!-- 1. 가장 빠른 방법: 아침·점심·저녁 사진 + 하단 탄단지 블록 통합 이미지 복사 (Ctrl+V 1번으로 끝!) -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">METHOD 1 · ONE-PASTE IMAGE COPY (추천)</div>
          <div class="card-title">아침·점심·저녁 사진 + 하단 블록 통째로 복사</div>
          <div class="card-subtitle">네이버 카페는 글자와 사진을 동시에 붙여넣으면 사진이 차단됩니다. 아래 버튼으로 복사하면 카페 본문에서 <strong>Ctrl+V(붙여넣기) 한 번으로 사진들과 하단 블록 수가 통째로 삽입</strong>됩니다!</div>
        </div>
        <span class="tag ${log.cafePosted ? 'tag-ok' : 'tag-neutral'}">
          ${log.cafePosted ? '카페 인증완료' : '작성 전'}
        </span>
      </div>

      <!-- 게시글 제목 복사 -->
      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:5px;">1. 카페 게시글 제목 복사</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;">
        <input type="text" class="input-field" readonly value="${cafeTitle}" style="font-weight:700;font-size:13px;" />
        <button type="button" class="btn btn-secondary" id="btnCopyTitleOnly" style="white-space:nowrap;">
          ${Icons.copy}
          <span>제목 복사</span>
        </button>
      </div>

      <!-- 카페 본문에 그대로 들어갈 화이트 일체형 시트 미리보기 -->
      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:6px;">
        2. 카페 본문 붙여넣기용 미리보기 (위: 아침·점심·저녁 사진 / 아래: 총 탄단지 블록 수)
      </div>
      <div class="summary-canvas-wrap" style="background:#FFFFFF;">
        <canvas id="summaryCardCanvas"></canvas>
      </div>

      <!-- 원클릭 이미지 복사 & 네이버 카페 바로 이동 버튼 -->
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
        <button type="button" class="btn btn-primary btn-block" id="btnCopyCombinedImageAndOpenCafe" style="padding:15px 16px;font-size:15px;">
          ${Icons.copy}
          <span>위 식단사진+블록 통째로 복사 후 네이버 카페 이동</span>
          ${Icons.external}
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button type="button" class="btn btn-secondary" id="btnCopyCombinedImageOnly">
            ${Icons.copy}
            <span>이동 없이 클립보드 복사만</span>
          </button>
          <button type="button" class="btn btn-outline" id="btnDownloadCardImg">
            ${Icons.download}
            <span>이미지 파일로 저장</span>
          </button>
        </div>
      </div>
    </section>

    <!-- 2. 사진과 텍스트(글자)를 따로 붙여넣고 싶을 때 (2단계 복사) -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">METHOD 2 · SEPARATE PHOTO & TEXT PASTE</div>
          <div class="card-title">사진 붙여넣기 후 밑에 글자로 블록 붙여넣기</div>
          <div class="card-subtitle">카페 본문에 <strong>[① 사진 복사 → Ctrl+V]</strong> 한 뒤, 그 밑에 <strong>[② 블록 글 복사 → Ctrl+V]</strong> 하는 방식입니다</div>
        </div>
      </div>

      <!-- 숨김 캔버스: 아침·점심·저녁 사진만 모은 콜라주 -->
      <canvas id="photosOnlyCanvas" style="display:none;"></canvas>

      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:8px;">
        ① 식단 사진 클립보드 복사 (카페 에디터에서 Ctrl+V 하면 사진이 올라갑니다)
      </div>
      <button type="button" class="btn btn-primary btn-block" id="btnCopyPhotosOnly" style="margin-bottom:10px;">
        ${Icons.copy}
        <span>① 아침·점심·저녁 사진 전체 한 번에 복사하기 (Ctrl+V용)</span>
      </button>

      ${
        individualPhotos.length > 0
          ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">
              ${individualPhotos
                .map(
                  (p, idx) => `
                <button type="button" class="btn btn-outline btn-sm" data-copy-single-photo="${idx}">
                  ${Icons.copy}
                  <span>${p.label}만 복사</span>
                </button>
              `
                )
                .join('')}
            </div>`
          : ''
      }

      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:6px;">
        ② 사진 밑에 붙여넣을 탄·단·지 블록 텍스트
      </div>
      <div class="copy-preview" style="margin-top:0;">${cafeBottomText}</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
        <button type="button" class="btn btn-primary" id="btnCopyBottomTextOnly">
          ${Icons.copy}
          <span>② 하단 블록 텍스트 복사</span>
        </button>
        <a href="${cafeUrl}" target="_blank" rel="noopener" class="btn btn-outline" id="btnOpenCafeDirect">
          <span>네이버 카페 열기</span>
          ${Icons.external}
        </a>
      </div>
    </section>
  `;

  const summaryCanvas = document.getElementById('summaryCardCanvas');
  const photosOnlyCanvas = document.getElementById('photosOnlyCanvas');

  if (summaryCanvas) {
    await window.ZoneShareHelper.renderSummaryCardCanvas(summaryCanvas, {
      user,
      date: AppState.selectedDate,
      meals,
      missionDone
    });
  }
  if (photosOnlyCanvas) {
    await window.ZoneShareHelper.renderPhotosOnlyCanvas(photosOnlyCanvas, {
      user,
      date: AppState.selectedDate,
      meals
    });
  }

  document.getElementById('btnCopyTitleOnly')?.addEventListener('click', async () => {
    await copyToClipboard(cafeTitle, '카페 게시글 제목이 복사되었습니다');
  });

  // 방법 1: 사진+블록 일체형 시트를 실제 image/png로 복사 후 네이버 카페 열기
  document.getElementById('btnCopyCombinedImageAndOpenCafe')?.addEventListener('click', async () => {
    if (!summaryCanvas) return;
    await copyCanvasImageToClipboard(
      summaryCanvas,
      '사진+블록이 클립보드에 복사되었습니다! 네이버 카페 본문에서 Ctrl+V를 누르세요'
    );
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      cafePosted: true
    });
    window.open(cafeUrl, '_blank', 'noopener');
    await loadState();
  });

  document.getElementById('btnCopyCombinedImageOnly')?.addEventListener('click', async () => {
    if (!summaryCanvas) return;
    await copyCanvasImageToClipboard(
      summaryCanvas,
      '사진+블록 이미지가 복사되었습니다! 카페 본문에서 Ctrl+V를 누르세요'
    );
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      cafePosted: true
    });
    await loadState();
  });

  document.getElementById('btnDownloadCardImg')?.addEventListener('click', () => {
    if (!summaryCanvas) return;
    const link = document.createElement('a');
    link.download = `LEBEN_ZONE_${user.team}조_${user.name}_${AppState.selectedDate}.png`;
    link.href = summaryCanvas.toDataURL('image/png');
    link.click();
    showToast('식단+블록 이미지가 파일로 저장되었습니다');
  });

  // 방법 2-1: 아침·점심·저녁 사진들만 모은 콜라주를 실제 image/png로 복사
  document.getElementById('btnCopyPhotosOnly')?.addEventListener('click', async () => {
    if (!photosOnlyCanvas) return;
    await copyCanvasImageToClipboard(
      photosOnlyCanvas,
      '아침·점심·저녁 사진이 복사되었습니다! 카페 본문에서 Ctrl+V 하세요'
    );
  });

  // 개별 끼니 사진 1장씩 클립보드 복사
  document.querySelectorAll('[data-copy-single-photo]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.copySinglePhoto);
      const targetPhoto = individualPhotos[idx];
      if (!targetPhoto) return;
      await copySinglePhotoToClipboard(targetPhoto.src, targetPhoto.label);
    });
  });

  // 방법 2-2: 사진 밑에 넣을 탄단지 블록 텍스트 복사
  document.getElementById('btnCopyBottomTextOnly')?.addEventListener('click', async () => {
    await copyToClipboard(
      cafeBottomText,
      '탄단지 블록 텍스트가 복사되었습니다! 사진 아래에 Ctrl+V 하세요'
    );
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      cafePosted: true
    });
    await loadState();
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
    NO_KAKAO: '조별 공간 자정 미보고',
    NO_MISSION: '주간 미션 미수행',
    MANUAL: '운영진 부여'
  };

  container.innerHTML = `
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
          <div style="color:#FFFFFF;font-weight:700;">02. 조별 공간 자정 미보고</div>
          <div style="color:#8B95A1;margin-top:2px;">24:00 전 식단·블록 미보고 +1만원</div>
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
          조 편성(1~5조), 식단담당 지정, 개인별 목표 블록 설정, 주간 미션 등록 및<br/>자정 마감 미인증자 일괄 패널티 정산을 관리합니다.
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
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">AUTO SETTLEMENT</div>
          <div class="card-title">일일 마감 위반자 자동 스캔</div>
          <div class="card-subtitle">${AppState.selectedDate.replace(
            /-/g,
            '.'
          )} 기준 블록 초과·조별 미보고·카페 미작성 인원을 추출합니다</div>
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
                스캔 버튼을 누르면 20명 전원의 목표 블록 초과 여부와 조별·카페 인증 상태를 검사합니다.
              </div>`
        }
      </div>
    </section>

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
          <option value="NO_KAKAO">자정 전 조별 공간 미보고</option>
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

    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">CHALLENGE CONFIG</div>
          <div class="card-title">주간 미션 및 네이버 카페 주소 설정</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">챌린지 타이틀</label>
          <input type="text" class="input-field" id="cfgChallengeName" value="${settings.challengeName || ''}" />
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">네이버 카페 이동 주소 (글쓰기 게시판 URL)</label>
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

    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">PARTICIPANTS</div>
          <div class="card-title">참가자 명단 · 식단담당 · 목표 블록 (${AppState.db.participants.length}명)</div>
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
                <td style="width:64px;">
                  <select class="p-team">
                    ${[1, 2, 3, 4, 5]
                      .map(t => `<option value="${t}" ${Number(p.team) === t ? 'selected' : ''}>${t}조</option>`)
                      .join('')}
                  </select>
                </td>
                <td><input type="text" class="p-name" value="${p.name}" /></td>
                <td style="width:82px;">
                  <select class="p-role">
                    <option value="식단담당" ${p.role === '식단담당' || p.role === '조장' ? 'selected' : ''}>식단담당</option>
                    <option value="조원" ${p.role !== '식단담당' && p.role !== '조장' ? 'selected' : ''}>조원</option>
                  </select>
                </td>
                <td style="width:68px;"><input type="number" class="p-blocks" value="${p.targetBlocks}" min="5" max="25" step="1" /></td>
                <td style="width:70px;"><input type="text" class="p-pin" value="${p.pin || '1234'}" maxlength="4" /></td>
                <td style="width:48px;">
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

    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">SYSTEM & DATA</div>
          <div class="card-title">접속 링크 및 데이터 관리</div>
        </div>
      </div>
      <div style="background:var(--bg-subtle);padding:13px;border-radius:12px;font-size:13px;margin-bottom:12px;">
        <div><strong>모바일 접속 주소 :</strong> <span style="color:var(--text-primary);font-weight:700;">${shareUrl}</span></div>
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

      if (!log.kakaoReported && meals.length === 0) {
        violations.push({
          userId: p.id,
          userName: p.name,
          team: p.team,
          date,
          type: 'NO_KAKAO',
          reason: `자정 전 ${p.team}조 공간 식단 미보고`
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
      NO_KAKAO: '자정 전 조별 공간 식단 미보고',
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
                      <span>${m.name}${m.role === '식단담당' ? ' (담당)' : ''}</span>
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
      AppState.selectedTeamNum = Number(chosenUser.team);
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
