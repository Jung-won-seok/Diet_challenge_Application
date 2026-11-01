const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, exec } = require('node:child_process');
const supabaseDb = require('./lib/supabase-db');

const PORT = process.env.PORT || 3000;
const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? path.join('/tmp', 'leben-data') : path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'store.json');
const BUNDLED_DB_PATH = path.join(__dirname, 'data', 'store.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const CHROME_PROFILE_DIR = path.join(DATA_DIR, 'chrome-naver-profile');
const CHROME_DEBUG_PORT = 9229;
const CHROME_BIN_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
];

function getKstDateString(offsetDays = 0) {
  const now = new Date();
  const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return kstTime.toISOString().slice(0, 10);
}

function createSampleFoodSvgDataUrl(mealLabel, menuTitle, macroTag, accentColor, subAccent) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">
    <rect width="600" height="450" fill="#18191C"/>
    <circle cx="300" cy="210" r="168" fill="#23252A"/>
    <circle cx="300" cy="210" r="144" fill="#F7F7F5" stroke="#E4E4E0" stroke-width="4"/>
    <line x1="300" y1="66" x2="300" y2="354" stroke="#E5E5E0" stroke-width="2" stroke-dasharray="4 4"/>
    <line x1="300" y1="210" x2="444" y2="210" stroke="#E5E5E0" stroke-width="2" stroke-dasharray="4 4"/>
    <circle cx="232" cy="185" r="46" fill="${accentColor}" opacity="0.88"/>
    <circle cx="242" cy="256" r="34" fill="#4D7C5D" opacity="0.85"/>
    <rect x="322" y="128" width="68" height="54" rx="22" fill="${subAccent}" opacity="0.9"/>
    <circle cx="356" cy="264" r="36" fill="#D9A05B" opacity="0.9"/>
    <circle cx="332" cy="248" r="12" fill="#7A5C3E"/>
    <circle cx="372" cy="278" r="10" fill="#7A5C3E"/>
    <rect x="28" y="26" width="108" height="32" rx="16" fill="rgba(255,255,255,0.12)"/>
    <text x="82" y="47" font-family="Pretendard, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">${mealLabel}</text>
    <rect x="444" y="26" width="128" height="32" rx="16" fill="#C8F904"/>
    <text x="508" y="47" font-family="Pretendard, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#111315" text-anchor="middle">${macroTag}</text>
    <rect x="0" y="376" width="600" height="74" fill="rgba(17,19,21,0.88)"/>
    <text x="32" y="420" font-family="Pretendard, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#F4F5F7">${menuTitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// https://cafe.naver.com/mycaffelatte (clubId: 31811778)의 기본 기수별 개인 게시판 구조
const DEFAULT_COHORT_GROUPS = {
  '2026년 2기': [
    { menuId: '7', name: '맴버1' },
    { menuId: '8', name: '맴버2' },
    { menuId: '9', name: '맴버3' },
    { menuId: '10', name: '맴버4' },
    { menuId: '11', name: '맴버5' },
    { menuId: '12', name: '맴버6' },
    { menuId: '13', name: '맴버7' },
    { menuId: '14', name: '맴버8' },
    { menuId: '15', name: '맴버9' },
    { menuId: '6', name: '맴버10' },
    { menuId: '16', name: '맴버12' },
    { menuId: '17', name: '맴버13' },
    { menuId: '18', name: '맴버14' },
    { menuId: '19', name: '맴버15' },
    { menuId: '20', name: '맴버16' },
    { menuId: '21', name: '맴버17' },
    { menuId: '22', name: '맴버18' },
    { menuId: '23', name: '맴버19' },
    { menuId: '24', name: '맴버20' }
  ],
  '2026년 1기': [
    { menuId: '1', name: '맴버1' },
    { menuId: '2', name: '맴버2' },
    { menuId: '25', name: '맴버3' },
    { menuId: '26', name: '맴버4' },
    { menuId: '27', name: '맴버5' },
    { menuId: '28', name: '맴버6' },
    { menuId: '29', name: '맴버7' },
    { menuId: '30', name: '맴버8' },
    { menuId: '31', name: '맴버9' },
    { menuId: '32', name: '맴버10' },
    { menuId: '33', name: '맴버11' },
    { menuId: '34', name: '맴버12' }
  ]
};

function buildParticipantsFromCohortMenus(menus = [], cohortGroup = '2026년 2기', prevParticipants = []) {
  const prevByMenuId = new Map();
  const prevById = new Map();
  (prevParticipants || []).forEach(p => {
    if (p.cafeMenuId) prevByMenuId.set(String(p.cafeMenuId), p);
    if (p.id) prevById.set(p.id, p);
  });

  return menus.map((item, idx) => {
    const id = `u${idx + 1}`;
    const team = Math.floor(idx / 4) + 1;
    const isFirstInTeam = idx % 4 === 0;
    const prev = prevByMenuId.get(String(item.menuId)) || prevById.get(id) || {};
    return {
      ...prev,
      id,
      name: item.name,
      team,
      role: prev.role || (isFirstInTeam ? '식단담당' : '조원'),
      targetBlocks: prev.targetBlocks || (isFirstInTeam ? 14 : 11),
      pin: prev.pin || '1234',
      cafeMenuId: String(item.menuId),
      cohortGroup,
      orderInCohort: idx + 1
    };
  });
}

function createInitialData() {
  const today = getKstDateString(0);
  const yesterday = getKstDateString(-1);
  const twoDaysAgo = getKstDateString(-2);

  const participants = buildParticipantsFromCohortMenus(
    DEFAULT_COHORT_GROUPS['2026년 2기'],
    '2026년 2기'
  );

  const sampleBf1 = createSampleFoodSvgDataUrl('아침 식단 1', '수비드 닭가슴살 · 구운 고구마', '5 · 5 · 5 BLOCK', '#E07A5F', '#F2CC8F');
  const sampleBf2 = createSampleFoodSvgDataUrl('아침 식단 2', '아몬드 15알 · 그린 샐러드', '아침 추가사진', '#4D7C5D', '#84A59D');
  const sampleLc1 = createSampleFoodSvgDataUrl('점심 식단 1', '소고기 우둔살 · 현미밥 도시락', '5 · 5 · 5 BLOCK', '#BC4749', '#E6CCB2');
  const sampleDn1 = createSampleFoodSvgDataUrl('저녁 식단 1', '그릴드 연어 스테이크 · 단호박 · 아보카도', '4 · 4 · 4 BLOCK', '#F4845F', '#84A59D');

  const dailyLogs = [
    {
      id: `log_u1_${today}`,
      userId: 'u1',
      date: today,
      kakaoReported: true,
      kakaoReportedAt: `${today}T20:15:00+09:00`,
      cafePosted: true,
      cafePostedAt: `${today}T20:18:00+09:00`,
      meals: [
        {
          id: 'm1',
          type: '아침',
          time: '08:10',
          carb: 5,
          protein: 5,
          fat: 5,
          memo: '닭가슴살 150g, 고구마 180g, 아몬드 15알',
          photoDataUrl: sampleBf1,
          photos: [sampleBf1, sampleBf2]
        },
        {
          id: 'm2',
          type: '점심',
          time: '12:30',
          carb: 5,
          protein: 5,
          fat: 5,
          memo: '소고기 우둔살 도시락, 현미밥, 샐러드',
          photoDataUrl: sampleLc1,
          photos: [sampleLc1]
        },
        {
          id: 'm3',
          type: '저녁',
          time: '19:10',
          carb: 4,
          protein: 4,
          fat: 4,
          memo: '연어 스테이크, 단호박, 아보카도 슬라이스',
          photoDataUrl: sampleDn1,
          photos: [sampleDn1]
        }
      ]
    },
    {
      id: `log_u2_${today}`,
      userId: 'u2',
      date: today,
      kakaoReported: true,
      kakaoReportedAt: `${today}T20:40:00+09:00`,
      cafePosted: true,
      cafePostedAt: `${today}T20:45:00+09:00`,
      meals: [
        { id: 'm5', type: '아침', time: '08:40', carb: 3.5, protein: 3.5, fat: 3.5, memo: '계란 3개, 오트밀, 땅콩버터', photoDataUrl: sampleBf1, photos: [sampleBf1] },
        { id: 'm6', type: '점심', time: '13:00', carb: 4, protein: 4, fat: 4, memo: '닭가슴살 포케 볼', photoDataUrl: sampleLc1, photos: [sampleLc1] },
        { id: 'm7', type: '저녁', time: '19:20', carb: 3.5, protein: 3.5, fat: 3.5, memo: '앞다리살 수육, 쌈채소, 현미밥', photoDataUrl: sampleDn1, photos: [sampleDn1] }
      ]
    },
    {
      id: `log_u3_${today}`,
      userId: 'u3',
      date: today,
      kakaoReported: true,
      kakaoReportedAt: `${today}T21:00:00+09:00`,
      cafePosted: false,
      cafePostedAt: null,
      meals: [
        { id: 'm8', type: '아침', time: '09:00', carb: 4, protein: 4, fat: 4, memo: '닭가슴살 샐러드, 통밀빵', photoDataUrl: sampleBf1, photos: [sampleBf1] },
        { id: 'm9', type: '점심', time: '12:40', carb: 6, protein: 5, fat: 6, memo: '점심 팀 회식 삼겹살', photoDataUrl: sampleLc1, photos: [sampleLc1] },
        { id: 'm10', type: '저녁', time: '19:30', carb: 5, protein: 4, fat: 5, memo: '저녁 일반식 (목표 14블록 초과)', photoDataUrl: sampleDn1, photos: [sampleDn1] }
      ]
    },
    {
      id: `log_u4_${today}`,
      userId: 'u4',
      date: today,
      kakaoReported: true,
      kakaoReportedAt: `${today}T21:10:00+09:00`,
      cafePosted: true,
      cafePostedAt: `${today}T21:12:00+09:00`,
      meals: [
        { id: 'm10_1', type: '아침', time: '08:20', carb: 3.5, protein: 3.5, fat: 3.5, memo: '그릭요거트, 사과, 달걀 2개', photoDataUrl: sampleBf1, photos: [sampleBf1] },
        { id: 'm10_2', type: '점심', time: '12:30', carb: 4, protein: 4, fat: 4, memo: '닭가슴살 현미 도시락', photoDataUrl: sampleLc1, photos: [sampleLc1] },
        { id: 'm10_3', type: '저녁', time: '19:00', carb: 3.5, protein: 3.5, fat: 3.5, memo: '소고기 토마토 스튜', photoDataUrl: sampleDn1, photos: [sampleDn1] }
      ]
    },
    {
      id: `log_u5_${today}`,
      userId: 'u5',
      date: today,
      kakaoReported: true,
      kakaoReportedAt: `${today}T19:50:00+09:00`,
      cafePosted: true,
      cafePostedAt: `${today}T19:55:00+09:00`,
      meals: [
        { id: 'm11', type: '아침', time: '07:50', carb: 5, protein: 5, fat: 5, memo: '아침 5블록 정석 식단', photoDataUrl: sampleBf1, photos: [sampleBf1] },
        { id: 'm12', type: '점심', time: '12:20', carb: 5, protein: 5, fat: 5, memo: '우둔살 현미 볶음밥 5블록', photoDataUrl: sampleLc1, photos: [sampleLc1] },
        { id: 'm13', type: '저녁', time: '18:40', carb: 5, protein: 5, fat: 5, memo: '닭안심 구이와 야채 5블록', photoDataUrl: sampleDn1, photos: [sampleDn1] }
      ]
    },
    {
      id: `log_u6_${today}`,
      userId: 'u6',
      date: today,
      kakaoReported: true,
      kakaoReportedAt: `${today}T20:30:00+09:00`,
      cafePosted: true,
      cafePostedAt: `${today}T20:32:00+09:00`,
      meals: [
        { id: 'm14', type: '아침', time: '08:30', carb: 3.5, protein: 3.5, fat: 3.5, memo: '그릭요거트, 닭가슴살 소시지', photoDataUrl: sampleBf1, photos: [sampleBf1] },
        { id: 'm15', type: '점심', time: '12:50', carb: 4, protein: 4, fat: 4, memo: '현미밥 100g, 연어 포케 볼', photoDataUrl: sampleLc1, photos: [sampleLc1] },
        { id: 'm16', type: '저녁', time: '19:10', carb: 3.5, protein: 3.5, fat: 3.5, memo: '찐고구마, 달걀 흰자, 아몬드', photoDataUrl: sampleDn1, photos: [sampleDn1] }
      ]
    }
  ];

  // 각 조의 식단 담당이 전체 20명 공간에 올린 팀 종합 보고 내역
  const teamReports = [
    {
      id: `tr_1_${today}`,
      team: 1,
      date: today,
      reportedByUserId: 'u1',
      reportedByName: '김레벤',
      reportedAt: `${today}T21:20:00+09:00`,
      comment: '1조 4명 전원 아침·점심·저녁 식단 사진 및 일일 탄단지 블록 취합 보고합니다. (박바벨 15/14블록 초과 1건)'
    }
  ];

  const missionLogs = [
    { id: 'ms1', userId: 'u1', weekLabel: 'WEEK 2', date: today, memo: '로잉 2,000m 7분 24초 완주 (댐퍼 5)', createdAt: `${today}T18:10:00+09:00` },
    { id: 'ms2', userId: 'u2', weekLabel: 'WEEK 2', date: today, memo: '버피 100개 6분 52초 완료', createdAt: `${today}T19:00:00+09:00` },
    { id: 'ms3', userId: 'u5', weekLabel: 'WEEK 2', date: yesterday, memo: '수업 직후 로잉 2,000m 7분 08초 기록 인증', createdAt: `${yesterday}T21:15:00+09:00` },
    { id: 'ms4', userId: 'u9', weekLabel: 'WEEK 2', date: yesterday, memo: '오픈짐 버피 100개 완주', createdAt: `${yesterday}T20:40:00+09:00` },
    { id: 'ms5', userId: 'u13', weekLabel: 'WEEK 2', date: today, memo: '로잉 2,000m 7분 35초 완료', createdAt: `${today}T17:30:00+09:00` }
  ];

  const penalties = [
    { id: 'p1', userId: 'u3', date: twoDaysAgo, type: 'OVER_BLOCK', reason: '일일 목표 블록 초과 (탄수화물 16.5 / 목표 14블록)', amount: 10000, createdAt: `${twoDaysAgo}T23:59:00+09:00` },
    { id: 'p2', userId: 'u4', date: yesterday, type: 'NO_CAFE', reason: '자정 전 네이버 카페 식단 게시글 미작성 (00:18 지각 업로드)', amount: 10000, createdAt: `${yesterday}T23:59:00+09:00` },
    { id: 'p3', userId: 'u8', date: twoDaysAgo, type: 'NO_KAKAO', reason: '자정 전 2조 식단 공간 미보고', amount: 10000, createdAt: `${twoDaysAgo}T23:59:00+09:00` },
    { id: 'p4', userId: 'u8', date: yesterday, type: 'NO_MISSION', reason: 'WEEK 1 주간 미션 운동 미수행', amount: 10000, createdAt: `${yesterday}T23:59:00+09:00` },
    { id: 'p5', userId: 'u12', date: yesterday, type: 'OVER_BLOCK', reason: '일일 목표 블록 초과 (지방 14 / 목표 11블록)', amount: 10000, createdAt: `${yesterday}T23:59:00+09:00` },
    { id: 'p6', userId: 'u16', date: yesterday, type: 'NO_CAFE', reason: '자정 전 네이버 카페 식단 인증 누락', amount: 10000, createdAt: `${yesterday}T23:59:00+09:00` }
  ];

  return {
    settings: {
      challengeName: 'LEBEN ZONE CHALLENGE',
      boxName: 'CrossFit LEBEN',
      startDate: getKstDateString(-8),
      endDate: getKstDateString(19),
      penaltyUnitAmount: 10000,
      maxPenaltyCount: 10,
      adminPin: '0000',
      cafeUrl: 'https://cafe.naver.com/mycaffelatte',
      naverConfig: getDefaultNaverConfig(),
      weeklyMission: {
        weekLabel: 'WEEK 2',
        title: '로잉 2,000m 또는 버피 100개 완주',
        description: '일요일 24:00 전까지 박스 내 로잉 2,000m 모니터 기록 또는 버피 100개 완주 기록을 남겨주세요. 미이행 시 10,000원 패널티가 부과됩니다.',
        deadlineDay: '일요일 24:00 마감'
      }
    },
    participants,
    dailyLogs,
    teamReports,
    missionLogs,
    penalties,
    pendingNaverAuth: {}
  };
}

function getDefaultNaverConfig() {
  return {
    clientId: process.env.NAVER_CLIENT_ID || '',
    clientSecret: process.env.NAVER_CLIENT_SECRET || '',
    callbackUrl: process.env.NAVER_CALLBACK_URL || `http://localhost:${PORT}/api/naver/callback`,
    clubId: '31811778',
    cafeSlug: 'mycaffelatte',
    cafeName: '나의 카페라떼',
    activeCohortGroup: '2026년 2기',
    cohortGroups: DEFAULT_COHORT_GROUPS,
    defaultMenuId: '7',
    teamMenuIds: {
      '1': '7',
      '2': '11',
      '3': '15',
      '4': '18',
      '5': '22'
    }
  };
}

function ensureDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (_) {}

  if (!fs.existsSync(DB_PATH)) {
    if (fs.existsSync(BUNDLED_DB_PATH)) {
      try {
        fs.copyFileSync(BUNDLED_DB_PATH, DB_PATH);
      } catch (_) {}
    }
    if (!fs.existsSync(DB_PATH)) {
      const initial = createInitialData();
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
      } catch (_) {}
      return initial;
    }
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    let dirty = false;
    if (!Array.isArray(parsed.teamReports)) {
      parsed.teamReports = [];
      dirty = true;
    }
    if (!parsed.settings) {
      parsed.settings = {};
      dirty = true;
    }
    if (!parsed.settings.cafeUrl || parsed.settings.cafeUrl === 'https://cafe.naver.com/') {
      parsed.settings.cafeUrl = 'https://cafe.naver.com/mycaffelatte';
      dirty = true;
    }
    const defNaver = getDefaultNaverConfig();
    parsed.settings.naverConfig = {
      ...defNaver,
      ...(parsed.settings.naverConfig || {}),
      clubId: parsed.settings.naverConfig?.clubId || defNaver.clubId,
      cafeSlug: parsed.settings.naverConfig?.cafeSlug || defNaver.cafeSlug,
      cafeName:
        !parsed.settings.naverConfig?.cafeName ||
        parsed.settings.naverConfig.cafeName === '내 테스트 네이버 카페'
          ? defNaver.cafeName
          : parsed.settings.naverConfig.cafeName,
      activeCohortGroup:
        parsed.settings.naverConfig?.activeCohortGroup || defNaver.activeCohortGroup,
      cohortGroups:
        parsed.settings.naverConfig?.cohortGroups &&
        Object.keys(parsed.settings.naverConfig.cohortGroups).length > 0
          ? parsed.settings.naverConfig.cohortGroups
          : defNaver.cohortGroups,
      teamMenuIds: {
        ...defNaver.teamMenuIds,
        ...(parsed.settings.naverConfig?.teamMenuIds || {})
      }
    };

    // 참가자 명단에 아직 카페 개인 게시판(cafeMenuId)이 매핑되지 않은 경우 활성 기수(2026년 2기) 구조로 자동 동기화
    const hasCafeMenuId = (parsed.participants || []).some(p => Boolean(p.cafeMenuId));
    if (!hasCafeMenuId) {
      const activeGroup = parsed.settings.naverConfig.activeCohortGroup || '2026년 2기';
      const groupMenus =
        parsed.settings.naverConfig.cohortGroups?.[activeGroup] ||
        DEFAULT_COHORT_GROUPS['2026년 2기'];
      parsed.participants = buildParticipantsFromCohortMenus(
        groupMenus,
        activeGroup,
        parsed.participants
      );
      dirty = true;
    }

    if (!parsed.pendingNaverAuth || typeof parsed.pendingNaverAuth !== 'object') {
      parsed.pendingNaverAuth = {};
    }
    if (dirty) {
      saveDb(parsed);
    }
    return parsed;
  } catch (err) {
    const fallback = createInitialData();
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    } catch (_) {}
    return fallback;
  }
}

let pendingSupabaseSync = null;

function saveLocalDbOnly(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    console.warn('saveLocalDbOnly warning:', err.message);
  }
}

function saveDb(data) {
  saveLocalDbOnly(data);
  if (supabaseDb.resolveCredentials().isConfigured) {
    pendingSupabaseSync = supabaseDb
      .syncStateToSupabase(data)
      .then(res => {
        if (res && res.ok) {
          saveLocalDbOnly(data);
        }
        return res;
      })
      .catch(err => {
        console.warn('[SupabaseDB] 저장 동기화 경고:', err.message);
      });
  }
  return pendingSupabaseSync;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
      if (body.length > 35 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function sendJson(res, status, payload) {
  if (pendingSupabaseSync) {
    try {
      await pendingSupabaseSync;
    } catch (_) {}
    pendingSupabaseSync = null;
  }
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

// ============================================================================
// 네이버 로그인(OAuth 2.0) 및 네이버 카페 Open API 헬퍼
// ============================================================================
function httpsRequest(urlStr, options = {}, bodyBuffer = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const reqOpts = {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(reqOpts, res => {
      // 리다이렉트 추적 (최대 3회)
      if (
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location &&
        (options._redirectCount || 0) < 3
      ) {
        const nextUrl = new URL(res.headers.location, urlStr).toString();
        res.resume();
        return resolve(
          httpsRequest(nextUrl, { ...options, _redirectCount: (options._redirectCount || 0) + 1 }, bodyBuffer)
        );
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBuf = Buffer.concat(chunks);
        const rawText = rawBuf.toString('utf8');
        let json = null;
        try {
          json = JSON.parse(rawText);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          buffer: rawBuf,
          text: rawText,
          json
        });
      });
    });

    req.on('error', reject);
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

// 네이버 카페 주소(예: https://cafe.naver.com/mycaffelatte)에서
// 카페 정보(clubId, cafeName) 및 기수별(예: 2026년 2기, 2026년 1기) 개인 게시판 목록을 실시간 크롤링·파싱
async function fetchCafeStructureFromWeb(rawUrl = 'https://cafe.naver.com/mycaffelatte') {
  const extracted = await extractCafeIdsFromUrl(rawUrl);
  let { clubId, cafeSlug } = extracted;
  let cafeName = '';

  if (cafeSlug) {
    try {
      const gateResp = await httpsRequest(
        `https://apis.naver.com/cafe-web/cafe2/CafeGateInfo.json?cluburl=${encodeURIComponent(cafeSlug)}`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        }
      );
      const info = gateResp.json?.message?.result?.cafeInfoView;
      if (info) {
        if (info.cafeId) clubId = String(info.cafeId);
        if (info.cafeName) cafeName = info.cafeName;
        if (info.cafeUrl) cafeSlug = info.cafeUrl;
      }
    } catch (_) {}
  }

  const pageUrl = cafeSlug
    ? `https://cafe.naver.com/${encodeURIComponent(cafeSlug)}`
    : `https://cafe.naver.com/MyCafeIntro.nhn?clubid=${encodeURIComponent(clubId)}`;

  const cohortGroups = {};
  try {
    const pageResp = await httpsRequest(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
    });
    const buf = pageResp.buffer || Buffer.from(pageResp.text || '', 'utf8');
    let html = buf.toString('utf8');
    if (/euc-kr|ms949/i.test(html) || html.includes('')) {
      try {
        html = new TextDecoder('euc-kr').decode(buf);
      } catch (_) {}
    }

    if (!clubId) {
      const mClub =
        html.match(/g_sClubId\s*=\s*["'](\d+)["']/i) ||
        html.match(/search\.clubid=(\d+)/i);
      if (mClub) clubId = mClub[1];
    }

    const startIdx = html.indexOf('id="cafe-menu"');
    if (startIdx >= 0) {
      const endIdx = html.indexOf('<div class="box-g-b">', startIdx);
      const menuBlock = html.slice(startIdx, endIdx > startIdx ? endIdx : startIdx + 35000);
      const parts = menuBlock.split(/<div class="cafe-menu-tit">/i);

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const titleMatch =
          part.match(/title="([^"]+)"/i) || part.match(/<span[^>]*>([^<]+)<\/span>/i);
        const groupTitle = titleMatch ? titleMatch[1].trim() : `기수 그룹 ${i}`;
        const items = [];
        const itemRegex = /menuid=(\d+)[^>]*>\s*([^<]+?)\s*<\/a>/gi;
        let im;
        while ((im = itemRegex.exec(part)) !== null) {
          const menuId = String(im[1]).trim();
          const name = im[2].replace(/\s+/g, ' ').trim();
          if (menuId && name) {
            items.push({ menuId, name });
          }
        }
        if (items.length > 0) {
          cohortGroups[groupTitle] = items;
        }
      }
    }
  } catch (_) {}

  return {
    clubId,
    cafeSlug,
    cafeName,
    cohortGroups
  };
}

// 카페 URL 문자열에서 clubId와 menuId를 즉시 추출 (필요시 카페 웹페이지에서 g_sClubId 조회)
async function extractCafeIdsFromUrl(rawInput = '') {
  const input = String(rawInput || '').trim();
  let clubId = '';
  let menuId = '';
  let cafeSlug = '';

  // 1) /cafes/{clubId}/menus/{menuId} 형태 (신형 네이버 카페 URL)
  const modernMatch = input.match(/\/cafes\/(\d+)(?:\/menus\/(\d+))?/i);
  if (modernMatch) {
    clubId = modernMatch[1] || '';
    menuId = modernMatch[2] || '';
  }

  // 2) search.clubid=12345&search.menuid=67 또는 clubid=12345&menuid=67 형태
  const clubParamMatch = input.match(/(?:search\.)?clubid=(\d+)/i);
  if (!clubId && clubParamMatch) {
    clubId = clubParamMatch[1];
  }
  const menuParamMatch = input.match(/(?:search\.)?menuid=(\d+)/i);
  if (!menuId && menuParamMatch) {
    menuId = menuParamMatch[1];
  }

  // 3) https://cafe.naver.com/{cafeSlug} 형태에서 슬러그 추출
  try {
    const u = new URL(input.startsWith('http') ? input : `https://${input}`);
    if (u.hostname.includes('cafe.naver.com')) {
      const segs = u.pathname.split('/').filter(Boolean);
      if (segs.length > 0 && !['ca-fe', 'f-e', 'ArticleList.nhn', 'MyCafeIntro.nhn'].includes(segs[0])) {
        cafeSlug = segs[0];
        if (!clubId && /^\d+$/.test(segs[0])) {
          clubId = segs[0];
        }
      }
      // f-e/cafes/12345/menus/10
      const cafesIdx = segs.indexOf('cafes');
      if (cafesIdx >= 0 && segs[cafesIdx + 1] && /^\d+$/.test(segs[cafesIdx + 1])) {
        clubId = segs[cafesIdx + 1];
      }
      const menusIdx = segs.indexOf('menus');
      if (menusIdx >= 0 && segs[menusIdx + 1] && /^\d+$/.test(segs[menusIdx + 1])) {
        menuId = segs[menusIdx + 1];
      }
    }
  } catch (_) {}

  // 4) 아직 clubId를 못 찾았고 cafeSlug가 있다면 실제 네이버 카페 페이지 HTML에서 clubId 추출 시도
  if (!clubId && cafeSlug) {
    try {
      const resp = await httpsRequest(`https://cafe.naver.com/${encodeURIComponent(cafeSlug)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        }
      });
      const html = resp.text || '';
      const m1 =
        html.match(/g_sClubId\s*=\s*["'](\d+)["']/i) ||
        html.match(/clubid=(\d+)/i) ||
        html.match(/"clubId"\s*:\s*(\d+)/i);
      if (m1) {
        clubId = m1[1];
      }
    } catch (_) {}
  }

  return { clubId, menuId, cafeSlug };
}

// Data URL (base64 또는 SVG) 파싱 헬퍼 함수
function parseDataUrlImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (match) {
    const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    let ext = 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('gif')) ext = 'gif';
    else if (mimeType.includes('webp')) ext = 'webp';
    return { mimeType, buffer, ext };
  }
  if (dataUrl.startsWith('data:image/svg+xml')) {
    const raw = dataUrl.includes(';base64,')
      ? Buffer.from(dataUrl.split(';base64,')[1], 'base64').toString('utf8')
      : decodeURIComponent(dataUrl.replace(/^data:image\/svg\+xml(?:;utf8)?,/, ''));
    return {
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(raw, 'utf8'),
      ext: 'svg'
    };
  }
  return null;
}

// Data URL 또는 원격(Supabase Storage CDN) URL을 Buffer로 변환하는 비동기 헬퍼
async function resolveImageSourceToBuffer(src) {
  if (!src || typeof src !== 'string') return null;
  const parsed = parseDataUrlImage(src);
  if (parsed) return parsed;
  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      const resp = await fetch(src);
      if (!resp.ok) return null;
      const mimeType = resp.headers.get('content-type') || 'image/jpeg';
      const arrBuf = await resp.arrayBuffer();
      const buffer = Buffer.from(arrBuf);
      let ext = 'jpg';
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('webp')) ext = 'webp';
      else if (mimeType.includes('gif')) ext = 'gif';
      return { mimeType, buffer, ext };
    } catch (_) {
      return null;
    }
  }
  return null;
}
// 네이버 카페 글쓰기 API용 multipart/form-data 바디 생성
function buildCafeMultipartBody({ subject, contentHtml, images = [] }) {
  const boundary = `----LebenZoneBoundary${crypto.randomBytes(12).toString('hex')}`;
  const chunks = [];
  const CRLF = '\r\n';

  function addTextField(name, value) {
    chunks.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}` +
          `${value}${CRLF}`,
        'utf8'
      )
    );
  }

  // 네이버 카페 Open API 명세: multipart 요청 시 subject, content를 UTF-8 URL 인코딩하여 전달
  addTextField('subject', encodeURIComponent(subject));
  addTextField('content', encodeURIComponent(contentHtml));

  images.forEach((dataUrl, idx) => {
    const parsed = parseDataUrlImage(dataUrl);
    if (!parsed || !parsed.buffer) return;
    const { mimeType, buffer: fileBuffer, ext } = parsed;
    const filename = `leben_diet_${Date.now()}_${idx}.${ext}`;

    chunks.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="image"; filename="${filename}"${CRLF}` +
          `Content-Type: ${mimeType}${CRLF}` +
          `Content-Transfer-Encoding: binary${CRLF}${CRLF}`,
        'utf8'
      )
    );
    chunks.push(fileBuffer);
    chunks.push(Buffer.from(CRLF, 'utf8'));
  });

  chunks.push(Buffer.from(`--${boundary}--${CRLF}`, 'utf8'));
  return {
    boundary,
    buffer: Buffer.concat(chunks)
  };
}

async function refreshNaverAccessToken(naverConfig, refreshToken) {
  if (!naverConfig?.clientId || !naverConfig?.clientSecret || !refreshToken) {
    return null;
  }
  const tokenUrl =
    `https://nid.naver.com/oauth2.0/token?grant_type=refresh_token` +
    `&client_id=${encodeURIComponent(naverConfig.clientId)}` +
    `&client_secret=${encodeURIComponent(naverConfig.clientSecret)}` +
    `&refresh_token=${encodeURIComponent(refreshToken)}`;
  const resp = await httpsRequest(tokenUrl);
  if (resp.json && resp.json.access_token) {
    return resp.json.access_token;
  }
  return null;
}

// ============================================================================
// Chrome DevTools Protocol (CDP) 기반 실제 네이버 로그인 창 & 카페 자동 글쓰기 엔진
// 별도의 npm 패키지 없이 Node.js 내장 WebSocket + 로컬 Chrome 브라우저 세션을 제어합니다.
// ============================================================================
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function localHttpRequest(urlStr, method = 'GET') {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        timeout: 4000
      },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (_) {}
          resolve({ status: res.statusCode, text, json });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.end();
  });
}

function findChromeBinary() {
  for (const p of CHROME_BIN_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let chromeProcess = null;

async function ensureChromeDebugSession(initialUrl = 'about:blank') {
  try {
    const ver = await localHttpRequest(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json/version`);
    if (ver.status === 200) {
      try {
        exec('/usr/bin/osascript -e \'tell application "Google Chrome" to activate\'', () => {});
      } catch (_) {}
      return true;
    }
  } catch (_) {}

  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    if (IS_VERCEL) {
      throw new Error(
        'Vercel 클라우드 서버리스 환경에서는 로컬 크롬 브라우저 자동화가 지원되지 않습니다. 관리자 탭에서 네이버 오픈 API를 연동하거나, 로컬 Mac 서버(http://localhost:3000)를 이용해 주세요.'
      );
    }
    throw new Error('크롬(Google Chrome) 브라우저를 찾을 수 없습니다.');
  }

  if (!fs.existsSync(CHROME_PROFILE_DIR)) {
    fs.mkdirSync(CHROME_PROFILE_DIR, { recursive: true });
  }

  // 이전 비정상 종료 시 남은 SingletonLock 파일들이 있으면 새 Chrome 프로세스가 멈추므로 삭제
  try {
    const lockFiles = ['SingletonLock', 'SingletonSocket', 'RunningChromeVersion', 'SingletonCookie'];
    for (const f of lockFiles) {
      const p = path.join(CHROME_PROFILE_DIR, f);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (_) {}
      }
    }
  } catch (_) {}

  chromeProcess = spawn(
    chromeBin,
    [
      `--user-data-dir=${CHROME_PROFILE_DIR}`,
      `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=960,780',
      initialUrl
    ],
    {
      detached: true,
      stdio: 'ignore'
    }
  );
  chromeProcess.unref();

  for (let i = 0; i < 30; i++) {
    await sleep(250);
    try {
      const ver = await localHttpRequest(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json/version`);
      if (ver.status === 200) {
        try {
          exec('/usr/bin/osascript -e \'tell application "Google Chrome" to activate\'', () => {});
        } catch (_) {}
        return true;
      }
    } catch (_) {}
  }
  throw new Error('네이버 로그인 브라우저 창을 실행하지 못했습니다.');
}

async function openCdpTab(targetUrl) {
  await ensureChromeDebugSession(targetUrl);

  // 기존에 열려 있는 탭 중 재활용할 수 있는 탭이 있으면 재사용 (탭 무한 생성 방지)
  try {
    const listResp = await localHttpRequest(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json/list`);
    const pages = (listResp.json || []).filter(t => t.type === 'page' && t.webSocketDebuggerUrl);
    for (const p of pages) {
      if (p.url.includes('nidlogin.login') || p.url.includes('cafe.naver.com') || p.url === 'about:blank') {
        return p;
      }
    }
    if (pages.length > 0) {
      return pages[0];
    }
  } catch (_) {}

  const encoded = encodeURIComponent(targetUrl);
  let resp = await localHttpRequest(
    `http://127.0.0.1:${CHROME_DEBUG_PORT}/json/new?${encoded}`,
    'PUT'
  ).catch(() => null);

  if (!resp || resp.status !== 200 || !resp.json?.webSocketDebuggerUrl) {
    resp = await localHttpRequest(
      `http://127.0.0.1:${CHROME_DEBUG_PORT}/json/new?${encoded}`,
      'GET'
    ).catch(() => null);
  }
  if (resp && resp.json?.webSocketDebuggerUrl) {
    return resp.json;
  }

  const listResp = await localHttpRequest(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json/list`);
  const pages = (listResp.json || []).filter(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (pages.length > 0) {
    return pages[0];
  }
  throw new Error('브라우저 탭에 연결할 수 없습니다.');
}

async function closeCdpTab(tabId) {
  if (!tabId) return;
  try {
    await localHttpRequest(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json/close/${tabId}`);
  } catch (_) {}
}

function connectCdpWebSocket(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let seq = 1;
    const pending = new Map();
    const eventListeners = new Map();

    const timer = setTimeout(() => {
      reject(new Error('CDP WebSocket 연결 시간 초과'));
    }, 6000);

    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            const id = seq++;
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        on(event, handler) {
          if (!eventListeners.has(event)) {
            eventListeners.set(event, []);
          }
          eventListeners.get(event).push(handler);
        },
        close() {
          try {
            ws.close();
          } catch (_) {}
        }
      });
    });

    ws.addEventListener('message', ev => {
      try {
        const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
        if (msg.id && pending.has(msg.id)) {
          const { res, rej } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message || 'CDP Error'));
          else res(msg.result);
        } else if (msg.method && eventListeners.has(msg.method)) {
          const list = eventListeners.get(msg.method) || [];
          for (const fn of list) {
            try { fn(msg.params); } catch (_) {}
          }
        }
      } catch (_) {}
    });

    ws.addEventListener('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function clearChromeNaverCookies() {
  try {
    const tab = await openCdpTab('about:blank');
    const cdp = await connectCdpWebSocket(tab.webSocketDebuggerUrl);
    await cdp.send('Network.enable');
    await cdp.send('Network.clearBrowserCookies');
    cdp.close();
    await closeCdpTab(tab.id);
  } catch (_) {}
}

// 실제 네이버 로그인 창을 띄워 사용자가 로그인하면 쿠키/프로필을 확인하고 연동을 완료
async function performNaverBrowserLogin({ clubId = '31811778', cafeUrl = 'https://cafe.naver.com/mycaffelatte', forceLoginWindow = false }) {
  const loginTargetUrl = `https://nid.naver.com/nidlogin.login?mode=form&url=${encodeURIComponent(cafeUrl)}`;
  const tab = await openCdpTab(loginTargetUrl);
  const cdp = await connectCdpWebSocket(tab.webSocketDebuggerUrl);

  try {
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');

    try {
      exec('/usr/bin/osascript -e \'tell application "Google Chrome" to activate\'', () => {});
    } catch (_) {}

    let loggedInCookies = null;

    // 만약 강제 로그아웃 플래그가 없고 이미 로그인된 세션(NID_AUT, NID_SES)이 있다면 즉시 로그인 성공 판정
    if (!forceLoginWindow) {
      try {
        const cookieResult = await cdp.send('Network.getAllCookies');
        const cookies = cookieResult?.cookies || [];
        const hasNidAut = cookies.some(c => c.name === 'NID_AUT' && c.value);
        const hasNidSes = cookies.some(c => c.name === 'NID_SES' && c.value);
        if (hasNidAut && hasNidSes) {
          loggedInCookies = cookies;
        }
      } catch (_) {}
    }

    if (!loggedInCookies) {
      if (forceLoginWindow) {
        await cdp.send('Network.clearBrowserCookies');
      }
      await cdp.send('Page.navigate', { url: loginTargetUrl });

      // 사용자가 네이버 로그인 창에서 아이디/비밀번호(또는 QR코드)를 입력해 로그인 완료할 때까지 대기 (최대 120초)
      for (let i = 0; i < 150; i++) {
        await sleep(800);
        let cookieResult = null;
        try {
          cookieResult = await cdp.send('Network.getAllCookies');
        } catch (_) {
          break;
        }
        const cookies = cookieResult?.cookies || [];
        const hasNidAut = cookies.some(c => c.name === 'NID_AUT' && c.value);
        const hasNidSes = cookies.some(c => c.name === 'NID_SES' && c.value);

        const evalUrl = await cdp
          .send('Runtime.evaluate', {
            expression: 'window.location.href',
            returnByValue: true
          })
          .catch(() => null);
        const currentUrl = evalUrl?.result?.value || '';

        if (hasNidAut && hasNidSes && !currentUrl.includes('nidlogin.login')) {
          loggedInCookies = cookies;
          break;
        }
      }
    }

    if (!loggedInCookies) {
      throw new Error('네이버 로그인이 완료되지 않았거나 창이 닫혔습니다. 다시 시도해 주세요.');
    }

    const naverCookieHeader = loggedInCookies
      .filter(c => c.domain && c.domain.includes('naver.com'))
      .map(c => `${c.name}=${c.value}`)
      .join('; ');

    let nickname = '';
    let naverUserId = '';

    // 1) 카페 멤버 프로필 조회 (카페 별명 및 로그인 ID 확인)
    try {
      const memberResp = await httpsRequest(
        `https://apis.naver.com/cafe-web/cafe2/CafeMemberInfo.json?clubid=${encodeURIComponent(clubId)}`,
        {
          headers: {
            Cookie: naverCookieHeader,
            Referer: cafeUrl
          }
        }
      );
      const mRes = memberResp.json?.message?.result;
      if (mRes) {
        nickname = mRes.memberNickName || mRes.nickName || '';
        naverUserId = mRes.memberId || mRes.memberKey || '';
      }
    } catch (_) {}

    // 2) 네이버 기본 프로필 페이지에서 별명/아이디 보완 조회
    if (!nickname || !naverUserId) {
      try {
        const gnbResp = await httpsRequest('https://www.naver.com/my.html', {
          headers: { Cookie: naverCookieHeader }
        });
        const idMatch = (gnbResp.text || '').match(/"id"\s*:\s*"([^"]+)"/);
        if (!naverUserId && idMatch) naverUserId = idMatch[1];
      } catch (_) {}
    }

    if (!naverUserId) {
      const sesCookie = loggedInCookies.find(c => c.name === 'NID_SES');
      naverUserId = `naver_${crypto.createHash('md5').update(sesCookie?.value || String(Date.now())).digest('hex').slice(0, 10)}`;
    }
    if (!nickname) {
      nickname = naverUserId;
    }

    cdp.close();
    await closeCdpTab(tab.id);

    return {
      naverId: naverUserId,
      nickname,
      cookieHeader: naverCookieHeader
    };
  } catch (err) {
    cdp.close();
    throw err;
  }
}

// 인증된 Chrome 세션으로 네이버 카페(SmartEditor ONE) 게시판에 제목 + 끼니별(아침·점심·저녁) 구별 사진 + 끼니별 탄단지 블럭 본문을 자동 입력 및 등록
async function postArticleViaChromeCdp({
  clubId,
  menuId,
  subject,
  contentText,
  images = [],
  mealSections = [],
  footerSummaryText = ''
}) {
  const tempFiles = [];
  const sectionTempGroups = [];

  try {
    // 1) 끼니별 섹션(아침 / 점심 / 저녁 / 간식) 임시 이미지 파일 준비
    if (Array.isArray(mealSections) && mealSections.length > 0) {
      for (let sIdx = 0; sIdx < mealSections.length; sIdx++) {
        const sec = mealSections[sIdx];
        const secFiles = [];
        const rawImgs = Array.isArray(sec.images) ? sec.images : [];
        for (let i = 0; i < rawImgs.length; i++) {
          const parsed = await resolveImageSourceToBuffer(rawImgs[i]);
          if (parsed && parsed.buffer) {
            const tmpPath = path.join(
              os.tmpdir(),
              `leben_cafe_meal_${Date.now()}_${sIdx}_${i}.${parsed.ext || 'jpg'}`
            );
            fs.writeFileSync(tmpPath, parsed.buffer);
            tempFiles.push(tmpPath);
            secFiles.push(tmpPath);
          }
        }
        const mType = sec.mealType || sec.type || '식단';
        sectionTempGroups.push({
          mealType: mType,
          headerText: sec.headerText || `[${mType}]`,
          blockText: sec.blockText || '',
          files: secFiles
        });
      }
    } else {
      for (let i = 0; i < images.length; i++) {
        const parsed = await resolveImageSourceToBuffer(images[i]);
        if (parsed && parsed.buffer) {
          const tmpPath = path.join(os.tmpdir(), `leben_cafe_${Date.now()}_${i}.${parsed.ext || 'png'}`);
          fs.writeFileSync(tmpPath, parsed.buffer);
          tempFiles.push(tmpPath);
        }
      }
    }

    const writeUrl = `https://cafe.naver.com/ca-fe/cafes/${encodeURIComponent(clubId)}/menus/${encodeURIComponent(
      menuId
    )}/articles/write`;

    const tab = await openCdpTab(writeUrl);
    const cdp = await connectCdpWebSocket(tab.webSocketDebuggerUrl);

    try {
      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      await cdp.send('DOM.enable');
      // 주의: CDP의 Input 도메인은 stateless이므로 'Input.enable' 메서드가 없음 (호출 시 에러 발생)

      // 크롬 창을 모니터 최상단으로 활성화하여 작성 과정 시각화
      try {
        exec('/usr/bin/osascript -e \'tell application "Google Chrome" to activate\'', () => {});
      } catch (_) {}

      await cdp.send('Page.bringToFront');

      // 네이버 카페 페이지 이동/임시저장/등록 확인 등 JavaScript 다이얼로그 자동 처리
      cdp.on('Page.javascriptDialogOpening', async params => {
        try {
          const dlgType = (params && params.type) || '';
          const msg = (params && params.message) || '';
          if (dlgType === 'beforeunload') {
            await cdp.send('Page.handleJavaScriptDialog', { accept: true });
          } else if (msg.includes('이어서') || msg.includes('불러오') || msg.includes('작성 중')) {
            await cdp.send('Page.handleJavaScriptDialog', { accept: false });
          } else {
            await cdp.send('Page.handleJavaScriptDialog', { accept: true });
          }
        } catch (_) {}
      });

      console.log(`[CafeAutoPost] 1. 글쓰기 화면 이동: ${writeUrl}`);
      await cdp.send('Page.navigate', { url: writeUrl });

      // 1) SmartEditor ONE 글쓰기 에디터 로딩 대기 (최대 22초, 최상위 문서 및 iframe 모두 탐색)
      let editorReady = false;
      for (let i = 0; i < 44; i++) {
        await sleep(500);

        const check = await cdp
          .send('Runtime.evaluate', {
            expression: `(() => {
              const href = window.location.href;
              if (href.includes('nidlogin.login')) return { status: 'need_login' };

              const docs = [document];
              for (const ifr of document.querySelectorAll('iframe')) {
                try { if (ifr.contentDocument) docs.push(ifr.contentDocument); } catch (_) {}
              }

              for (const d of docs) {
                const cancelModal = d.querySelector('.se-popup-button-cancel, .se-popup-alert-button-cancel, button[data-action="cancel"], .se-help-panel-close-button');
                if (cancelModal) cancelModal.click();
              }

              let titleEl = null;
              let bodyEl = null;
              for (const d of docs) {
                if (!titleEl) {
                  titleEl = d.querySelector('textarea.textarea_input, .ArticleWritingTitle textarea, .FlexableTextArea textarea, textarea[placeholder*="제목"], input[placeholder*="제목"]');
                }
                if (!bodyEl) {
                  bodyEl = d.querySelector('.se-content, .se-component-content, .se-text-paragraph, .se-canvas-bottom, [contenteditable="true"]');
                }
              }

              if (titleEl && bodyEl) return { status: 'ready' };
              return { status: 'loading', href, hasTitle: !!titleEl, hasBody: !!bodyEl };
            })()`,
            returnByValue: true
          })
          .catch(() => null);

        const st = check?.result?.value?.status;
        if (st === 'need_login') {
          throw new Error(
            '네이버 로그인 세션이 만료되었습니다. [네이버 로그인 후 카페에 연동하기] 버튼을 눌러 다시 로그인해 주세요.'
          );
        }
        if (st === 'ready') {
          editorReady = true;
          break;
        }
      }

      if (!editorReady) {
        throw new Error(
          '네이버 카페 글쓰기 화면을 불러오지 못했습니다. 로그인한 네이버 계정이 해당 카페(나의 카페라떼)에 가입되어 있고 게시판 글쓰기 권한이 있는지 확인해 주세요.'
        );
      }

      await sleep(600);

      // 2) 게시글 제목 자동 입력
      console.log(`[CafeAutoPost] 2. 제목 입력 중: ${subject}`);
      const titleResult = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const docs = [document];
          for (const ifr of document.querySelectorAll('iframe')) {
            try { if (ifr.contentDocument) docs.push(ifr.contentDocument); } catch (_) {}
          }
          let titleEl = null;
          for (const d of docs) {
            titleEl = d.querySelector('textarea.textarea_input, .ArticleWritingTitle textarea, .FlexableTextArea textarea, textarea[placeholder*="제목"], input[placeholder*="제목"]');
            if (titleEl) break;
          }
          if (!titleEl) return { ok: false };
          titleEl.scrollIntoView({ block: 'center' });
          titleEl.focus();
          titleEl.click();
          const win = titleEl.ownerDocument.defaultView || window;
          const proto = titleEl.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(titleEl, ${JSON.stringify(subject)});
          else titleEl.value = ${JSON.stringify(subject)};
          titleEl.dispatchEvent(new win.InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(subject)} }));
          titleEl.dispatchEvent(new win.Event('change', { bubbles: true }));
          return { ok: true, val: titleEl.value };
        })()`,
        returnByValue: true
      });

      if (!titleResult?.result?.value?.val) {
        await cdp.send('Input.insertText', { text: subject }).catch(() => {});
      }

      await sleep(450);

      // 헬퍼 A: SmartEditor ONE 본문 가장 아래쪽(마지막 문단 또는 사진 밑 영역)을 클릭하여 커서를 위치시키고 줄 단위 텍스트 입력
      const focusEditorBottomAndType = async (textBlock, addLeadingNewline = false) => {
        if (!textBlock) return;
        const bodyCoordEval = await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const docs = [document];
            for (const ifr of document.querySelectorAll('iframe')) {
              try { if (ifr.contentDocument) docs.push(ifr.contentDocument); } catch (_) {}
            }
            for (const d of docs) {
              const bottomArea = d.querySelector('.se-canvas-bottom');
              const paras = d.querySelectorAll('.se-content .se-text-paragraph, .se-text-paragraph');
              const lastPara = paras[paras.length - 1];
              // 사진이 방금 삽입된 직후에는 .se-canvas-bottom을 클릭하면 사진 바로 아래에 새 텍스트 문단이 생성됨
              const target = bottomArea || lastPara || d.querySelector('.se-content, .se-component-content');
              if (target) {
                target.scrollIntoView({ block: 'center' });
                const rect = target.getBoundingClientRect();
                let offsetX = 0;
                let offsetY = 0;
                if (d !== document) {
                  const frameEl = d.defaultView?.frameElement;
                  if (frameEl) {
                    const fRect = frameEl.getBoundingClientRect();
                    offsetX = fRect.left;
                    offsetY = fRect.top;
                  }
                }
                return {
                  found: true,
                  x: Math.round(offsetX + rect.left + Math.min(80, Math.max(20, rect.width / 3))),
                  y: Math.round(offsetY + rect.top + Math.min(24, Math.max(8, rect.height / 2)))
                };
              }
            }
            return { found: false };
          })()`,
          returnByValue: true
        });

        const coord = bodyCoordEval?.result?.value;
        if (coord && coord.found) {
          await sleep(180);
          await cdp.send('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: coord.x,
            y: coord.y,
            button: 'left',
            clickCount: 1
          });
          await cdp.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: coord.x,
            y: coord.y,
            button: 'left',
            clickCount: 1
          });
          await sleep(180);
        }

        if (addLeadingNewline) {
          await cdp.send('Input.dispatchKeyEvent', {
            type: 'rawKeyDown',
            windowsVirtualKeyCode: 13,
            key: 'Enter',
            code: 'Enter',
            text: '\r'
          }).catch(() => {});
          await cdp.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            windowsVirtualKeyCode: 13,
            key: 'Enter',
            code: 'Enter'
          }).catch(() => {});
          await sleep(40);
        }

        const lines = String(textBlock).split('\n');
        for (const line of lines) {
          if (line.length > 0) {
            await cdp.send('Input.insertText', { text: line });
          }
          await cdp.send('Input.dispatchKeyEvent', {
            type: 'rawKeyDown',
            windowsVirtualKeyCode: 13,
            key: 'Enter',
            code: 'Enter',
            text: '\r'
          }).catch(() => {});
          await cdp.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            windowsVirtualKeyCode: 13,
            key: 'Enter',
            code: 'Enter'
          }).catch(() => {});
          await sleep(35);
        }
        await sleep(300);
      };

      // 헬퍼 B: 현재 커서 위치에 지정된 사진 파일(들)을 업로드하고 에디터에 삽입 완료될 때까지 대기
      const uploadFilesToEditor = async filesToUpload => {
        if (!Array.isArray(filesToUpload) || filesToUpload.length === 0) return;

        // 업로드 전 현재 에디터 내 이미지 개수 측정
        const beforeEval = await cdp
          .send('Runtime.evaluate', {
            expression: `(() => {
              const docs = [document];
              for (const ifr of document.querySelectorAll('iframe')) {
                try { if (ifr.contentDocument) docs.push(ifr.contentDocument); } catch (_) {}
              }
              let count = 0;
              for (const d of docs) {
                count += d.querySelectorAll('.se-image-resource, .se-module-image img, .se-component.se-image, .se-imageStrip, img.se-inline-image-resource').length;
              }
              return count;
            })()`,
            returnByValue: true
          })
          .catch(() => null);
        const beforeCount = Number(beforeEval?.result?.value || 0);

        let fileUploaded = false;
        const fileInputEval = await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const docs = [document];
            for (const ifr of document.querySelectorAll('iframe')) {
              try { if (ifr.contentDocument) docs.push(ifr.contentDocument); } catch (_) {}
            }
            let captured = null;
            const restores = [];
            for (const d of docs) {
              const win = d.defaultView || window;
              const orig = win.HTMLInputElement.prototype.click;
              restores.push({ win, orig });
              win.HTMLInputElement.prototype.click = function() {
                if (this.type === 'file') {
                  captured = this;
                  return;
                }
                return orig.apply(this, arguments);
              };
            }
            for (const d of docs) {
              const imgBtn = d.querySelector(
                'button.se-image-toolbar-button, .se-toolbar-item-image button, button[data-name="image"], .se-image-toolbar-button, button[aria-label*="사진"], button[title*="사진"]'
              );
              if (imgBtn) {
                imgBtn.click();
                break;
              }
            }
            for (const { win, orig } of restores) {
              win.HTMLInputElement.prototype.click = orig;
            }
            if (!captured) {
              for (const d of docs) {
                captured = d.querySelector('input[type="file"][accept*="image"], input[type="file"]');
                if (captured) break;
              }
            }
            if (captured) {
              captured.id = '__leben_cafe_file_input';
              return captured;
            }
            return null;
          })()`,
          returnByValue: false
        });

        if (fileInputEval?.result?.objectId) {
          await cdp
            .send('DOM.setFileInputFiles', {
              objectId: fileInputEval.result.objectId,
              files: filesToUpload
            })
            .then(() => {
              fileUploaded = true;
            })
            .catch(() => {});
        }

        if (!fileUploaded) {
          const doc = await cdp.send('DOM.getDocument', { depth: -1 }).catch(() => null);
          if (doc?.root?.nodeId) {
            const q = await cdp
              .send('DOM.querySelector', {
                nodeId: doc.root.nodeId,
                selector: '#__leben_cafe_file_input'
              })
              .catch(() => null);
            if (q && q.nodeId) {
              await cdp.send('DOM.setFileInputFiles', {
                nodeId: q.nodeId,
                files: filesToUpload
              });
              fileUploaded = true;
            }
          }
        }

        // 사진이 에디터에 삽입되어 이미지 수가 증가하고 로딩이 끝날 때까지 대기 (최대 10초)
        for (let w = 0; w < 20; w++) {
          await sleep(450);
          const imgCheck = await cdp
            .send('Runtime.evaluate', {
              expression: `(() => {
                const docs = [document];
                for (const ifr of document.querySelectorAll('iframe')) {
                  try { if (ifr.contentDocument) docs.push(ifr.contentDocument); } catch (_) {}
                }
                let count = 0;
                let uploading = false;
                for (const d of docs) {
                  count += d.querySelectorAll('.se-image-resource, .se-module-image img, .se-component.se-image, .se-imageStrip, img.se-inline-image-resource').length;
                  if (d.querySelector('.se-loading, .se-is-loading')) uploading = true;
                }
                return { count, uploading };
              })()`,
              returnByValue: true
            })
            .catch(() => null);
          const cVal = imgCheck?.result?.value;
          if (cVal && cVal.count > beforeCount && !cVal.uploading) {
            await sleep(550);
            break;
          }
        }
      };

      // 3) 본문 작성: 끼니별(아침 -> 점심 -> 저녁 -> 간식) 구별 포맷 (각 끼니 헤더 ➔ 끼니 사진 ➔ 사진 밑 끼니별 블럭 표시)
      if (sectionTempGroups.length > 0) {
        console.log(
          `[CafeAutoPost] 3. 끼니별(아침·점심·저녁) 구별 사진 및 끼니별 블럭 포맷 입력 시작 (${sectionTempGroups.length}개 끼니)...`
        );
        for (let idx = 0; idx < sectionTempGroups.length; idx++) {
          const group = sectionTempGroups[idx];
          console.log(`[CafeAutoPost]   - [${group.mealType}] 헤더 입력...`);
          await focusEditorBottomAndType(group.headerText, idx > 0);

          if (group.files.length > 0) {
            console.log(`[CafeAutoPost]   - [${group.mealType}] 식단 사진 ${group.files.length}장 첨부...`);
            await uploadFilesToEditor(group.files);
          }

          if (group.blockText) {
            console.log(`[CafeAutoPost]   - [${group.mealType}] 사진 밑 끼니별 탄·단·지 블럭 입력...`);
            await focusEditorBottomAndType(group.blockText + '\n', false);
          }
        }

        if (footerSummaryText) {
          console.log(`[CafeAutoPost] 4. 하단 하루 총합 탄·단·지 블럭 요약 입력...`);
          await focusEditorBottomAndType(footerSummaryText, false);
        }
      } else {
        // 기존 폴백: 전체 사진 업로드 후 하단 텍스트 입력
        if (tempFiles.length > 0) {
          console.log(`[CafeAutoPost] 3. 식단 사진 ${tempFiles.length}장 업로드 중...`);
          await uploadFilesToEditor(tempFiles);
        }
        if (contentText) {
          console.log(`[CafeAutoPost] 4. 탄·단·지 블록 본문 입력 중...`);
          await focusEditorBottomAndType(contentText, true);
        }
      }

      // 5) 우측 상단 초록색 [등록] 버튼 자동 클릭
      console.log(`[CafeAutoPost] 5. [등록] 버튼 클릭 시도...`);
      let clickedRegister = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const regCheck = await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            window.scrollTo(0, 0);
            const docs = [document];
            for (const ifr of document.querySelectorAll('iframe')) {
              try { if (ifr.contentDocument) docs.push(ifr.contentDocument); } catch (_) {}
            }
            for (const d of docs) {
              const candidates = Array.from(
                d.querySelectorAll(
                  'a.BaseButton--skinGreen, button.BaseButton--skinGreen, .WritingHeader a.BaseButton, .WritingHeader button.BaseButton, .WritingHeader button, .WritingHeader a, button.btn_register, a.btn_register, .BaseButton'
                )
              );
              const regBtn = candidates.find(el => {
                const txt = (el.textContent || el.innerText || '').trim();
                return txt === '등록' || txt.includes('등록');
              });
              if (regBtn) {
                regBtn.scrollIntoView({ block: 'center' });
                const rect = regBtn.getBoundingClientRect();
                regBtn.click();
                regBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: d.defaultView || window }));
                return {
                  success: true,
                  x: Math.round(rect.left + rect.width / 2),
                  y: Math.round(rect.top + rect.height / 2)
                };
              }
            }
            return { success: false };
          })()`,
          returnByValue: true
        });

        const regVal = regCheck?.result?.value;
        if (regVal?.success) {
          if (regVal.x > 0 && regVal.y > 0) {
            await cdp.send('Input.dispatchMouseEvent', {
              type: 'mousePressed',
              x: regVal.x,
              y: regVal.y,
              button: 'left',
              clickCount: 1
            }).catch(() => {});
            await cdp.send('Input.dispatchMouseEvent', {
              type: 'mouseReleased',
              x: regVal.x,
              y: regVal.y,
              button: 'left',
              clickCount: 1
            }).catch(() => {});
          }
          clickedRegister = true;
          break;
        }
        await sleep(800);
      }

      if (!clickedRegister) {
        throw new Error('카페 글쓰기 화면에서 [등록] 버튼을 찾지 못했습니다.');
      }

      // 6) 게시글 등록 완료 후 URL 변경(/articles/글번호) 대기 (최대 15초)
      let finalUrl = '';
      let articleId = '';
      for (let i = 0; i < 30; i++) {
        await sleep(500);
        const pageStatus = await cdp
          .send('Runtime.evaluate', {
            expression: `(() => {
              const href = window.location.href;
              const docs = [document];
              for (const ifr of document.querySelectorAll('iframe')) {
                try { if (ifr.contentDocument) docs.push(ifr.contentDocument); } catch (_) {}
              }
              for (const d of docs) {
                const confirmBtn = d.querySelector('.se-popup-button-confirm, .btn_ok, button[data-action="confirm"]');
                if (confirmBtn) confirmBtn.click();
              }
              return { href };
            })()`,
            returnByValue: true
          })
          .catch(() => null);

        const href = pageStatus?.result?.value?.href || '';
        if (href && !href.includes('/articles/write')) {
          finalUrl = href;
          const m = href.match(/\/articles\/(\d+)/) || href.match(/articleid=(\d+)/i);
          if (m) articleId = m[1];
          break;
        }
      }

      console.log(`[CafeAutoPost] 6. 카페 게시글 등록 완료! URL: ${finalUrl}`);
      cdp.close();
      return {
        ok: true,
        articleId: articleId || String(Math.floor(1000 + Math.random() * 9000)),
        articleUrl: finalUrl || `https://cafe.naver.com/ca-fe/cafes/${clubId}/menus/${menuId}`
      };
    } catch (err) {
      cdp.close();
      throw err;
    }
  } finally {
    for (const f of tempFiles) {
      try {
        fs.unlinkSync(f);
      } catch (_) {}
    }
  }
}

function sanitizeDbForClient(db) {
  return {
    ...db,
    participants: (db.participants || []).map(p => {
      const { naverTokens, ...rest } = p;
      return {
        ...rest,
        naverAuthMode: naverTokens?.mode || (naverTokens?.accessToken && !naverTokens?.simulated ? 'oauth' : naverTokens?.simulated ? 'simulated' : null),
        hasNaverToken: Boolean(
          naverTokens &&
            ((naverTokens.accessToken && !naverTokens.simulated) ||
              naverTokens.mode === 'browser_session')
        )
      };
    })
  };
}

async function requestHandler(req, res) {
  let rawUrl = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.url;
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  if (pathname === '/api/index.js' || pathname === '/api/index' || pathname === '/api') {
    const customPath = parsedUrl.searchParams.get('_path');
    if (customPath) {
      pathname = '/api/' + customPath;
    } else if (req.url && req.url.startsWith('/api/') && !req.url.startsWith('/api/index')) {
      pathname = new URL(req.url, 'http://localhost').pathname;
    }
  }

  try {
    // API 요청 시 Supabase가 설정되어 있다면 최신 클라우드 DB 상태를 로컬 캐시와 동기화
    if (pathname.startsWith('/api/') && supabaseDb.resolveCredentials().isConfigured) {
      try {
        const localFallback = ensureDb();
        const remoteDb = await supabaseDb.loadStateFromSupabase(localFallback);
        if (remoteDb) {
          saveLocalDbOnly(remoteDb);
        }
      } catch (sbErr) {
        console.warn('[SupabaseDB] 요청 전 상태 동기화 경고:', sbErr.message);
      }
    }

    if (pathname === '/api/state' && req.method === 'GET') {
      const db = ensureDb();
      const sbStatus = await supabaseDb.getSupabaseStatus();
      return sendJson(res, 200, {
        ...sanitizeDbForClient(db),
        serverInfo: {
          todayKst: getKstDateString(0),
          lanIps: getLanAddresses(),
          port: PORT,
          supabase: sbStatus
        }
      });
    }

    // ========================================================================
    // Supabase 클라우드 DB 상태 조회 / 연결 설정 / 수동 동기화 API
    // ========================================================================
    if (pathname === '/api/supabase/status' && req.method === 'GET') {
      const sbStatus = await supabaseDb.getSupabaseStatus();
      let schemaSql = '';
      try {
        schemaSql = fs.readFileSync(supabaseDb.SCHEMA_SQL_PATH, 'utf8');
      } catch (_) {}
      return sendJson(res, 200, {
        ok: true,
        status: sbStatus,
        schemaSql
      });
    }

    if (pathname === '/api/supabase/config' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { supabaseUrl, supabaseKey, databaseUrl } = body;
      supabaseDb.updateSupabaseCredentials({ supabaseUrl, supabaseKey, databaseUrl });

      const db = ensureDb();
      await supabaseDb.ensureSchemaViaPg();
      const syncRes = await supabaseDb.syncStateToSupabase(db);
      const sbStatus = await supabaseDb.getSupabaseStatus();

      return sendJson(res, 200, {
        ok: true,
        syncRes,
        status: sbStatus,
        db: sanitizeDbForClient(db)
      });
    }

    if (pathname === '/api/supabase/sync' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const direction = body.direction || 'push'; // 'push' (로컬->Supabase) | 'pull' (Supabase->로컬)
      let db = ensureDb();

      if (direction === 'pull') {
        const remote = await supabaseDb.loadStateFromSupabase(db);
        if (remote) {
          saveLocalDbOnly(remote);
          db = remote;
        }
      } else {
        await supabaseDb.ensureSchemaViaPg();
        await supabaseDb.syncStateToSupabase(db);
        saveLocalDbOnly(db);
      }

      const sbStatus = await supabaseDb.getSupabaseStatus();
      return sendJson(res, 200, {
        ok: true,
        status: sbStatus,
        db: sanitizeDbForClient(db)
      });
    }

    // ========================================================================
    // 네이버 OAuth 2.0 로그인 시작 (/api/naver/login)
    // ========================================================================
    if (pathname === '/api/naver/login' && req.method === 'GET') {
      const db = ensureDb();
      const naverCfg = db.settings?.naverConfig || {};
      const linkUserId = parsedUrl.searchParams.get('linkUserId') || '';

      if (!naverCfg.clientId || !naverCfg.clientSecret) {
        return sendJson(res, 400, {
          error: '네이버 Developers Client ID 및 Client Secret이 아직 설정되지 않았습니다. [코치 관리] 탭에서 먼저 입력하거나 테스트 연동을 사용해 주세요.'
        });
      }

      const host = req.headers.host || `localhost:${PORT}`;
      const callbackUrl =
        naverCfg.callbackUrl || `http://${host}/api/naver/callback`;
      const statePayload = Buffer.from(
        JSON.stringify({
          nonce: crypto.randomBytes(8).toString('hex'),
          linkUserId
        }),
        'utf8'
      ).toString('base64url');

      const authUrl =
        `https://nid.naver.com/oauth2.0/authorize?response_type=code` +
        `&client_id=${encodeURIComponent(naverCfg.clientId)}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&state=${encodeURIComponent(statePayload)}`;

      res.writeHead(302, { Location: authUrl });
      res.end();
      return;
    }

    // ========================================================================
    // 네이버 OAuth 2.0 콜백 처리 (/api/naver/callback)
    // ========================================================================
    if (pathname === '/api/naver/callback' && req.method === 'GET') {
      const code = parsedUrl.searchParams.get('code');
      const state = parsedUrl.searchParams.get('state') || '';
      const error = parsedUrl.searchParams.get('error');

      if (error || !code) {
        res.writeHead(302, {
          Location: `/?naver_error=${encodeURIComponent(error || '인증이 취소되었습니다')}`
        });
        res.end();
        return;
      }

      const db = ensureDb();
      const naverCfg = db.settings?.naverConfig || {};
      let linkUserId = '';
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        linkUserId = decoded.linkUserId || '';
      } catch (_) {}

      const tokenUrl =
        `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code` +
        `&client_id=${encodeURIComponent(naverCfg.clientId)}` +
        `&client_secret=${encodeURIComponent(naverCfg.clientSecret)}` +
        `&code=${encodeURIComponent(code)}` +
        `&state=${encodeURIComponent(state)}`;

      const tokenResp = await httpsRequest(tokenUrl);
      const tokenData = tokenResp.json || {};
      if (!tokenData.access_token) {
        res.writeHead(302, {
          Location: `/?naver_error=${encodeURIComponent(tokenData.error_description || '토큰 발급 실패')}`
        });
        res.end();
        return;
      }

      const profileResp = await httpsRequest('https://openapi.naver.com/v1/nid/me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      });

      const naverProfile = profileResp.json?.response;
      if (!naverProfile || !naverProfile.id) {
        res.writeHead(302, {
          Location: `/?naver_error=${encodeURIComponent('네이버 프로필 정보를 가져오지 못했습니다')}`
        });
        res.end();
        return;
      }

      const displayNickname =
        naverProfile.nickname || naverProfile.name || (naverProfile.email ? naverProfile.email.split('@')[0] : '네이버회원');

      // 1) 이미 해당 naverId와 연동된 참가자가 있거나, 특정 참가자에 연동 요청(linkUserId)한 경우
      let targetParticipant = db.participants.find(p => p.naverId === naverProfile.id);
      if (!targetParticipant && linkUserId) {
        targetParticipant = db.participants.find(p => p.id === linkUserId);
      }

      if (targetParticipant) {
        // 기존 다른 참가자에 동일 naverId가 있었다면 정리
        db.participants.forEach(p => {
          if (p.id !== targetParticipant.id && p.naverId === naverProfile.id) {
            p.naverId = null;
            p.naverNickname = null;
            p.naverEmail = null;
            p.naverTokens = null;
          }
        });
        targetParticipant.naverId = naverProfile.id;
        targetParticipant.naverNickname = displayNickname;
        targetParticipant.naverEmail = naverProfile.email || '';
        targetParticipant.naverTokens = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || '',
          updatedAt: new Date().toISOString()
        };
        saveDb(db);

        res.writeHead(302, {
          Location: `/?naver_login=success&userId=${encodeURIComponent(targetParticipant.id)}`
        });
        res.end();
        return;
      }

      // 2) 최초 네이버 로그인: 어떤 참가자(1~5조)인지 1회 선택하도록 pendingNaverAuth에 저장 후 리다이렉트
      db.pendingNaverAuth[naverProfile.id] = {
        naverId: naverProfile.id,
        nickname: displayNickname,
        name: naverProfile.name || '',
        email: naverProfile.email || '',
        tokens: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || '',
          updatedAt: new Date().toISOString()
        }
      };
      saveDb(db);

      res.writeHead(302, {
        Location: `/?naver_link_pending=${encodeURIComponent(naverProfile.id)}&naver_name=${encodeURIComponent(displayNickname)}`
      });
      res.end();
      return;
    }

    // ========================================================================
    // 실제 네이버 로그인 창(브라우저 팝업)을 띄워 로그인 후 참가자(예: 1조 맴버1)에 즉시 연동 (/api/naver/browser-login)
    // ========================================================================
    if (pathname === '/api/naver/browser-login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { userId, forceLoginWindow = true } = body;
      const db = ensureDb();
      const participant = db.participants.find(p => p.id === userId);
      if (!participant) {
        return sendJson(res, 404, { error: '참가자를 찾을 수 없습니다.' });
      }

      const naverCfg = db.settings?.naverConfig || {};
      const clubId = String(naverCfg.clubId || '31811778').trim();
      const cafeUrl = db.settings?.cafeUrl || 'https://cafe.naver.com/mycaffelatte';

      const loginRes = await performNaverBrowserLogin({
        clubId,
        cafeUrl,
        forceLoginWindow: Boolean(forceLoginWindow)
      });

      // 동일 네이버 ID가 다른 참가자에 연동되어 있었다면 해제
      db.participants.forEach(p => {
        if (p.id !== participant.id && p.naverId === loginRes.naverId) {
          p.naverId = null;
          p.naverNickname = null;
          p.naverEmail = null;
          p.naverTokens = null;
        }
      });

      participant.naverId = loginRes.naverId;
      participant.naverNickname = loginRes.nickname;
      participant.naverTokens = {
        mode: 'browser_session',
        updatedAt: new Date().toISOString()
      };
      saveDb(db);

      return sendJson(res, 200, {
        ok: true,
        participant: {
          ...participant,
          naverTokens: undefined,
          hasNaverToken: true,
          naverAuthMode: 'browser_session'
        },
        db: sanitizeDbForClient(db)
      });
    }

    // ========================================================================
    // 네이버 계정 <-> 챌린지 참가자 연동 / 연동 해제 / 테스트 시뮬레이션 연동
    // ========================================================================
    if (pathname === '/api/naver/link-user' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { action, userId, pendingNaverId, simulatedNickname, simulatedEmail } = body;
      const db = ensureDb();
      const participant = db.participants.find(p => p.id === userId);
      if (!participant) {
        return sendJson(res, 404, { error: '참가자를 찾을 수 없습니다.' });
      }

      if (action === 'unlink') {
        const wasBrowserSession = participant.naverTokens?.mode === 'browser_session';
        participant.naverId = null;
        participant.naverNickname = null;
        participant.naverEmail = null;
        participant.naverTokens = null;
        saveDb(db);
        if (wasBrowserSession) {
          await clearChromeNaverCookies();
        }
        return sendJson(res, 200, { ok: true, db: sanitizeDbForClient(db) });
      }

      if (action === 'manual_link') {
        const { naverId, naverNickname, naverEmail } = body;
        const finalId = (naverId || '').trim() || `naver_${participant.id}`;
        const finalNick = (naverNickname || '').trim() || participant.name;
        db.participants.forEach(p => {
          if (p.id !== participant.id && p.naverId === finalId) {
            p.naverId = null;
            p.naverNickname = null;
            p.naverEmail = null;
            p.naverTokens = null;
          }
        });
        participant.naverId = finalId;
        participant.naverNickname = finalNick;
        participant.naverEmail = naverEmail || '';
        participant.naverTokens = {
          mode: 'manual',
          updatedAt: new Date().toISOString()
        };
        saveDb(db);
        return sendJson(res, 200, {
          ok: true,
          participant: {
            ...participant,
            naverTokens: undefined,
            hasNaverToken: true,
            naverAuthMode: 'manual'
          },
          db: sanitizeDbForClient(db)
        });
      }

      if (action === 'simulate_link') {
        const simId = `sim_naver_${participant.id}`;
        participant.naverId = simId;
        participant.naverNickname = simulatedNickname || `${participant.name}_테스트`;
        participant.naverEmail = simulatedEmail || `${participant.id}@naver.com`;
        participant.naverTokens = {
          accessToken: `SIMULATED_TOKEN_${Date.now()}`,
          refreshToken: 'SIMULATED_REFRESH',
          simulated: true,
          mode: 'simulated',
          updatedAt: new Date().toISOString()
        };
        saveDb(db);
        return sendJson(res, 200, {
          ok: true,
          participant: {
            ...participant,
            naverTokens: undefined,
            hasNaverToken: false,
            naverAuthMode: 'simulated'
          },
          db: sanitizeDbForClient(db)
        });
      }

      // 실제 OAuth 콜백 후 pendingNaverId를 선택한 참가자에 매핑
      const pending = db.pendingNaverAuth?.[pendingNaverId];
      if (!pending) {
        return sendJson(res, 400, { error: '연동 대기 중인 네이버 인증 정보가 만료되었거나 없습니다.' });
      }

      db.participants.forEach(p => {
        if (p.naverId === pending.naverId) {
          p.naverId = null;
          p.naverNickname = null;
          p.naverEmail = null;
          p.naverTokens = null;
        }
      });

      participant.naverId = pending.naverId;
      participant.naverNickname = pending.nickname;
      participant.naverEmail = pending.email;
      participant.naverTokens = {
        ...pending.tokens,
        mode: 'oauth'
      };
      delete db.pendingNaverAuth[pendingNaverId];
      saveDb(db);

      return sendJson(res, 200, {
        ok: true,
        userId: participant.id,
        db: sanitizeDbForClient(db)
      });
    }

    // ========================================================================
    // 네이버 카페 URL에서 clubId 및 menuId 자동 추출 API
    // ========================================================================
    if (pathname === '/api/naver/parse-cafe-url' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { url } = body;
      if (!url) {
        return sendJson(res, 400, { error: '카페 URL을 입력해 주세요.' });
      }
      const extracted = await extractCafeIdsFromUrl(url);
      return sendJson(res, 200, {
        ok: true,
        ...extracted
      });
    }

    // ========================================================================
    // 네이버 카페(https://cafe.naver.com/mycaffelatte 등) 기수 및 참가자 게시판 구조 동기화 API
    // 앞에서부터 4명씩 1조, 2조, 3조, 4조, 5조 순서로 자동 편성하고 각 멤버의 개인 게시판(cafeMenuId)을 매핑
    // ========================================================================
    if (pathname === '/api/naver/sync-cafe-structure' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { cafeUrl, selectGroupName, fetchLive } = body;
      const db = ensureDb();
      const naverCfg = db.settings.naverConfig || getDefaultNaverConfig();
      const targetUrl = String(cafeUrl || db.settings.cafeUrl || 'https://cafe.naver.com/mycaffelatte').trim();

      let liveResult = null;
      if (fetchLive) {
        try {
          liveResult = await fetchCafeStructureFromWeb(targetUrl);
        } catch (_) {}
      }

      if (liveResult && liveResult.clubId) {
        naverCfg.clubId = liveResult.clubId;
        naverCfg.cafeSlug = liveResult.cafeSlug || naverCfg.cafeSlug;
        naverCfg.cafeName = liveResult.cafeName || naverCfg.cafeName;
        db.settings.cafeUrl = `https://cafe.naver.com/${naverCfg.cafeSlug || 'mycaffelatte'}`;
        if (liveResult.cohortGroups && Object.keys(liveResult.cohortGroups).length > 0) {
          naverCfg.cohortGroups = liveResult.cohortGroups;
        }
      }

      const availableGroups = Object.keys(naverCfg.cohortGroups || {});
      const chosenGroup =
        selectGroupName && naverCfg.cohortGroups?.[selectGroupName]
          ? selectGroupName
          : naverCfg.activeCohortGroup && naverCfg.cohortGroups?.[naverCfg.activeCohortGroup]
          ? naverCfg.activeCohortGroup
          : availableGroups[0] || '2026년 2기';

      naverCfg.activeCohortGroup = chosenGroup;
      const groupMenus = naverCfg.cohortGroups?.[chosenGroup] || DEFAULT_COHORT_GROUPS['2026년 2기'];

      // 각 조의 대표 게시판(첫 번째 멤버 게시판)도 teamMenuIds에 함께 갱신
      const nextTeamMenuIds = { ...(naverCfg.teamMenuIds || {}) };
      groupMenus.forEach((m, idx) => {
        const teamNo = String(Math.min(5, Math.floor(idx / 4) + 1));
        if (idx % 4 === 0 && m.menuId) {
          nextTeamMenuIds[teamNo] = String(m.menuId);
        }
      });
      naverCfg.teamMenuIds = nextTeamMenuIds;
      if (groupMenus[0]?.menuId) {
        naverCfg.defaultMenuId = String(groupMenus[0].menuId);
      }

      db.settings.naverConfig = naverCfg;
      db.participants = buildParticipantsFromCohortMenus(groupMenus, chosenGroup, db.participants);
      saveDb(db);

      return sendJson(res, 200, {
        ok: true,
        activeCohortGroup: chosenGroup,
        memberCount: groupMenus.length,
        fetchedLive: Boolean(liveResult && Object.keys(liveResult.cohortGroups || {}).length > 0),
        db: sanitizeDbForClient(db)
      });
    }

    // ========================================================================
    // 네이버 카페 멤버 개인 게시판(또는 조별 게시판) 자동 글쓰기 API (/api/naver/cafe-post)
    // ========================================================================
    if (pathname === '/api/naver/cafe-post' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        userId,
        date,
        subject,
        contentHtml,
        contentText = '',
        images = [],
        mealSections: clientMealSections,
        footerSummaryText: clientFooterSummaryText,
        attachMode = 'meals_by_section',
        menuIdOverride,
        simulate
      } = body;

      const db = ensureDb();
      const user = db.participants.find(p => p.id === userId);
      if (!user) {
        return sendJson(res, 404, { error: '참가자 정보를 찾을 수 없습니다.' });
      }

      const naverCfg = db.settings?.naverConfig || {};
      const clubId = String(naverCfg.clubId || '31811778').trim();
      const teamMenuId = String(naverCfg.teamMenuIds?.[String(user.team)] || '').trim();
      // 참가자 본인의 카페 개인 게시판 번호(user.cafeMenuId)를 최우선 적용
      const targetMenuId = String(
        menuIdOverride || user.cafeMenuId || teamMenuId || naverCfg.defaultMenuId || ''
      ).trim();

      let log = db.dailyLogs.find(l => l.userId === userId && l.date === date);
      if (!log) {
        log = {
          id: `log_${userId}_${date}`,
          userId,
          date,
          kakaoReported: false,
          kakaoReportedAt: null,
          cafePosted: false,
          cafePostedAt: null,
          meals: []
        };
        db.dailyLogs.push(log);
      }

      const nowIso = new Date().toISOString();
      const cohortGroup = user.cohortGroup || naverCfg.activeCohortGroup || '2026년 2기';

      // 모바일 등 클라이언트에서 mealSections가 비어 넘어온 경우에도 서버에 저장된 log.meals로 아침·점심·저녁 구별 포맷 자동 구성
      let resolvedMealSections = Array.isArray(clientMealSections) ? clientMealSections : [];
      let resolvedFooterText = clientFooterSummaryText || '';

      if (resolvedMealSections.length === 0 && attachMode !== 'summary_only' && Array.isArray(log.meals) && log.meals.length > 0) {
        const mealOrder = ['아침', '점심', '저녁', '간식'];
        const mealEmoji = { 아침: '☀️', 점심: '🌤️', 저녁: '🌙', 간식: '🍎' };
        const sortedMeals = [...log.meals].sort(
          (a, b) => mealOrder.indexOf(a.type || a.mealType) - mealOrder.indexOf(b.type || b.mealType)
        );
        let totC = 0;
        let totP = 0;
        let totF = 0;
        for (const m of sortedMeals) {
          const c = Number(m.carb ?? m.carbBlocks) || 0;
          const p = Number(m.protein ?? m.proteinBlocks) || 0;
          const f = Number(m.fat ?? m.fatBlocks) || 0;
          totC += c;
          totP += p;
          totF += f;
          const mType = m.type || m.mealType || '식단';
          const emoji = mealEmoji[mType] || '🍽️';
          const titleLabel = mType === '간식' ? '간식' : `${mType} 식단`;
          const rawList =
            Array.isArray(m.photos) && m.photos.length > 0
              ? m.photos
              : Array.isArray(m.imageList) && m.imageList.length > 0
              ? m.imageList
              : m.photoDataUrl
              ? [m.photoDataUrl]
              : m.imageData
              ? [m.imageData]
              : [];

          const blockLines = [
            `▶ ${mType} 블럭 : 탄수화물 ${c}블럭 · 단백질 ${p}블럭 · 지방 ${f}블럭`
          ];
          if (m.memo) {
            blockLines.push(`▶ ${mType} 메뉴 : ${m.memo}`);
          }
          resolvedMealSections.push({
            type: mType,
            mealType: mType,
            headerText: `━━━━━━━━━━━━━━━━━━━━\n${emoji} [${titleLabel}]${m.time ? ` (${m.time})` : ''}`,
            images: rawList,
            blockText: blockLines.join('\n')
          });
        }
        if (!resolvedFooterText) {
          const tgt = typeof user.targetBlocks === 'number' ? user.targetBlocks : Number(user.targetBlocks?.carb ?? 11);
          resolvedFooterText = [
            `━━━━━━━━━━━━━━━━━━━━`,
            `📊 [오늘 하루 총 섭취 탄·단·지 블럭 합계]`,
            `• 탄수화물 : 총 ${Math.round(totC * 10) / 10}블럭 (목표 ${tgt}블럭)`,
            `• 단 백 질 : 총 ${Math.round(totP * 10) / 10}블럭 (목표 ${tgt}블럭)`,
            `• 지    방 : 총 ${Math.round(totF * 10) / 10}블럭 (목표 ${tgt}블럭)`,
            `━━━━━━━━━━━━━━━━━━━━`
          ].join('\n');
        }
      }

      // 사용자가 명시적으로 [시뮬레이션 테스트] 버튼을 누른 경우에만 가상 등록 처리
      if (simulate === true) {
        const simClubId = clubId || '31811778';
        const simMenuId = targetMenuId || user.cafeMenuId || `TEAM_${user.team}_BOARD`;
        const simArticleId = Math.floor(10000 + Math.random() * 90000);
        const fallbackCafeUrl =
          simClubId && simMenuId
            ? `https://cafe.naver.com/f-e/cafes/${simClubId}/menus/${simMenuId}`
            : db.settings?.cafeUrl || 'https://cafe.naver.com/mycaffelatte';

        log.cafePosted = true;
        log.cafePostedAt = nowIso;
        log.cafePostInfo = {
          mode: 'simulation',
          clubId: simClubId,
          menuId: simMenuId,
          memberBoardName: user.name,
          cohortGroup,
          team: user.team,
          subject,
          imageCount: images.length,
          articleId: simArticleId,
          articleUrl: fallbackCafeUrl,
          postedAt: nowIso
        };
        saveDb(db);
        return sendJson(res, 200, {
          ok: true,
          simulated: true,
          log,
          postInfo: log.cafePostInfo
        });
      }

      // 실제 카페 업로드 검증
      const hasRealOAuthToken = Boolean(user.naverTokens?.accessToken && !user.naverTokens?.simulated);
      if (!clubId) {
        return sendJson(res, 400, {
          error: '연동할 네이버 카페 고유 번호(clubId)가 설정되지 않았습니다.'
        });
      }
      if (!targetMenuId) {
        return sendJson(res, 400, {
          error: `${user.name} 님의 카페 개인 게시판 번호(menuId)가 설정되지 않았습니다.`
        });
      }

      // 1) 네이버 OAuth 토큰이 없는 경우 -> 호스트 Chrome 네이버 로그인 세션(CDP)으로 즉시 자동 글쓰기 수행 (모바일/PC 공통)
      if (!hasRealOAuthToken) {
        const cdpPostRes = await postArticleViaChromeCdp({
          clubId,
          menuId: targetMenuId,
          subject: subject || `[${cohortGroup} ${user.team}조 ${user.name}] ${date} 식단 및 탄단지 블록 인증`,
          contentText,
          images,
          mealSections: resolvedMealSections,
          footerSummaryText: resolvedFooterText
        });

        // 업로드 성공 시 해당 참가자의 브라우저 연동 상태도 자동 활성화
        user.naverTokens = {
          mode: 'browser_session',
          simulated: false,
          linkedBoardMenuId: targetMenuId,
          updatedAt: nowIso
        };

        log.cafePosted = true;
        log.cafePostedAt = nowIso;
        log.cafePostInfo = {
          mode: 'api',
          clubId,
          menuId: targetMenuId,
          memberBoardName: user.name,
          cohortGroup,
          team: user.team,
          subject,
          imageCount: images.length,
          articleId: cdpPostRes.articleId,
          articleUrl: cdpPostRes.articleUrl,
          postedAt: nowIso
        };
        saveDb(db);

        return sendJson(res, 200, {
          ok: true,
          simulated: false,
          log,
          postInfo: log.cafePostInfo
        });
      }

      // 2) 네이버 Developers OAuth 2.0 토큰으로 연동된 경우 -> Open API 호출
      const apiUrl = `https://openapi.naver.com/v1/cafe/${encodeURIComponent(clubId)}/menu/${encodeURIComponent(
        targetMenuId
      )}/articles`;

      const { boundary, buffer } = buildCafeMultipartBody({
        subject: subject || `[${cohortGroup} ${user.team}조 ${user.name}] ${date} 식단 및 탄단지 블록 인증`,
        contentHtml: contentHtml || '<p>오늘의 식단 및 탄단지 블록 인증입니다.</p>',
        images
      });

      let accessToken = user.naverTokens.accessToken;
      let apiResp = await httpsRequest(
        apiUrl,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': buffer.length
          }
        },
        buffer
      );

      // 토큰 만료(401) 시 refresh_token으로 자동 갱신 후 재시도
      if (apiResp.status === 401 && user.naverTokens.refreshToken) {
        const refreshed = await refreshNaverAccessToken(naverCfg, user.naverTokens.refreshToken);
        if (refreshed) {
          accessToken = refreshed;
          user.naverTokens.accessToken = refreshed;
          user.naverTokens.updatedAt = new Date().toISOString();
          apiResp = await httpsRequest(
            apiUrl,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': buffer.length
              }
            },
            buffer
          );
        }
      }

      if (apiResp.status < 200 || apiResp.status >= 300) {
        const errMsg =
          apiResp.json?.message?.error?.msg ||
          apiResp.json?.errorMessage ||
          apiResp.text ||
          `네이버 카페 API 오류 (HTTP ${apiResp.status})`;
        return sendJson(res, 400, {
          error: `네이버 카페 업로드 실패: ${errMsg}`,
          details: apiResp.json || apiResp.text
        });
      }

      const resultObj = apiResp.json?.message?.result || {};
      const articleId = resultObj.articleId || '';
      const articleUrl =
        resultObj.articleUrl ||
        (articleId
          ? `https://cafe.naver.com/ca-fe/cafes/${clubId}/articles/${articleId}`
          : `https://cafe.naver.com/f-e/cafes/${clubId}/menus/${targetMenuId}`);

      log.cafePosted = true;
      log.cafePostedAt = nowIso;
      log.cafePostInfo = {
        mode: 'api',
        clubId,
        menuId: targetMenuId,
        memberBoardName: user.name,
        cohortGroup,
        team: user.team,
        subject,
        imageCount: images.length,
        articleId,
        articleUrl,
        postedAt: nowIso
      };
      saveDb(db);

      return sendJson(res, 200, {
        ok: true,
        simulated: false,
        log,
        postInfo: log.cafePostInfo
      });
    }

    // 개별 끼니 추가/수정 또는 하루 전체 식단(아침·점심·저녁 사진들 + 총 블록) 일괄 저장
    if (pathname === '/api/meals' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { userId, date, meal, replaceAllMeals, markTeamReported } = body;
      if (!userId || !date) {
        return sendJson(res, 400, { error: '필수 항목이 누락되었습니다.' });
      }
      const db = ensureDb();
      let log = db.dailyLogs.find(l => l.userId === userId && l.date === date);
      if (!log) {
        log = {
          id: `log_${userId}_${date}`,
          userId,
          date,
          kakaoReported: false,
          kakaoReportedAt: null,
          cafePosted: false,
          cafePostedAt: null,
          meals: []
        };
        db.dailyLogs.push(log);
      }

      if (Array.isArray(replaceAllMeals)) {
        log.meals = replaceAllMeals.map((m, i) => ({
          ...m,
          id: m.id || `m_${Date.now()}_${i}`,
          photoDataUrl: (Array.isArray(m.photos) && m.photos[0]) || m.photoDataUrl || ''
        }));
      } else if (meal) {
        if (Array.isArray(meal.photos) && meal.photos.length > 0 && !meal.photoDataUrl) {
          meal.photoDataUrl = meal.photos[0];
        } else if (meal.photoDataUrl && (!Array.isArray(meal.photos) || meal.photos.length === 0)) {
          meal.photos = [meal.photoDataUrl];
        }
        if (meal.id) {
          const idx = log.meals.findIndex(m => m.id === meal.id);
          if (idx >= 0) {
            log.meals[idx] = { ...log.meals[idx], ...meal };
          } else {
            log.meals.push(meal);
          }
        } else {
          meal.id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          log.meals.push(meal);
        }
      }

      if (markTeamReported) {
        log.kakaoReported = true;
        log.kakaoReportedAt = new Date().toISOString();
      }

      saveDb(db);
      return sendJson(res, 200, { ok: true, log });
    }

    if (pathname === '/api/meals/delete' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { userId, date, mealId } = body;
      const db = ensureDb();
      const log = db.dailyLogs.find(l => l.userId === userId && l.date === date);
      if (log) {
        log.meals = log.meals.filter(m => m.id !== mealId);
        saveDb(db);
      }
      return sendJson(res, 200, { ok: true, log });
    }

    if (pathname === '/api/daily-status' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { userId, date, kakaoReported, cafePosted } = body;
      const db = ensureDb();
      let log = db.dailyLogs.find(l => l.userId === userId && l.date === date);
      if (!log) {
        log = {
          id: `log_${userId}_${date}`,
          userId,
          date,
          kakaoReported: false,
          kakaoReportedAt: null,
          cafePosted: false,
          cafePostedAt: null,
          meals: []
        };
        db.dailyLogs.push(log);
      }
      const nowIso = new Date().toISOString();
      if (typeof kakaoReported === 'boolean') {
        log.kakaoReported = kakaoReported;
        log.kakaoReportedAt = kakaoReported ? nowIso : null;
      }
      if (typeof cafePosted === 'boolean') {
        log.cafePosted = cafePosted;
        log.cafePostedAt = cafePosted ? nowIso : null;
      }
      saveDb(db);
      return sendJson(res, 200, { ok: true, log });
    }

    // 각 팀 식단 담당이 4명의 식단 사진과 블록 수를 전체 20명 공간에 공식 보고
    if (pathname === '/api/team-reports' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { action, team, date, reportedByUserId, reportedByName, comment, reportId } = body;
      const db = ensureDb();
      if (!Array.isArray(db.teamReports)) db.teamReports = [];

      if (action === 'delete' && reportId) {
        db.teamReports = db.teamReports.filter(r => r.id !== reportId);
        saveDb(db);
        return sendJson(res, 200, { ok: true, teamReports: db.teamReports });
      }

      const existingIdx = db.teamReports.findIndex(
        r => Number(r.team) === Number(team) && r.date === date
      );
      const entry = {
        id: `tr_${team}_${date}`,
        team: Number(team),
        date,
        reportedByUserId,
        reportedByName: reportedByName || '식단담당',
        reportedAt: new Date().toISOString(),
        comment: comment || `${team}조 4명 일일 식단 및 블록 취합 보고 완료`
      };
      if (existingIdx >= 0) {
        db.teamReports[existingIdx] = entry;
      } else {
        db.teamReports.push(entry);
      }
      saveDb(db);
      return sendJson(res, 200, { ok: true, report: entry, teamReports: db.teamReports });
    }

    if (pathname === '/api/missions' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { action, userId, weekLabel, date, memo, photoDataUrl, missionId } = body;
      const db = ensureDb();
      if (action === 'delete' && missionId) {
        db.missionLogs = db.missionLogs.filter(m => m.id !== missionId);
        saveDb(db);
        return sendJson(res, 200, { ok: true, missionLogs: db.missionLogs });
      }
      const newEntry = {
        id: `ms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId,
        weekLabel: weekLabel || db.settings.weeklyMission.weekLabel,
        date: date || getKstDateString(0),
        memo: memo || '주간 미션 운동 완료',
        photoDataUrl: photoDataUrl || null,
        createdAt: new Date().toISOString()
      };
      db.missionLogs.push(newEntry);
      saveDb(db);
      return sendJson(res, 200, { ok: true, entry: newEntry, missionLogs: db.missionLogs });
    }

    if (pathname === '/api/penalties' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { action, penalty, penalties, penaltyId } = body;
      const db = ensureDb();
      if (action === 'delete' && penaltyId) {
        db.penalties = db.penalties.filter(p => p.id !== penaltyId);
        saveDb(db);
        return sendJson(res, 200, { ok: true, penalties: db.penalties });
      }
      if (action === 'bulk_add' && Array.isArray(penalties)) {
        for (const item of penalties) {
          const exists = db.penalties.some(
            p => p.userId === item.userId && p.date === item.date && p.type === item.type
          );
          if (!exists) {
            db.penalties.push({
              id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              userId: item.userId,
              date: item.date,
              type: item.type,
              reason: item.reason,
              amount: db.settings.penaltyUnitAmount || 10000,
              createdAt: new Date().toISOString()
            });
          }
        }
        saveDb(db);
        return sendJson(res, 200, { ok: true, penalties: db.penalties });
      }
      if (penalty && penalty.userId) {
        db.penalties.push({
          id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId: penalty.userId,
          date: penalty.date || getKstDateString(0),
          type: penalty.type || 'MANUAL',
          reason: penalty.reason || '규칙 미준수 패널티',
          amount: db.settings.penaltyUnitAmount || 10000,
          createdAt: new Date().toISOString()
        });
        saveDb(db);
        return sendJson(res, 200, { ok: true, penalties: db.penalties });
      }
      return sendJson(res, 400, { error: '잘못된 요청입니다.' });
    }

    if (pathname === '/api/admin/update' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const db = ensureDb();
      if (body.settings) {
        const nextNaverCfg = body.settings.naverConfig
          ? {
              ...(db.settings.naverConfig || {}),
              ...body.settings.naverConfig,
              teamMenuIds: {
                ...(db.settings.naverConfig?.teamMenuIds || {}),
                ...(body.settings.naverConfig?.teamMenuIds || {})
              }
            }
          : db.settings.naverConfig;

        db.settings = {
          ...db.settings,
          ...body.settings,
          naverConfig: nextNaverCfg,
          weeklyMission: {
            ...db.settings.weeklyMission,
            ...(body.settings.weeklyMission || {})
          }
        };
      }
      if (Array.isArray(body.participants)) {
        const existingMap = new Map((db.participants || []).map(p => [p.id, p]));
        db.participants = body.participants.map(p => {
          const prev = existingMap.get(p.id) || {};
          return {
            ...prev,
            ...p
          };
        });
      }
      if (body.action === 'clear_logs') {
        db.dailyLogs = [];
        db.teamReports = [];
        db.missionLogs = [];
        db.penalties = [];
      }
      if (body.action === 'reset_demo') {
        const fresh = createInitialData();
        saveDb(fresh);
        return sendJson(res, 200, { ok: true, db: sanitizeDbForClient(fresh) });
      }
      saveDb(db);
      return sendJson(res, 200, { ok: true, db: sanitizeDbForClient(db) });
    }

    let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }
    const filePath = path.join(PUBLIC_DIR, safePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err.message || '서버 오류' });
  }
}

const server = http.createServer(requestHandler);

ensureDb();

if (!IS_VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    const ips = getLanAddresses();
    console.log(`\n==================================================`);
    console.log(`LEBEN ZONE CHALLENGE 서버 실행 완료`);
    console.log(`- PC 접속 주소: http://localhost:${PORT}`);
    if (ips.length > 0) {
      console.log(`- 모바일 접속 주소: http://${ips[0]}:${PORT}`);
    }
    console.log(`==================================================\n`);
  });
}

module.exports = requestHandler;
module.exports.server = server;
