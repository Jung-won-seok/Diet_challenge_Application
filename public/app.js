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
  send: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  naver: `<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:#03C75A;color:#FFFFFF;font-weight:900;font-size:10.5px;line-height:1;flex-shrink:0;">N</span>`
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
    if (badgeEl) {
      badgeEl.innerHTML = user.hasNaverToken
        ? `${Icons.naver} <span>${user.name} · 카페연동됨</span>`
        : `${Icons.naver} <span>${user.name} · 카페에 연동하기</span>`;
    }
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
  const naverCfg = AppState.db.settings?.naverConfig || {};
  const activeCohort = user.cohortGroup || naverCfg.activeCohortGroup || '2026년 2기';
  const cafeDisplayName = naverCfg.cafeName || '나의 카페라떼';
  const boardMenuId = user.cafeMenuId || naverCfg.teamMenuIds?.[String(user.team)] || naverCfg.defaultMenuId || '';

  container.innerHTML = `
    <!-- 0. 네이버 로그인 후 카페(나의 카페라떼 · 2026년 2기) 내 이름 선택 & 연동 배너 (iOS Liquid Glass) -->
    <div style="background:linear-gradient(135deg, rgba(255,255,255,0.78) 0%, rgba(236,253,245,0.58) 100%);backdrop-filter:blur(28px) saturate(195%);-webkit-backdrop-filter:blur(28px) saturate(195%);border:1px solid rgba(255,255,255,0.88);box-shadow:0 12px 32px -6px rgba(3,199,90,0.12), inset 0 1.5px 1px rgba(255,255,255,0.95);border-radius:22px;padding:13px 16px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;color:var(--text-primary);">
      <div style="display:flex;align-items:center;gap:11px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;background:linear-gradient(145deg, #06D666 0%, #03B954 100%);box-shadow:0 4px 12px rgba(3,199,90,0.32), inset 0 1px 0.5px rgba(255,255,255,0.45);color:#FFFFFF;font-weight:900;font-size:17px;flex-shrink:0;">N</span>
        <div>
          <div style="font-size:11px;font-weight:800;color:#059669;letter-spacing:0.03em;">
            ${cafeDisplayName} (${naverCfg.cafeSlug || 'mycaffelatte'}) · ${activeCohort}
          </div>
          <div style="font-size:13.5px;font-weight:800;color:var(--text-primary);margin-top:1px;">
            ${
              user.hasNaverToken
                ? `${user.team}조 [${user.name}] 카페 게시판(#${boardMenuId}) 연동됨 (${user.naverNickname || '네이버회원'})`
                : `현재 선택: ${user.team}조 [${user.name}] (게시판 #${boardMenuId}) · 네이버 로그인 필요`
            }
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-sm" id="btnHeroNaverCafeLink" style="background:linear-gradient(180deg, #06D666 0%, #03B954 100%);color:#FFFFFF;font-weight:800;padding:9px 14px;font-size:12.5px;border-radius:999px;box-shadow:0 4px 14px rgba(3,199,90,0.28), inset 0 1px 0.5px rgba(255,255,255,0.45);white-space:nowrap;">
        ${user.hasNaverToken ? '내 이름/카페 연동 변경' : '네이버 로그인 후 카페에 연동하기'}
      </button>
    </div>

    <!-- 1. 오늘 하루 총 섭취 탄·단·지 블록 히어로 카드 -->
    <section class="card-hero">
      <div class="card-header" style="margin-bottom:12px;">
        <div>
          <div class="section-eyebrow">STEP 1 · DAILY ZONE REPORT</div>
          <div class="card-title">${activeCohort} · ${user.team}조 ${user.name} · 오늘 총 섭취 블록</div>
          <div class="card-subtitle">${AppState.selectedDate.replace(/-/g, '.')} · 일일 목표 각 ${target}블록 · 카페 개인 게시판 #${boardMenuId}</div>
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
        <button type="button" class="btn btn-primary" id="btnGoCafeShare" style="background:#03C75A;border-color:#03C75A;">
          ${Icons.naver}
          <span>${user.team}조 카페 업로드</span>
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

  document.getElementById('btnHeroNaverCafeLink')?.addEventListener('click', () => {
    openUserSwitchModal(user.id);
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
  const cafeUrl = settings.cafeUrl || 'https://cafe.naver.com/mycaffelatte';
  const naverCfg = settings.naverConfig || {};
  const clubId = String(naverCfg.clubId || '31811778').trim();
  const teamMenuId = String(naverCfg.teamMenuIds?.[String(user.team)] || '').trim();
  const targetMenuId = String(user.cafeMenuId || teamMenuId || naverCfg.defaultMenuId || '').trim();
  const activeCohort = user.cohortGroup || naverCfg.activeCohortGroup || '2026년 2기';
  const directBoardUrl =
    clubId && targetMenuId
      ? `https://cafe.naver.com/f-e/cafes/${clubId}/menus/${targetMenuId}`
      : cafeUrl;
  const isNaverLinked = Boolean(user.hasNaverToken);

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

  const postReceiptHtml = log.cafePostInfo
    ? `
      <div style="background:rgba(3,199,90,0.12);border:1px solid rgba(3,199,90,0.35);border-radius:12px;padding:12px 14px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="font-size:13px;font-weight:800;color:#4ADE80;">
            ✓ ${log.cafePostInfo.mode === 'api' ? '네이버 카페 API 자동 등록 완료' : '카페 자동 등록 완료 (테스트 모드)'}
          </div>
          <a href="${log.cafePostInfo.articleUrl || directBoardUrl}" target="_blank" rel="noopener" class="btn btn-sm" style="background:#03C75A;color:#fff;padding:5px 10px;font-size:11.5px;">
            <span>내 카페 게시판 열기</span>
            ${Icons.external}
          </a>
        </div>
        <div style="font-size:12px;color:#D1D5DB;margin-top:4px;">
          대상: ${naverCfg.cafeName || '나의 카페라떼'}(${log.cafePostInfo.clubId}) · ${activeCohort} · [${user.team}조 ${user.name}] 게시판(#${log.cafePostInfo.menuId}) · 첨부 사진 ${log.cafePostInfo.imageCount || 1}장
        </div>
      </div>
    `
    : '';

  container.innerHTML = `
    <!-- 0. 네이버 로그인 + 카페 개인 게시판 자동 글쓰기 API 연동 -->
    <section class="card-hero">
      <div class="card-header" style="margin-bottom:12px;">
        <div>
          <div class="section-eyebrow" style="color:#03C75A;">NAVER CAFE OPEN API · ${activeCohort} · ${user.team}조</div>
          <div class="card-title" style="display:flex;align-items:center;gap:7px;">
            ${Icons.naver}
            <span>[${user.team}조 ${user.name}] 카페 게시판 자동 업로드</span>
          </div>
          <div class="card-subtitle">
            오늘의 아침·점심·저녁 식단 사진과 탄단지 블록을 <strong>${
              naverCfg.cafeName || '나의 카페라떼'
            } &gt; ${activeCohort} &gt; ${user.name} 게시판(#${targetMenuId})</strong>에 바로 등록합니다
          </div>
        </div>
        <span class="tag ${log.cafePosted ? 'tag-volt' : 'tag-neutral'}">
          ${log.cafePosted ? '카페 인증완료' : '업로드 대기'}
        </span>
      </div>

      ${postReceiptHtml}

      <!-- 현재 네이버 계정 연동 및 대상 카페/개인 게시판 상태 요약 -->
      <div style="background:var(--bg-carbon-sub);border:1px solid rgba(255,255,255,0.08);border-radius:13px;padding:12px 14px;margin-bottom:12px;font-size:12.5px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.07);gap:8px;flex-wrap:wrap;">
          <div>
            <span style="color:#9CA3AF;">1. 네이버 로그인 & 내 이름 연동 :</span>
            <strong style="color:${isNaverLinked ? '#4ADE80' : '#FBBF24'};margin-left:6px;">
              ${
                isNaverLinked
                  ? `[${user.team}조 ${user.name}] 연동됨 (${user.naverNickname || user.name}${user.naverId?.startsWith('sim_') ? ' · 테스트계정' : ''})`
                  : `[${user.team}조 ${user.name}] 선택됨 · 네이버 미연동`
              }
            </strong>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btnOpenNaverLinkModal" style="padding:5px 11px;font-size:11.5px;background:#03C75A;color:#fff;border:none;font-weight:800;">
            ${isNaverLinked ? '내 이름/계정 변경' : '네이버 로그인 후 카페에 연동하기'}
          </button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <div>
            <span style="color:#9CA3AF;">2. 업로드 대상 카페 게시판 :</span>
            <strong style="color:#FFFFFF;margin-left:6px;">
              ${
                clubId
                  ? `${naverCfg.cafeName || '나의 카페라떼'} (${ activeCohort }) &gt; [${user.team}조] ${user.name} 게시판 (menuId: ${
                      targetMenuId || '미지정'
                    })`
                  : '아직 카페 번호(clubId)가 설정되지 않았습니다'
              }
            </strong>
          </div>
          <div style="display:flex;gap:6px;">
            <a href="${directBoardUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="padding:4px 10px;font-size:11.5px;">
              <span>내 게시판 열기</span>
              ${Icons.external}
            </a>
            <button type="button" class="btn btn-secondary btn-sm" id="btnJumpCafeApiConfig" style="padding:4px 10px;font-size:11.5px;">
              카페 설정
            </button>
          </div>
        </div>
      </div>

      <!-- 자동 등록할 게시글 제목 및 첨부 옵션 -->
      <div style="margin-bottom:10px;">
        <label style="font-size:11.5px;font-weight:700;color:#9CA3AF;display:block;margin-bottom:4px;">
          카페에 등록될 게시글 제목 (수정 가능)
        </label>
        <input type="text" class="input-field" id="cafeApiSubjectInput" value="${cafeTitle}" style="background:var(--bg-carbon-sub);border-color:rgba(255,255,255,0.12);color:#FFFFFF;font-weight:700;font-size:13px;" />
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11.5px;font-weight:700;color:#9CA3AF;display:block;margin-bottom:4px;">
          업로드 포맷 및 사진 첨부 방식 선택
        </label>
        <select class="input-field" id="cafeApiAttachMode" style="background:var(--bg-carbon-sub);border-color:rgba(255,255,255,0.12);color:#FFFFFF;font-size:12.5px;">
          <option value="meals_by_section">끼니별(아침·점심·저녁) 구별 사진 + 각 사진 밑에 끼니별 블럭 표시 (권장 · ${individualPhotos.length}장)</option>
          <option value="both">일체형 요약 카드 + 끼니별(아침·점심·저녁) 구별 사진 및 블럭 (${individualPhotos.length + 1}장)</option>
          <option value="summary_only">아침·점심·저녁+끼니별 블럭 일체형 요약 카드 1장만 첨부</option>
        </select>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        <button type="button" class="btn btn-block" id="btnAutoPostNaverCafe" style="background:#03C75A;color:#FFFFFF;font-weight:800;padding:15px 16px;font-size:15px;touch-action:manipulation;cursor:pointer;">
          ${Icons.naver}
          <span>[${activeCohort} · ${user.team}조 ${user.name}] 카페 게시판(#${targetMenuId})에 자동 등록</span>
        </button>
        <div id="cafeAutoPostLiveStatus" style="display:none;padding:12px 14px;border-radius:14px;background:rgba(3,199,90,0.14);border:1px solid rgba(3,199,90,0.38);color:#A7F3D0;font-size:12.5px;font-weight:600;line-height:1.5;"></div>
        <button type="button" class="btn btn-secondary btn-block btn-sm" id="btnSimulatePostNaverCafe" style="touch-action:manipulation;">
          <span>API 키 입력 전 테스트(시뮬레이션) 모드로 [${user.name}] 게시판 업로드 체험하기</span>
        </button>
      </div>
      <div style="font-size:11.5px;color:#9CA3AF;margin-top:8px;line-height:1.45;">
        * 현재 <strong>https://cafe.naver.com/mycaffelatte (${activeCohort})</strong>의 앞에서부터 4명씩 <code>1조~5조</code> 및 개인 게시판(<code>#${targetMenuId}</code>) 구조가 자동 연동되어 있습니다.<br/>
        * 모바일에서도 버튼 터치 시 <strong>☀️ 아침 식단 ➔ 아침 사진 ➔ 아침 탄·단·지 블럭 ➔ 🌤️ 점심 식단 ➔ 점심 사진 ➔ 점심 탄·단·지 블럭 ➔ 🌙 저녁 식단 ➔ 저녁 사진 ➔ 저녁 탄·단·지 블럭</strong> 순서로 구별되어 자동 작성됩니다.
      </div>
    </section>

    <!-- 1. 수동 복사 방식: 아침·점심·저녁 사진 + 끼니별 탄단지 블록 통합 이미지 복사 (Ctrl+V 1번으로 끝!) -->
    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">METHOD 1 · ONE-PASTE IMAGE COPY (수동 붙여넣기용)</div>
          <div class="card-title">아침·점심·저녁 구별 사진 + 끼니별 블럭 통째로 복사</div>
          <div class="card-subtitle">직접 카페에 붙여넣고 싶을 때 사용하세요. 카페 본문에서 <strong>Ctrl+V(붙여넣기) 한 번으로 끼니별 사진과 그 밑의 끼니별 블럭 수가 통째로 삽입</strong>됩니다!</div>
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
        2. 카페 본문 붙여넣기용 미리보기 (아침·점심·저녁 구별 + 각 사진 밑에 끼니별 탄단지 블럭 표시)
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
          <div class="card-title">아침·점심·저녁 구별 텍스트 및 사진 개별 복사</div>
          <div class="card-subtitle">카페 본문에 <strong>[① 사진 복사 → Ctrl+V]</strong> 한 뒤, 그 밑에 <strong>[② 끼니별 블럭 글 복사 → Ctrl+V]</strong> 하는 방식입니다</div>
        </div>
      </div>

      <!-- 숨김 캔버스: 아침·점심·저녁 사진만 모은 콜라주 -->
      <canvas id="photosOnlyCanvas" style="display:none;"></canvas>

      <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:8px;">
        ① 식단 사진 클립보드 복사 (카페 에디터에서 Ctrl+V 하면 사진이 올라갑니다)
      </div>
      <button type="button" class="btn btn-primary btn-block" id="btnCopyPhotosOnly" style="margin-bottom:10px;">
        ${Icons.copy}
        <span>① 아침·점심·저녁 사진+끼니별 블럭 시트 복사하기 (Ctrl+V용)</span>
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
        ② 아침·점심·저녁 구별 + 끼니별 탄·단·지 블럭 텍스트
      </div>
      <div class="copy-preview" style="margin-top:0;">${cafeBottomText}</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
        <button type="button" class="btn btn-primary" id="btnCopyBottomTextOnly">
          ${Icons.copy}
          <span>② 끼니별 블럭 텍스트 복사</span>
        </button>
        <a href="${directBoardUrl}" target="_blank" rel="noopener" class="btn btn-outline" id="btnOpenCafeDirect">
          <span>내 카페 게시판 열기</span>
          ${Icons.external}
        </a>
      </div>
    </section>
  `;

  const summaryCanvas = document.getElementById('summaryCardCanvas');
  const photosOnlyCanvas = document.getElementById('photosOnlyCanvas');

  // 중요: 모바일(iOS Safari 등)에서 캔버스 렌더링을 기다리지 않고 즉시 버튼 터치 이벤트가 동작하도록 먼저 바인딩!
  document.getElementById('btnOpenNaverLinkModal')?.addEventListener('click', () => {
    openUserSwitchModal(user.id);
  });

  document.getElementById('btnJumpCafeApiConfig')?.addEventListener('click', () => {
    AppState.activeTab = 'admin';
    AppState.adminUnlocked = true;
    sessionStorage.setItem('leben_admin_unlocked', 'true');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderMain();
    setTimeout(() => {
      document.getElementById('naverCafeConfigCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });

  async function executeCafeAutoPost(simulateMode = false) {
    const btn = document.getElementById(
      simulateMode ? 'btnSimulatePostNaverCafe' : 'btnAutoPostNaverCafe'
    );
    const liveStatusEl = document.getElementById('cafeAutoPostLiveStatus');
    const prevHtml = btn ? btn.innerHTML : '';

    const setLiveStatus = (msg, isError = false) => {
      if (!liveStatusEl) return;
      liveStatusEl.style.display = 'block';
      liveStatusEl.style.background = isError ? 'rgba(239,68,68,0.16)' : 'rgba(3,199,90,0.16)';
      liveStatusEl.style.borderColor = isError ? 'rgba(239,68,68,0.45)' : 'rgba(3,199,90,0.42)';
      liveStatusEl.style.color = isError ? '#FCA5A5' : '#A7F3D0';
      liveStatusEl.innerHTML = msg;
    };

    try {
      // 1) 터치 즉시 버튼 및 상태창 반응 표시 (모바일 무반응 현상 완전 해결)
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ 끼니별(아침·점심·저녁) 사진 및 블럭 데이터 준비 중...';
      }
      setLiveStatus(
        `⏳ <strong>[${user.team}조 ${user.name}]</strong> 님의 아침·점심·저녁 식단 사진과 끼니별 탄·단·지 블럭 데이터를 준비하고 있습니다...`
      );
      showToast('카페 게시글(아침·점심·저녁 구별 포맷) 자동 등록을 시작합니다...');

      const subjectVal =
        document.getElementById('cafeApiSubjectInput')?.value.trim() || cafeTitle;
      const attachMode =
        document.getElementById('cafeApiAttachMode')?.value || 'meals_by_section';

      const contentHtml = window.ZoneShareHelper.buildCafeArticleHtml({
        user,
        date: AppState.selectedDate,
        meals,
        missionDone
      });

      // 2) 끼니별(아침/점심/저녁/간식) 섹션 구조 및 이미지 생성
      const { sections: mealSections, footerSummaryText } =
        await window.ZoneShareHelper.buildCafeMealSections({
          user,
          date: AppState.selectedDate,
          meals,
          missionDone
        });

      const imagesToUpload = [];
      if ((attachMode === 'both' || attachMode === 'summary_only') && summaryCanvas && summaryCanvas.width > 0) {
        try {
          imagesToUpload.push(summaryCanvas.toDataURL('image/jpeg', 0.9));
        } catch (_) {}
      }
      if (attachMode === 'both' || attachMode === 'meals_by_section' || attachMode === 'meals_only') {
        for (const sec of mealSections) {
          for (const imgUrl of sec.images || []) {
            imagesToUpload.push(imgUrl);
          }
        }
      }

      if (btn) {
        btn.textContent = '🚀 네이버 카페 게시판에 아침·점심·저녁 식단 및 블럭 자동 작성 중...';
      }
      setLiveStatus(
        `🚀 네이버 카페 <strong>[${activeCohort} · ${user.team}조 ${user.name}]</strong> 게시판(#${targetMenuId})에 <strong>아침·점심·저녁 구별 사진과 끼니별 탄·단·지 블럭</strong>을 자동 작성 중입니다... (약 8~15초 소요)`
      );

      let result;
      try {
        result = await apiRequest('/api/naver/cafe-post', 'POST', {
          userId: user.id,
          date: AppState.selectedDate,
          subject: subjectVal,
          contentHtml,
          contentText: cafeBottomText,
          images: imagesToUpload,
          mealSections: attachMode === 'summary_only' ? [] : mealSections,
          footerSummaryText,
          attachMode,
          simulate: simulateMode
        });
      } catch (postErr) {
        // 만약 네이버 로그인 세션이 전혀 없거나 만료된 경우에만 로그인 창 호출 (기존 쿠키 강제 초기화 방지: forceLoginWindow: false)
        if (!simulateMode && (postErr.message?.includes('로그인') || postErr.message?.includes('연동'))) {
          setLiveStatus(
            `🔐 네이버 로그인 세션 확인 중입니다. PC 화면에 로그인 창이 열리면 로그인해 주세요...`
          );
          await apiRequest('/api/naver/browser-login', 'POST', {
            userId: user.id,
            forceLoginWindow: false
          });
          result = await apiRequest('/api/naver/cafe-post', 'POST', {
            userId: user.id,
            date: AppState.selectedDate,
            subject: subjectVal,
            contentHtml,
            contentText: cafeBottomText,
            images: imagesToUpload,
            mealSections: attachMode === 'summary_only' ? [] : mealSections,
            footerSummaryText,
            attachMode,
            simulate: simulateMode
          });
        } else {
          throw postErr;
        }
      }

      const postedUrl = result.postInfo?.articleUrl || directBoardUrl;
      if (result.simulated) {
        setLiveStatus(
          `✅ <strong>[테스트 완료]</strong> ${activeCohort} · ${user.team}조 [${user.name}] 게시판(#${result.postInfo?.menuId})에 끼니별 사진과 블럭 내역이 등록되었습니다!`
        );
        showToast(
          `[테스트 완료] ${activeCohort} · ${user.team}조 [${user.name}] 게시판(#${result.postInfo?.menuId})에 등록되었습니다!`
        );
      } else {
        setLiveStatus(
          `✅ <strong>네이버 카페 자동 등록 완료!</strong> [${user.team}조 ${user.name}] 게시판(#${result.postInfo?.menuId})에 아침·점심·저녁 식단과 끼니별 블럭이 등록되었습니다. <a href="${postedUrl}" target="_blank" rel="noopener" style="color:#FFFFFF;text-decoration:underline;font-weight:800;margin-left:6px;">등록된 카페 게시글 바로 보기 ↗</a>`
        );
        showToast(
          `네이버 카페 [${user.team}조 ${user.name}] 게시판(#${result.postInfo?.menuId})에 식단 게시글이 실제로 등록되었습니다!`
        );
      }
      await loadState();
    } catch (err) {
      const errMsg = err.message || '카페 업로드 중 오류가 발생했습니다';
      setLiveStatus(`⚠️ <strong>업로드 안내:</strong> ${errMsg}`, true);
      showToast(errMsg);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
      }
    }
  }

  document.getElementById('btnAutoPostNaverCafe')?.addEventListener('click', () => {
    executeCafeAutoPost(false);
  });

  document.getElementById('btnSimulatePostNaverCafe')?.addEventListener('click', () => {
    executeCafeAutoPost(true);
  });

  document.getElementById('btnCopyTitleOnly')?.addEventListener('click', async () => {
    await copyToClipboard(cafeTitle, '카페 게시글 제목이 복사되었습니다');
  });

  // 방법 1: 사진+블록 일체형 시트를 실제 image/png로 복사 후 내 네이버 카페 게시판 열기
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
    window.open(directBoardUrl, '_blank', 'noopener');
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
      '끼니별 탄단지 블럭 텍스트가 복사되었습니다! 사진 아래에 Ctrl+V 하세요'
    );
    await apiRequest('/api/daily-status', 'POST', {
      userId: user.id,
      date: AppState.selectedDate,
      cafePosted: true
    });
    await loadState();
  });

  // 캔버스 미리보기 비동기 렌더링 (에러가 발생해도 상단 버튼 클릭에는 전혀 영향이 없도록 분리)
  try {
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
  } catch (canvasErr) {
    console.warn('미리보기 캔버스 렌더링 경고:', canvasErr);
  }
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

    <section class="card" id="naverCafeConfigCard" style="border:1.5px solid #03C75A;">
      <div class="card-header">
        <div>
          <div class="section-eyebrow" style="color:#03C75A;">NAVER LOGIN & CAFE COHORT SYNC</div>
          <div class="card-title" style="display:flex;align-items:center;gap:7px;">
            ${Icons.naver}
            <span>네이버 카페 기수(2026년 2기) · 참가자 게시판 연동 설정</span>
          </div>
          <div class="card-subtitle">
            현재 <strong>${settings.naverConfig?.cafeName || '나의 카페라떼'} (${
              settings.cafeUrl || 'https://cafe.naver.com/mycaffelatte'
            })</strong>의 기수별 멤버 게시판을 불러와 <strong>앞에서부터 4명씩 1조~5조</strong>로 자동 편성합니다.
          </div>
        </div>
        <span class="tag ${settings.naverConfig?.clubId ? 'tag-ok' : 'tag-neutral'}">
          ${settings.naverConfig?.clubId ? `clubId: ${settings.naverConfig.clubId}` : '카페 번호 미입력'}
        </span>
      </div>

      <!-- 카페 기수 & 20인 게시판 실시간 동기화 박스 -->
      <div style="background:rgba(3,199,90,0.09);border:1.5px solid rgba(3,199,90,0.35);border-radius:13px;padding:13px;margin-bottom:14px;">
        <div style="font-size:12.5px;font-weight:800;color:#03C75A;margin-bottom:6px;">
          🔄 네이버 카페 기수(예: 2026년 2기) 멤버 게시판 불러오기 (앞에서부터 4명씩 1~5조 자동 편성)
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          <input type="text" class="input-field" id="syncCafeUrlInput" value="${
            settings.cafeUrl || 'https://cafe.naver.com/mycaffelatte'
          }" placeholder="예: https://cafe.naver.com/mycaffelatte" style="flex:1;min-width:210px;background:#fff;font-weight:700;" />
          <select class="input-field" id="syncCohortSelect" style="width:140px;background:#fff;font-weight:700;">
            ${Object.keys(settings.naverConfig?.cohortGroups || { '2026년 2기': [], '2026년 1기': [] })
              .map(
                gName =>
                  `<option value="${gName}" ${
                    (settings.naverConfig?.activeCohortGroup || '2026년 2기') === gName ? 'selected' : ''
                  }>${gName} (${(settings.naverConfig?.cohortGroups?.[gName] || []).length}명)</option>`
              )
              .join('')}
          </select>
          <button type="button" class="btn btn-primary btn-sm" id="btnSyncCafeCohortLive" style="background:#03C75A;border-color:#03C75A;white-space:nowrap;">
            카페에서 기수·명단 동기화
          </button>
        </div>
        <div style="font-size:11.5px;color:var(--text-secondary);line-height:1.45;">
          * 카페 좌측 메뉴의 기수 그룹(예: <strong>2026년 2기</strong> 하위 <code>맴버1 ~ 맴버20</code>)을 읽어와 앞에서부터 4명씩 <strong>1조(1~4번), 2조(5~8번), 3조(9~12번), 4조(13~16번), 5조(17~20번)</strong>로 자동 배정하고 각 멤버의 개인 게시판 번호(<code>menuId</code>)를 연결합니다.
        </div>
      </div>

      <!-- 3분 연동 가이드 (접기/펼치기) -->
      <details style="background:var(--bg-subtle);border:1px solid var(--border-hairline);border-radius:12px;padding:11px 13px;margin-bottom:14px;font-size:12.5px;line-height:1.55;">
        <summary style="font-weight:800;cursor:pointer;color:var(--text-primary);">
          📘 내 테스트 카페(mycaffelatte) 연동 & 추후 본 카페 전환 가이드 (클릭하여 펼치기)
        </summary>
        <div style="margin-top:10px;color:var(--text-secondary);display:flex;flex-direction:column;gap:6px;">
          <div><strong>1단계 (카페 기수·명단 자동 동기화)</strong> : 위 입력창에 카페 주소(<code>https://cafe.naver.com/mycaffelatte</code>)를 넣고 <strong>[카페에서 기수·명단 동기화]</strong>를 누르면 <code>clubId(31811778)</code>와 기수별 멤버 게시판 번호가 자동으로 세팅됩니다.</div>
          <div><strong>2단계 (네이버 Developers 앱 등록)</strong> : <a href="https://developers.naver.com/apps/#/register" target="_blank" rel="noopener" style="color:#03C75A;font-weight:700;text-decoration:underline;">네이버 개발자 센터</a>에서 애플리케이션 등록 → 사용 API에 <strong>[네이버 로그인]</strong>과 <strong>[카페]</strong>(카페 글쓰기)를 체크합니다.</div>
          <div><strong>3단계 (URL 및 키 등록)</strong> : 서비스 URL에 <code>http://localhost:3000</code>, Callback URL에 <code>http://localhost:3000/api/naver/callback</code>을 입력한 뒤 발급된 <strong>Client ID</strong>와 <strong>Client Secret</strong>을 아래에 저장하세요.</div>
          <div><strong>4단계 (나중에 본 카페로 바꿀 때)</strong> : 위 카페 주소창에 실제 크로스핏 카페 주소만 넣고 <strong>[카페에서 기수·명단 동기화]</strong>를 누르면 코드 수정 없이 1초 만에 전환됩니다!</div>
        </div>
      </details>

      <!-- 스마트 카페 URL 추출기 -->
      <div style="background:rgba(3,199,90,0.05);border:1px solid rgba(3,199,90,0.22);border-radius:12px;padding:12px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:800;color:#03C75A;margin-bottom:6px;">
          🔍 개별 게시판 주소(URL)에서 clubId · menuId 번호 추출기
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
          <input type="text" class="input-field" id="cafeUrlExtractInput" placeholder="예: https://cafe.naver.com/f-e/cafes/31811778/menus/7" style="flex:1;min-width:210px;background:#fff;" />
          <select class="input-field" id="cafeExtractTargetSelect" style="width:130px;background:#fff;">
            <option value="default">공통 게시판에 적용</option>
            <option value="1">1조 대표 게시판</option>
            <option value="2">2조 대표 게시판</option>
            <option value="3">3조 대표 게시판</option>
            <option value="4">4조 대표 게시판</option>
            <option value="5">5조 대표 게시판</option>
          </select>
          <button type="button" class="btn btn-primary btn-sm" id="btnExtractCafeIds" style="background:#03C75A;border-color:#03C75A;white-space:nowrap;">
            번호 자동 추출
          </button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">연동 카페 이름 (표시용)</label>
            <input type="text" class="input-field" id="cfgNaverCafeName" placeholder="예: 나의 카페라떼" value="${
              settings.naverConfig?.cafeName || ''
            }" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">네이버 카페 고유 번호 (clubId)</label>
            <input type="text" class="input-field" id="cfgNaverClubId" placeholder="숫자 ID (예: 31811778)" value="${
              settings.naverConfig?.clubId || ''
            }" />
          </div>
        </div>

        <div>
          <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">
            공통(기본) 게시판 번호 (defaultMenuId) <small style="font-weight:500;">— 개인/조별 게시판 번호가 비어있을 때 사용됩니다</small>
          </label>
          <input type="text" class="input-field" id="cfgNaverDefaultMenuId" placeholder="예: 7" value="${
            settings.naverConfig?.defaultMenuId || ''
          }" />
        </div>

        <div>
          <label style="font-size:12px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:6px;">
            조별(1조~5조) 대표 게시판 번호 (menuId) <small style="font-weight:500;">— 각 참가자의 개인 게시판 번호는 아래 참가자 명단 표에서 개별 관리됩니다</small>
          </label>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;">
            ${[1, 2, 3, 4, 5]
              .map(
                t => `
              <div>
                <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:3px;text-align:center;">${t}조 menuId</div>
                <input type="text" class="input-field" id="cfgNaverMenuTeam${t}" placeholder="기본값 사용" value="${
                  settings.naverConfig?.teamMenuIds?.[String(t)] || ''
                }" style="text-align:center;padding:8px 6px;font-size:12.5px;" />
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div style="border-top:1px solid var(--border-hairline);padding-top:10px;margin-top:2px;">
          <div style="font-size:12px;font-weight:800;color:var(--text-secondary);margin-bottom:8px;">
            네이버 Developers OAuth 2.0 인증키 (실제 네이버 로그인 및 API 전송 시 사용)
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div>
              <label style="font-size:11.5px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">Client ID</label>
              <input type="text" class="input-field" id="cfgNaverClientId" placeholder="네이버 Developers Client ID" value="${
                settings.naverConfig?.clientId || ''
              }" />
            </div>
            <div>
              <label style="font-size:11.5px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">Client Secret</label>
              <input type="password" class="input-field" id="cfgNaverClientSecret" placeholder="네이버 Developers Client Secret" value="${
                settings.naverConfig?.clientSecret || ''
              }" />
            </div>
          </div>
          <div>
            <label style="font-size:11.5px;color:var(--text-tertiary);font-weight:700;display:block;margin-bottom:4px;">Callback URL (네이버 개발자 센터에 동일하게 등록)</label>
            <div style="display:flex;gap:6px;">
              <input type="text" class="input-field" id="cfgNaverCallbackUrl" value="${
                settings.naverConfig?.callbackUrl || `${window.location.origin}/api/naver/callback`
              }" />
              <button type="button" class="btn btn-secondary btn-sm" id="btnCopyCallbackUrl" style="white-space:nowrap;">복사</button>
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-primary btn-block" id="btnSaveNaverConfig" style="background:#03C75A;border-color:#03C75A;margin-top:4px;">
          네이버 로그인 & 카페 연동 설정 저장
        </button>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">CHALLENGE CONFIG</div>
          <div class="card-title">주간 미션 및 기본 카페 주소 설정</div>
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
          <div class="section-eyebrow">PARTICIPANTS · ${settings.naverConfig?.activeCohortGroup || '2026년 2기'}</div>
          <div class="card-title">참가자 명단 · 카페 개인게시판(menuId) · 목표 블록 (${AppState.db.participants.length}명)</div>
          <div class="card-subtitle">카페 메뉴 순서대로 앞에서부터 4명씩 1조, 2조, 3조, 4조, 5조로 편성되어 있습니다</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnAddParticipant">+ 인원 추가</button>
      </div>

      <div style="overflow-x:auto;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>조</th>
              <th>이름 (카페 게시판명)</th>
              <th>카페 menuId</th>
              <th>역할</th>
              <th>목표블록</th>
              <th>네이버연동</th>
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
                <td style="width:78px;"><input type="text" class="p-cafemenu" value="${
                  p.cafeMenuId || ''
                }" placeholder="menuId" style="text-align:center;font-weight:700;" /></td>
                <td style="width:82px;">
                  <select class="p-role">
                    <option value="식단담당" ${p.role === '식단담당' || p.role === '조장' ? 'selected' : ''}>식단담당</option>
                    <option value="조원" ${p.role !== '식단담당' && p.role !== '조장' ? 'selected' : ''}>조원</option>
                  </select>
                </td>
                <td style="width:68px;"><input type="number" class="p-blocks" value="${p.targetBlocks}" min="5" max="25" step="1" /></td>
                <td style="width:105px;font-size:11.5px;">
                  ${
                    p.naverId
                      ? `<span style="color:#03C75A;font-weight:800;">● ${p.naverNickname || '연동됨'}</span>`
                      : `<span style="color:var(--text-tertiary);">미연동</span>`
                  }
                </td>
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

    <section class="card" id="supabaseConfigCard" style="border:1.5px solid #3ECF8E;">
      <div class="card-header">
        <div>
          <div class="section-eyebrow" style="color:#10B981;">SUPABASE CLOUD POSTGRESQL & STORAGE</div>
          <div class="card-title" style="display:flex;align-items:center;gap:8px;">
            <span>⚡ Supabase 클라우드 DB & 식단 사진 스토리지 연동</span>
          </div>
          <div class="card-subtitle">
            정규화된 <strong>7개 PostgreSQL 테이블</strong>(<code>app_settings</code>, <code>participants</code>, <code>daily_logs</code>, <code>meals</code>, <code>team_reports</code>, <code>mission_logs</code>, <code>penalties</code>) 및 <strong><code>meal-photos</code> 스토리지 버킷</strong>에 데이터를 영구 저장합니다.
          </div>
        </div>
        <span class="tag ${AppState.db.serverInfo?.supabase?.connected ? 'tag-ok' : 'tag-warn'}">
          ${
            AppState.db.serverInfo?.supabase?.connected
              ? '● Supabase 연결됨'
              : AppState.db.serverInfo?.supabase?.configured
              ? '연결 대기/확인 필요'
              : '로컬 파일 모드'
          }
        </span>
      </div>

      ${
        AppState.db.serverInfo?.supabase?.tableCounts
          ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
              <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.28);padding:10px;border-radius:12px;text-align:center;">
                <div style="font-size:11px;color:var(--text-tertiary);font-weight:700;">participants</div>
                <div style="font-size:18px;font-weight:800;color:var(--emerald-text);">${AppState.db.serverInfo.supabase.tableCounts.participants ?? 0}명</div>
              </div>
              <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.28);padding:10px;border-radius:12px;text-align:center;">
                <div style="font-size:11px;color:var(--text-tertiary);font-weight:700;">daily_logs</div>
                <div style="font-size:18px;font-weight:800;color:var(--emerald-text);">${AppState.db.serverInfo.supabase.tableCounts.daily_logs ?? 0}건</div>
              </div>
              <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.28);padding:10px;border-radius:12px;text-align:center;">
                <div style="font-size:11px;color:var(--text-tertiary);font-weight:700;">meals (식단·블럭)</div>
                <div style="font-size:18px;font-weight:800;color:var(--emerald-text);">${AppState.db.serverInfo.supabase.tableCounts.meals ?? 0}끼니</div>
              </div>
            </div>`
          : ''
      }

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:4px;">
            PostgreSQL Connection URI (<code>DATABASE_URL</code> 또는 <code>POSTGRES_URL</code>)
          </label>
          <input type="password" class="input-field" id="cfgSupabaseDbUrl" placeholder="postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:4px;">
              Supabase Project URL (<code>SUPABASE_URL</code>)
            </label>
            <input type="text" class="input-field" id="cfgSupabaseUrl" placeholder="https://xxxx.supabase.co" value="${AppState.db.serverInfo?.supabase?.supabaseUrl || ''}" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:4px;">
              Service Role / Anon Key (<code>SUPABASE_SERVICE_ROLE_KEY</code>)
            </label>
            <input type="password" class="input-field" id="cfgSupabaseKey" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." />
          </div>
        </div>
      </div>

      ${
        AppState.db.serverInfo?.supabase?.lastError
          ? `<div style="font-size:12px;color:var(--danger);background:var(--danger-soft);padding:10px 12px;border-radius:10px;margin-bottom:10px;">
              ⚠️ 최근 DB 메시지: ${AppState.db.serverInfo.supabase.lastError}
            </div>`
          : ''
      }

      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        <button type="button" class="btn btn-primary" id="btnConnectAndInitSupabase" style="background:#10B981;color:#FFFFFF;border:none;flex:1;">
          ⚡ 7개 테이블 자동 생성 & 현재 데이터 즉시 동기화
        </button>
        <button type="button" class="btn btn-secondary" id="btnCopySupabaseSchemaSql">
          ${Icons.copy}
          <span>SQL 스키마(DDL) 복사</span>
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

  document.getElementById('btnCopyCallbackUrl')?.addEventListener('click', async () => {
    const val = document.getElementById('cfgNaverCallbackUrl')?.value.trim();
    if (val) {
      await copyToClipboard(val, 'Callback URL이 복사되었습니다');
    }
  });

  document.getElementById('btnSyncCafeCohortLive')?.addEventListener('click', async () => {
    const cafeUrl = document.getElementById('syncCafeUrlInput')?.value.trim() || 'https://cafe.naver.com/mycaffelatte';
    const selectGroupName = document.getElementById('syncCohortSelect')?.value || '2026년 2기';
    const btn = document.getElementById('btnSyncCafeCohortLive');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '동기화 중...';
    }
    try {
      const res = await apiRequest('/api/naver/sync-cafe-structure', 'POST', {
        cafeUrl,
        selectGroupName,
        fetchLive: true
      });
      showToast(
        `[${res.activeCohortGroup}] 참가자 ${res.memberCount}명을 앞에서부터 4명씩 1~5조로 편성 및 게시판 연동 완료!`
      );
      await loadState();
    } catch (err) {
      showToast(err.message || '카페 구조 동기화 실패');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '카페에서 기수·명단 동기화';
      }
    }
  });

  document.getElementById('syncCohortSelect')?.addEventListener('change', async e => {
    const selectGroupName = e.target.value;
    const cafeUrl = document.getElementById('syncCafeUrlInput')?.value.trim() || 'https://cafe.naver.com/mycaffelatte';
    try {
      const res = await apiRequest('/api/naver/sync-cafe-structure', 'POST', {
        cafeUrl,
        selectGroupName,
        fetchLive: false
      });
      showToast(`[${res.activeCohortGroup}] 명단(${res.memberCount}명 · 1~5조)으로 전환되었습니다!`);
      await loadState();
    } catch (err) {
      showToast(err.message || '기수 전환 실패');
    }
  });

  document.getElementById('btnExtractCafeIds')?.addEventListener('click', async () => {
    const rawUrl = document.getElementById('cafeUrlExtractInput')?.value.trim();
    const target = document.getElementById('cafeExtractTargetSelect')?.value || 'default';
    if (!rawUrl) {
      showToast('추출할 네이버 카페 주소(URL)를 먼저 붙여넣어 주세요');
      return;
    }
    try {
      const res = await apiRequest('/api/naver/parse-cafe-url', 'POST', { url: rawUrl });
      if (res.clubId) {
        const clubEl = document.getElementById('cfgNaverClubId');
        if (clubEl) clubEl.value = res.clubId;
      }
      if (res.menuId) {
        if (target === 'default') {
          const defEl = document.getElementById('cfgNaverDefaultMenuId');
          if (defEl) defEl.value = res.menuId;
        } else {
          const teamEl = document.getElementById(`cfgNaverMenuTeam${target}`);
          if (teamEl) teamEl.value = res.menuId;
        }
      }
      if (res.clubId || res.menuId) {
        showToast(
          `추출 완료! clubId: ${res.clubId || '미감지'}, menuId: ${
            res.menuId || '미감지 (게시판 클릭 후 URL 복사 필요)'
          }`
        );
      } else {
        showToast('URL에서 숫자를 찾지 못했습니다. 카페 안의 게시판을 클릭한 뒤 주소창 URL을 복사해 주세요.');
      }
    } catch (err) {
      showToast(err.message || '주소 분석 실패');
    }
  });

  document.getElementById('btnSaveNaverConfig')?.addEventListener('click', async () => {
    const cafeName = document.getElementById('cfgNaverCafeName')?.value.trim();
    const clubId = document.getElementById('cfgNaverClubId')?.value.trim();
    const defaultMenuId = document.getElementById('cfgNaverDefaultMenuId')?.value.trim();
    const clientId = document.getElementById('cfgNaverClientId')?.value.trim();
    const clientSecret = document.getElementById('cfgNaverClientSecret')?.value.trim();
    const callbackUrl = document.getElementById('cfgNaverCallbackUrl')?.value.trim();
    const teamMenuIds = {};
    [1, 2, 3, 4, 5].forEach(t => {
      teamMenuIds[String(t)] = document.getElementById(`cfgNaverMenuTeam${t}`)?.value.trim() || '';
    });

    await apiRequest('/api/admin/update', 'POST', {
      settings: {
        naverConfig: {
          cafeName: cafeName || '나의 카페라떼',
          clubId,
          defaultMenuId,
          teamMenuIds,
          clientId,
          clientSecret,
          callbackUrl
        }
      }
    });
    showToast('네이버 로그인 및 카페 게시판 연동 설정이 저장되었습니다!');
    await loadState();
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
    const team = Math.min(5, Math.floor((nextNum - 1) / 4) + 1);
    list.push({
      id: `u_${Date.now()}`,
      name: `맴버${nextNum}`,
      team,
      role: (nextNum - 1) % 4 === 0 ? '식단담당' : '조원',
      targetBlocks: 11,
      pin: '1234',
      cafeMenuId: ''
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
      const cafeMenuId = tr.querySelector('.p-cafemenu')?.value.trim() || '';
      const role = tr.querySelector('.p-role')?.value || '조원';
      const targetBlocks = Number(tr.querySelector('.p-blocks')?.value || 11);
      const pin = tr.querySelector('.p-pin')?.value.trim() || '1234';
      updated.push({ id, name, cafeMenuId, team, role, targetBlocks, pin });
    });
    await apiRequest('/api/admin/update', 'POST', { participants: updated });
    showToast('참가자 명단 및 개인 카페 게시판 번호가 저장되었습니다');
    await loadState();
  });

  document.getElementById('btnConnectAndInitSupabase')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnConnectAndInitSupabase');
    const databaseUrl = document.getElementById('cfgSupabaseDbUrl')?.value.trim();
    const supabaseUrl = document.getElementById('cfgSupabaseUrl')?.value.trim();
    const supabaseKey = document.getElementById('cfgSupabaseKey')?.value.trim();

    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Supabase 7개 테이블 생성 및 데이터 동기화 중...';
    }
    try {
      const payload = {};
      if (databaseUrl) payload.databaseUrl = databaseUrl;
      if (supabaseUrl) payload.supabaseUrl = supabaseUrl;
      if (supabaseKey) payload.supabaseKey = supabaseKey;

      const res = await apiRequest('/api/supabase/config', 'POST', payload);
      if (res.status?.connected) {
        showToast('✅ Supabase PostgreSQL 7개 테이블 생성 및 데이터 연동이 완료되었습니다!');
      } else {
        showToast(res.status?.lastError || 'Supabase 연결 정보를 확인해 주세요');
      }
      await loadState();
    } catch (err) {
      showToast(err.message || 'Supabase 연동 중 오류가 발생했습니다');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ 7개 테이블 자동 생성 & 현재 데이터 즉시 동기화';
      }
    }
  });

  document.getElementById('btnCopySupabaseSchemaSql')?.addEventListener('click', async () => {
    try {
      const res = await apiRequest('/api/supabase/status', 'GET');
      if (res.schemaSql) {
        await copyToClipboard(
          res.schemaSql,
          'Supabase 7개 테이블 + Storage 버킷 SQL 스키마가 복사되었습니다! (Supabase SQL Editor에 붙여넣기 가능)'
        );
      }
    } catch (err) {
      showToast('SQL 스키마 복사에 실패했습니다');
    }
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
// 네이버 로그인 후 카페(https://cafe.naver.com/mycaffelatte)에서 자기 이름 선택 & 연동 모달
// ============================================================================
function openUserSwitchModal(preselectUserId = null) {
  const modal = document.getElementById('userModal');
  const content = document.getElementById('userModalContent');
  if (!modal || !content || !AppState.db) return;

  let chosenId = preselectUserId || AppState.currentUserId;

  function renderModalInner() {
    const chosenUser = AppState.db.participants.find(p => p.id === chosenId) || AppState.db.participants[0];
    const naverCfg = AppState.db.settings?.naverConfig || {};
    const hasOAuthKeys = Boolean(naverCfg.clientId && naverCfg.clientSecret);
    const activeCohort = naverCfg.activeCohortGroup || '2026년 2기';
    const cohortOptions = Object.keys(naverCfg.cohortGroups || { '2026년 2기': [], '2026년 1기': [] });
    const teamRangeLabels = {
      1: '앞 1~4번째 멤버',
      2: '5~8번째 멤버',
      3: '9~12번째 멤버',
      4: '13~16번째 멤버',
      5: '17~20번째 멤버'
    };

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div class="section-eyebrow" style="color:#03C75A;">NAVER LOGIN & CAFE MEMBER LINK</div>
          <h3 style="font-size:17.5px;font-weight:800;">네이버 로그인 후 카페에 연동하기</h3>
          <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">
            <strong>${naverCfg.cafeName || '나의 카페라떼'} (mycaffelatte)</strong>의 <strong>${activeCohort}</strong> 명단에서 내 이름을 선택해 연동하세요
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnCloseUserModal">닫기</button>
      </div>

      <!-- 카페 기수(2026년 2기 / 2026년 1기) 선택 및 카페 실시간 명단 동기화 바 -->
      <div style="background:var(--bg-subtle);border:1px solid var(--border-hairline);border-radius:12px;padding:9px 11px;margin-bottom:11px;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;">
          <span style="color:#03C75A;font-weight:800;">카페 기수 :</span>
          <select id="modalCohortSelect" class="input-field" style="padding:4px 8px;font-size:12px;font-weight:800;width:auto;height:30px;">
            ${cohortOptions
              .map(
                g =>
                  `<option value="${g}" ${g === activeCohort ? 'selected' : ''}>${g} (${
                    (naverCfg.cohortGroups?.[g] || []).length
                  }명)</option>`
              )
              .join('')}
          </select>
        </div>
        <button type="button" class="btn btn-outline btn-sm" id="btnModalRefreshCafe" style="padding:4px 9px;font-size:11px;">
          🔄 카페에서 최신 명단 새로고침
        </button>
      </div>

      <!-- STEP 1: 카페(2026년 2기)에서 내 이름 선택 (앞에서부터 4명씩 1~5조) -->
      <div style="font-size:12px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;">
        STEP 1. 카페 [${activeCohort}]에서 내 이름 선택 (앞에서부터 4명씩 1조~5조)
      </div>
      <div style="max-height:235px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:12px;padding-right:2px;border:1px solid var(--border-hairline);border-radius:12px;padding:10px;">
        ${[1, 2, 3, 4, 5]
          .map(teamNum => {
            const members = AppState.db.participants.filter(p => Number(p.team) === teamNum);
            if (members.length === 0) return '';
            return `
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                  <span style="font-size:11.5px;font-weight:800;color:var(--text-primary);">${teamNum}조 <small style="color:var(--text-tertiary);font-weight:600;">(${teamRangeLabels[teamNum]})</small></span>
                  <span style="font-size:10.5px;color:var(--text-tertiary);">${members.length}명</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
                  ${members
                    .map(
                      m => `
                    <button type="button" class="btn ${
                      m.id === chosenId ? 'btn-primary' : 'btn-outline'
                    } btn-sm" data-pick-uid="${m.id}" style="justify-content:space-between;padding:8px 10px;">
                      <span style="display:inline-flex;align-items:center;gap:5px;font-weight:800;">
                        ${m.hasNaverToken ? Icons.naver : ''}
                        <span>${m.name}</span>
                      </span>
                      <small style="opacity:0.78;font-size:10.5px;">게시판 #${m.cafeMenuId || '-'} · ${m.targetBlocks}B</small>
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

      <!-- STEP 2: 선택한 내 이름에 네이버 로그인 & 카페 연동하기 -->
      <div style="background:rgba(3,199,90,0.09);border:1.5px solid rgba(3,199,90,0.4);border-radius:14px;padding:12px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:12.5px;font-weight:800;color:#03C75A;display:flex;align-items:center;gap:6px;">
            ${Icons.naver}
            <span>STEP 2. 선택한 [${chosenUser.team}조 ${chosenUser.name}]에 네이버 로그인 연동</span>
          </div>
          ${
            chosenUser.hasNaverToken
              ? `<span style="font-size:11px;font-weight:800;color:#03C75A;">● 실제 네이버 연동됨 (${chosenUser.naverNickname || chosenUser.name})</span>`
              : `<span style="font-size:11px;color:var(--text-tertiary);">미연동 (로그인 필요)</span>`
          }
        </div>

        <div style="font-size:11.5px;color:var(--text-secondary);margin-bottom:8px;">
          연동 대상 카페 게시판: <strong>${naverCfg.cafeName || '나의 카페라떼'} &gt; ${activeCohort} &gt; [${chosenUser.team}조] ${
            chosenUser.name
          } 게시판 (menuId: #${chosenUser.cafeMenuId || '-'})</strong>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
          <button type="button" class="btn btn-block" id="btnBrowserNaverLogin" style="background:#03C75A;color:#FFFFFF;font-weight:800;padding:13px;font-size:13.5px;">
            ${Icons.naver}
            <span>네이버 로그인 후 카페 [${chosenUser.team}조 ${chosenUser.name}]에 즉시 연동하기</span>
          </button>
          <div style="font-size:11px;color:#9CA3AF;line-height:1.4;text-align:center;">
            * 버튼을 누르면 PC 화면 맨 앞에 네이버 로그인 창이 뜹니다. ID/PW 입력 또는 <strong>[QR코드 로그인]</strong>을 완료하시면 자동으로 창이 닫히며 연동됩니다.
          </div>

          <div style="display:flex;gap:6px;margin-top:2px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btnToggleManualLink" style="flex:1;font-size:11.5px;">
              네이버 별명 직접 입력(수동 연동)
            </button>
            ${
              hasOAuthKeys
                ? `<button type="button" class="btn btn-secondary btn-sm" id="btnStartNaverOAuth" style="flex:1;font-size:11.5px;">
                    네이버 Developers OAuth로 연동
                  </button>`
                : ''
            }
            ${
              chosenUser.naverId
                ? `<button type="button" class="btn btn-danger btn-sm" id="btnUnlinkNaver" style="font-size:11.5px;">연동 해제</button>`
                : ''
            }
          </div>

          <!-- 수동 연동 폼 (펼치기) -->
          <div id="manualLinkForm" style="display:none;background:var(--bg-surface);padding:10px;border-radius:10px;border:1px dashed rgba(255,255,255,0.15);margin-top:4px;">
            <div style="font-size:11.5px;color:#9CA3AF;margin-bottom:6px;">카페에서 활동 중인 본인의 네이버 별명(또는 아이디)을 입력하세요:</div>
            <div style="display:flex;gap:6px;">
              <input type="text" class="input-field" id="manualNaverNickInput" placeholder="네이버 별명 입력" value="${chosenUser.naverNickname || chosenUser.name}" style="font-size:12px;padding:6px 10px;" />
              <button type="button" class="btn btn-primary btn-sm" id="btnSubmitManualLink" style="white-space:nowrap;font-size:12px;">
                연동 완료
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style="background:var(--bg-subtle);padding:10px 12px;border-radius:12px;border:1px solid var(--border-hairline);display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);">
          <strong>${chosenUser.team}조 ${chosenUser.name}</strong> 화면으로 바로 보기
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="password" class="input-field" id="pinVerifyInput" maxlength="4" value="${
            chosenUser.pin || '1234'
          }" placeholder="PIN" style="width:74px;padding:6px 8px;letter-spacing:3px;text-align:center;font-weight:800;background:var(--bg-surface);" />
          <button type="button" class="btn btn-primary btn-sm" id="btnConfirmUserSwitch" style="white-space:nowrap;">
            전환
          </button>
        </div>
      </div>
    `;

    content.querySelector('#btnCloseUserModal')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    content.querySelector('#modalCohortSelect')?.addEventListener('change', async e => {
      const selectGroupName = e.target.value;
      try {
        await apiRequest('/api/naver/sync-cafe-structure', 'POST', {
          cafeUrl: AppState.db.settings?.cafeUrl || 'https://cafe.naver.com/mycaffelatte',
          selectGroupName,
          fetchLive: false
        });
        await loadState();
        chosenId = AppState.db.participants[0]?.id || 'u1';
        renderModalInner();
        showToast(`카페 [${selectGroupName}] 명단(앞에서부터 4명씩 1~5조)으로 전환되었습니다`);
      } catch (err) {
        showToast(err.message || '기수 전환 실패');
      }
    });

    content.querySelector('#btnModalRefreshCafe')?.addEventListener('click', async () => {
      const btn = content.querySelector('#btnModalRefreshCafe');
      if (btn) btn.textContent = '불러오는 중...';
      try {
        const res = await apiRequest('/api/naver/sync-cafe-structure', 'POST', {
          cafeUrl: AppState.db.settings?.cafeUrl || 'https://cafe.naver.com/mycaffelatte',
          selectGroupName: content.querySelector('#modalCohortSelect')?.value || activeCohort,
          fetchLive: true
        });
        await loadState();
        renderModalInner();
        showToast(`카페에서 [${res.activeCohortGroup}] 최신 명단(${res.memberCount}명)을 동기화했습니다!`);
      } catch (err) {
        showToast(err.message || '동기화 실패');
      }
    });

    content.querySelectorAll('[data-pick-uid]').forEach(btn => {
      btn.addEventListener('click', () => {
        chosenId = btn.dataset.pickUid;
        renderModalInner();
      });
    });

    content.querySelector('#btnStartNaverOAuth')?.addEventListener('click', () => {
      window.location.href = `/api/naver/login?linkUserId=${encodeURIComponent(chosenUser.id)}`;
    });

    content.querySelector('#btnToggleManualLink')?.addEventListener('click', () => {
      const f = content.querySelector('#manualLinkForm');
      if (f) {
        f.style.display = f.style.display === 'none' ? 'block' : 'none';
      }
    });

    content.querySelector('#btnSubmitManualLink')?.addEventListener('click', async () => {
      const nick = content.querySelector('#manualNaverNickInput')?.value.trim();
      if (!nick) {
        showToast('네이버 별명을 입력해 주세요');
        return;
      }
      try {
        await apiRequest('/api/naver/link-user', 'POST', {
          action: 'manual_link',
          userId: chosenUser.id,
          naverNickname: nick
        });
        AppState.currentUserId = chosenUser.id;
        AppState.selectedTeamNum = Number(chosenUser.team);
        localStorage.setItem('leben_user_id', chosenUser.id);
        modal.style.display = 'none';
        showToast(
          `연동 완료! [${activeCohort} · ${chosenUser.team}조 ${chosenUser.name}] 님에게 네이버 별명 '${nick}' (게시판 #${chosenUser.cafeMenuId})이 연동되었습니다!`
        );
        await loadState();
      } catch (err) {
        showToast(err.message || '수동 연동 중 오류가 발생했습니다');
      }
    });

    content.querySelector('#btnBrowserNaverLogin')?.addEventListener('click', async () => {
      const btn = content.querySelector('#btnBrowserNaverLogin');
      const prevHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'PC 화면 앞의 네이버 로그인 창에서 로그인해 주세요...';
      }
      showToast('화면 앞쪽으로 네이버 로그인 창이 열렸습니다. 로그인(또는 QR코드 로그인)을 진행해 주세요.');
      try {
        const res = await apiRequest('/api/naver/browser-login', 'POST', {
          userId: chosenUser.id,
          forceLoginWindow: false
        });
        AppState.currentUserId = chosenUser.id;
        AppState.selectedTeamNum = Number(chosenUser.team);
        localStorage.setItem('leben_user_id', chosenUser.id);
        modal.style.display = 'none';
        showToast(
          `네이버 로그인 완료! [${activeCohort} · ${chosenUser.team}조 ${chosenUser.name} (게시판 #${chosenUser.cafeMenuId})]에 연동되었습니다!`
        );
        await loadState();
      } catch (err) {
        showToast(err.message || '네이버 로그인 중 오류가 발생했습니다');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = prevHtml;
        }
      }
    });

    content.querySelector('#btnUnlinkNaver')?.addEventListener('click', async () => {
      await apiRequest('/api/naver/link-user', 'POST', {
        action: 'unlink',
        userId: chosenUser.id
      });
      showToast(`${chosenUser.name}님의 네이버 카페 계정 연동이 해제되었습니다`);
      await loadState();
      renderModalInner();
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

// 최초 네이버 OAuth 로그인 후 카페(2026년 2기) 본인 참가자 이름(1~5조)을 선택하여 매핑하는 모달
function openPendingNaverLinkModal(pendingNaverId, naverName) {
  const modal = document.getElementById('userModal');
  const content = document.getElementById('userModalContent');
  if (!modal || !content || !AppState.db) return;

  let chosenId = AppState.currentUserId;

  function renderPendingInner() {
    const chosenUser = AppState.db.participants.find(p => p.id === chosenId) || AppState.db.participants[0];
    const naverCfg = AppState.db.settings?.naverConfig || {};
    const activeCohort = naverCfg.activeCohortGroup || '2026년 2기';
    content.innerHTML = `
      <div style="margin-bottom:12px;">
        <div class="section-eyebrow" style="color:#03C75A;">NAVER LOGIN COMPLETED · ${activeCohort}</div>
        <h3 style="font-size:18px;font-weight:800;">카페(${naverCfg.cafeName || '나의 카페라떼'})에서 내 이름 선택</h3>
        <div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px;">
          네이버 계정(<strong>${naverName}</strong>)으로 로그인되었습니다. <strong>${activeCohort}</strong> 명단(앞에서부터 4명씩 1~5조)에서 본인 이름을 선택해 연동하세요.
        </div>
      </div>

      <div style="max-height:250px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
        ${[1, 2, 3, 4, 5]
          .map(teamNum => {
            const members = AppState.db.participants.filter(p => Number(p.team) === teamNum);
            return `
              <div>
                <div style="font-size:11.5px;font-weight:800;color:var(--text-tertiary);margin-bottom:5px;">${teamNum}조</div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
                  ${members
                    .map(
                      m => `
                    <button type="button" class="btn ${
                      m.id === chosenId ? 'btn-primary' : 'btn-outline'
                    } btn-sm" data-pick-pending-uid="${m.id}" style="justify-content:space-between;padding:8px 11px;">
                      <span>${m.name}</span>
                      <small style="opacity:0.75;">게시판 #${m.cafeMenuId || '-'} · ${m.targetBlocks}B</small>
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

      <button type="button" class="btn btn-block" id="btnCompleteNaverLink" style="background:#03C75A;color:#FFFFFF;font-weight:800;padding:13px;">
        ${Icons.naver}
        <span>[${activeCohort} · ${chosenUser.team}조 ${chosenUser.name} (게시판 #${chosenUser.cafeMenuId})]으로 카페 연동 완료</span>
      </button>
    `;

    content.querySelectorAll('[data-pick-pending-uid]').forEach(btn => {
      btn.addEventListener('click', () => {
        chosenId = btn.dataset.pickPendingUid;
        renderPendingInner();
      });
    });

    content.querySelector('#btnCompleteNaverLink')?.addEventListener('click', async () => {
      try {
        const res = await apiRequest('/api/naver/link-user', 'POST', {
          userId: chosenUser.id,
          pendingNaverId
        });
        AppState.currentUserId = res.userId || chosenUser.id;
        AppState.selectedTeamNum = Number(chosenUser.team);
        localStorage.setItem('leben_user_id', AppState.currentUserId);
        modal.style.display = 'none';
        showToast(`네이버 계정이 [${activeCohort} · ${chosenUser.team}조 ${chosenUser.name}] 카페 게시판(#${chosenUser.cafeMenuId})과 연동되었습니다!`);
        await loadState();
      } catch (err) {
        showToast(err.message || '연동 실패');
      }
    });
  }

  renderPendingInner();
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

  // 네이버 OAuth 리다이렉트 쿼리 파라미터 처리
  const params = new URLSearchParams(window.location.search);
  const naverLogin = params.get('naver_login');
  const loginUserId = params.get('userId');
  const pendingNaverId = params.get('naver_link_pending');
  const naverName = params.get('naver_name') || '네이버회원';
  const naverError = params.get('naver_error');

  if (naverLogin === 'success' && loginUserId) {
    AppState.currentUserId = loginUserId;
    localStorage.setItem('leben_user_id', loginUserId);
    const u = getCurrentUser();
    if (u) {
      AppState.selectedTeamNum = Number(u.team);
      showToast(`네이버 로그인 완료! ${u.team}조 ${u.name}님으로 자동 연동되었습니다.`);
    }
    window.history.replaceState({}, '', '/');
    renderHeader();
    renderMain();
  } else if (pendingNaverId) {
    window.history.replaceState({}, '', '/');
    openPendingNaverLinkModal(pendingNaverId, naverName);
  } else if (naverError) {
    window.history.replaceState({}, '', '/');
    showToast(`네이버 로그인 안내: ${naverError}`);
  }
});
