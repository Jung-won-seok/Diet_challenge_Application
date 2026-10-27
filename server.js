const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'store.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function getKstDateString(offsetDays = 0) {
  const now = new Date();
  const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return kstTime.toISOString().slice(0, 10);
}

function createSampleFoodSvgDataUrl(title, subtitle, bgStart, bgEnd, emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgStart}"/>
        <stop offset="100%" stop-color="${bgEnd}"/>
      </linearGradient>
    </defs>
    <rect width="480" height="360" rx="24" fill="url(#g)"/>
    <circle cx="240" cy="145" r="74" fill="rgba(255,255,255,0.14)"/>
    <text x="240" y="168" font-size="68" text-anchor="middle">${emoji}</text>
    <text x="240" y="258" font-family="sans-serif" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
    <text x="240" y="294" font-family="sans-serif" font-size="18" fill="rgba(255,255,255,0.85)" text-anchor="middle">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createInitialData() {
  const today = getKstDateString(0);
  const yesterday = getKstDateString(-1);
  const twoDaysAgo = getKstDateString(-2);

  const participants = [
    // 1조 (4명)
    { id: 'u1', name: '김레벤', team: 1, role: '조장', targetBlocks: 14, pin: '1234' },
    { id: 'u2', name: '이존다', team: 1, role: '조원', targetBlocks: 11, pin: '1234' },
    { id: 'u3', name: '박바벨', team: 1, role: '조원', targetBlocks: 14, pin: '1234' },
    { id: 'u4', name: '최와드', team: 1, role: '조원', targetBlocks: 11, pin: '1234' },
    // 2조 (4명)
    { id: 'u5', name: '정스내치', team: 2, role: '조장', targetBlocks: 15, pin: '1234' },
    { id: 'u6', name: '강버피', team: 2, role: '조원', targetBlocks: 11, pin: '1234' },
    { id: 'u7', name: '조케틀벨', team: 2, role: '조원', targetBlocks: 13, pin: '1234' },
    { id: 'u8', name: '윤풀업', team: 2, role: '조원', targetBlocks: 11, pin: '1234' },
    // 3조 (4명)
    { id: 'u9', name: '장클린', team: 3, role: '조장', targetBlocks: 14, pin: '1234' },
    { id: 'u10', name: '임로잉', team: 3, role: '조원', targetBlocks: 11, pin: '1234' },
    { id: 'u11', name: '한박스', team: 3, role: '조원', targetBlocks: 12, pin: '1234' },
    { id: 'u12', name: '오더블', team: 3, role: '조원', targetBlocks: 11, pin: '1234' },
    // 4조 (4명)
    { id: 'u13', name: '서머슬업', team: 4, role: '조장', targetBlocks: 15, pin: '1234' },
    { id: 'u14', name: '신월볼', team: 4, role: '조원', targetBlocks: 11, pin: '1234' },
    { id: 'u15', name: '권데드', team: 4, role: '조원', targetBlocks: 14, pin: '1234' },
    { id: 'u16', name: '황스쿼트', team: 4, role: '조원', targetBlocks: 11, pin: '1234' },
    // 5조 (4명)
    { id: 'u17', name: '안쓰러스터', team: 5, role: '조장', targetBlocks: 14, pin: '1234' },
    { id: 'u18', name: '송토투바', team: 5, role: '조원', targetBlocks: 11, pin: '1234' },
    { id: 'u19', name: '류핸푸', team: 5, role: '조원', targetBlocks: 13, pin: '1234' },
    { id: 'u20', name: '홍어썰트', team: 5, role: '조원', targetBlocks: 11, pin: '1234' }
  ];

  const sampleImg1 = createSampleFoodSvgDataUrl('아침 존다 식단', '닭가슴살 100g · 고구마 120g · 아몬드', '#0f766e', '#115e59', '🥗');
  const sampleImg2 = createSampleFoodSvgDataUrl('점심 클린 도시락', '소고기 우둔살 · 현미밥 · 올리브유 샐러드', '#1d4ed8', '#1e3a8a', '🍱');
  const sampleImg3 = createSampleFoodSvgDataUrl('저녁 운동 후 식단', '연어 스테이크 · 구운 단호박 · 아보카도', '#4338ca', '#312e81', '🥩');
  const sampleImg4 = createSampleFoodSvgDataUrl('간식 블록 보충', '무가당 그릭요거트 · 블루베리 · 호두', '#b45309', '#78350f', '🫐');

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
        { id: 'm1', type: '아침', time: '08:10', carb: 4, protein: 4, fat: 4, memo: '닭가슴살 120g, 고구마 150g, 아몬드 12알', photoDataUrl: sampleImg1 },
        { id: 'm2', type: '점심', time: '12:30', carb: 4, protein: 4, fat: 4, memo: '소고기 우둔살 도시락 + 현미밥 + 샐러드', photoDataUrl: sampleImg2 },
        { id: 'm3', type: '저녁', time: '18:50', carb: 4, protein: 4, fat: 4, memo: '연어 스테이크 + 단호박 + 아보카도', photoDataUrl: sampleImg3 },
        { id: 'm4', type: '간식', time: '20:00', carb: 2, protein: 2, fat: 2, memo: '프로틴 쉐이크 + 사과 반쪽 + 견과류', photoDataUrl: sampleImg4 }
      ]
    },
    {
      id: `log_u2_${today}`,
      userId: 'u2',
      date: today,
      kakaoReported: true,
      kakaoReportedAt: `${today}T21:05:00+09:00`,
      cafePosted: false,
      cafePostedAt: null,
      meals: [
        { id: 'm5', type: '아침', time: '08:40', carb: 3, protein: 3, fat: 3, memo: '계란 3개 + 오트밀 + 땅콩버터', photoDataUrl: sampleImg1 },
        { id: 'm6', type: '점심', time: '13:00', carb: 4, protein: 4, fat: 4, memo: '닭가슴살 포케 (소스 제외)', photoDataUrl: sampleImg2 },
        { id: 'm7', type: '저녁', time: '19:20', carb: 4, protein: 4, fat: 4, memo: '돼지 앞다리살 수육 + 쌈채소 + 현미밥', photoDataUrl: sampleImg3 }
      ]
    },
    {
      id: `log_u3_${today}`,
      userId: 'u3',
      date: today,
      kakaoReported: false,
      kakaoReportedAt: null,
      cafePosted: false,
      cafePostedAt: null,
      meals: [
        { id: 'm8', type: '아침', time: '09:00', carb: 4, protein: 4, fat: 4, memo: '닭가슴살 샐러드 + 호밀빵', photoDataUrl: sampleImg1 },
        { id: 'm9', type: '점심', time: '12:40', carb: 6, protein: 5, fat: 6, memo: '점심 회식 삼겹살 + 냉면 조금', photoDataUrl: sampleImg2 },
        { id: 'm10', type: '저녁', time: '19:30', carb: 5, protein: 4, fat: 5, memo: '저녁 일반식 (목표 14블록 초과!)', photoDataUrl: sampleImg3 }
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
        { id: 'm11', type: '아침', time: '07:50', carb: 5, protein: 5, fat: 5, memo: '아침 든든하게 5블록 정석 식단', photoDataUrl: sampleImg1 },
        { id: 'm12', type: '점심', time: '12:20', carb: 5, protein: 5, fat: 5, memo: '점심 우둔살 볶음밥 5블록', photoDataUrl: sampleImg2 },
        { id: 'm13', type: '저녁', time: '18:40', carb: 5, protein: 5, fat: 5, memo: '저녁 닭안심 구이 5블록 클리어', photoDataUrl: sampleImg3 }
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
        { id: 'm14', type: '아침', time: '08:30', carb: 3.5, protein: 3.5, fat: 3.5, memo: '그릭요거트 + 닭가슴살 소시지', photoDataUrl: sampleImg1 },
        { id: 'm15', type: '점심', time: '12:50', carb: 4, protein: 4, fat: 4, memo: '현미밥 100g + 연어포케', photoDataUrl: sampleImg2 },
        { id: 'm16', type: '저녁', time: '19:10', carb: 3.5, protein: 3.5, fat: 3.5, memo: '고구마 + 계란흰자 + 아몬드', photoDataUrl: sampleImg3 }
      ]
    }
  ];

  const missionLogs = [
    {
      id: 'ms1',
      userId: 'u1',
      weekLabel: '2주차 주간 미션',
      date: today,
      memo: '로잉 2,000m 7분 24초 완료! 댐퍼 5 세팅',
      createdAt: `${today}T18:10:00+09:00`
    },
    {
      id: 'ms2',
      userId: 'u2',
      weekLabel: '2주차 주간 미션',
      date: today,
      memo: '버피 100개 6분 52초 숨차 죽는줄 알았습니다🔥',
      createdAt: `${today}T19:00:00+09:00`
    },
    {
      id: 'ms3',
      userId: 'u5',
      weekLabel: '2주차 주간 미션',
      date: yesterday,
      memo: '수업 끝나고 로잉 2,000m 7분 08초 인증 완료',
      createdAt: `${yesterday}T21:15:00+09:00`
    },
    {
      id: 'ms4',
      userId: 'u9',
      weekLabel: '2주차 주간 미션',
      date: yesterday,
      memo: '오픈짐 버피 100개 완주 인증!',
      createdAt: `${yesterday}T20:40:00+09:00`
    },
    {
      id: 'ms5',
      userId: 'u13',
      weekLabel: '2주차 주간 미션',
      date: today,
      memo: '로잉 2000m 7분 35초 인증합니다',
      createdAt: `${today}T17:30:00+09:00`
    }
  ];

  const penalties = [
    {
      id: 'p1',
      userId: 'u3',
      date: twoDaysAgo,
      type: 'OVER_BLOCK',
      reason: '하루 목표 블록 초과 섭취 (탄수화물 16.5 / 목표 14블록)',
      amount: 10000,
      createdAt: `${twoDaysAgo}T23:59:00+09:00`
    },
    {
      id: 'p2',
      userId: 'u4',
      date: yesterday,
      type: 'NO_CAFE',
      reason: '밤 12시 전 네이버 카페 식단 게시글 미작성 (12:18 지각 업로드)',
      amount: 10000,
      createdAt: `${yesterday}T23:59:00+09:00`
    },
    {
      id: 'p3',
      userId: 'u8',
      date: twoDaysAgo,
      type: 'NO_KAKAO',
      reason: '밤 12시 전 2조 단톡방 식단 미보고',
      amount: 10000,
      createdAt: `${twoDaysAgo}T23:59:00+09:00`
    },
    {
      id: 'p4',
      userId: 'u8',
      date: yesterday,
      type: 'NO_MISSION',
      reason: '1주차 주간 미션 운동 미수행',
      amount: 10000,
      createdAt: `${yesterday}T23:59:00+09:00`
    },
    {
      id: 'p5',
      userId: 'u12',
      date: yesterday,
      type: 'OVER_BLOCK',
      reason: '하루 목표 블록 초과 섭취 (지방 14 / 목표 11블록)',
      amount: 10000,
      createdAt: `${yesterday}T23:59:00+09:00`
    },
    {
      id: 'p6',
      userId: 'u16',
      date: yesterday,
      type: 'NO_CAFE',
      reason: '밤 12시 전 네이버 카페 식단 인증 미작성',
      amount: 10000,
      createdAt: `${yesterday}T23:59:00+09:00`
    }
  ];

  return {
    settings: {
      challengeName: '크로스핏 레벤 존다 챌린지',
      boxName: 'CrossFit LEBEN',
      startDate: getKstDateString(-8),
      endDate: getKstDateString(19),
      penaltyUnitAmount: 10000,
      maxPenaltyCount: 10,
      adminPin: '0000',
      cafeUrl: 'https://cafe.naver.com/',
      weeklyMission: {
        weekLabel: '2주차 주간 미션',
        title: '로잉 2,000m 타기 또는 버피 100개 완주',
        description: '일요일 밤 12시 전까지 로잉 2,000m 기록 화면 또는 버피 100개 완료 인증을 등록해주세요. 주간 미션 미이행 시 패널티 1회(1만원)가 부여됩니다.',
        deadlineDay: '일요일 24:00 마감'
      }
    },
    participants,
    dailyLogs,
    missionLogs,
    penalties
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial = createInitialData();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    const fallback = createInitialData();
    fs.writeFileSync(DB_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function saveDb(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
      if (body.length > 25 * 1024 * 1024) {
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

function sendJson(res, status, payload) {
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

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // API Endpoints
    if (pathname === '/api/state' && req.method === 'GET') {
      const db = ensureDb();
      return sendJson(res, 200, {
        ...db,
        serverInfo: {
          todayKst: getKstDateString(0),
          lanIps: getLanAddresses(),
          port: PORT
        }
      });
    }

    // Add or update a meal entry for a user on a date
    if (pathname === '/api/meals' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { userId, date, meal } = body;
      if (!userId || !date || !meal) {
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
      saveDb(db);
      return sendJson(res, 200, { ok: true, log });
    }

    // Delete a meal entry
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

    // Update daily certification check (KakaoTalk / Naver Cafe report status)
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

    // Add or delete weekly mission certification
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
        memo: memo || '주간 미션 운동 완료!',
        photoDataUrl: photoDataUrl || null,
        createdAt: new Date().toISOString()
      };
      db.missionLogs.push(newEntry);
      saveDb(db);
      return sendJson(res, 200, { ok: true, entry: newEntry, missionLogs: db.missionLogs });
    }

    // Manage penalties (add, bulk-add, delete)
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

    // Update participants or settings (Admin)
    if (pathname === '/api/admin/update' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const db = ensureDb();
      if (body.settings) {
        db.settings = {
          ...db.settings,
          ...body.settings,
          weeklyMission: {
            ...db.settings.weeklyMission,
            ...(body.settings.weeklyMission || {})
          }
        };
      }
      if (Array.isArray(body.participants)) {
        db.participants = body.participants;
      }
      if (body.action === 'clear_logs') {
        db.dailyLogs = [];
        db.missionLogs = [];
        db.penalties = [];
      }
      if (body.action === 'reset_demo') {
        const fresh = createInitialData();
        saveDb(fresh);
        return sendJson(res, 200, { ok: true, db: fresh });
      }
      saveDb(db);
      return sendJson(res, 200, { ok: true, db });
    }

    // Serve static files from /public
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

    // Fallback to index.html for SPA
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
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLanAddresses();
  console.log(`\n==================================================`);
  console.log(`🏋️ 크로스핏 레벤 존다 챌린지 웹앱 서버 실행 완료!`);
  console.log(`- PC 접속 주소: http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`- 같은 와이파이(모바일) 접속 주소: http://${ips[0]}:${PORT}`);
  }
  console.log(`==================================================\n`);
});
