const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const SCHEMA_SQL_PATH = path.join(__dirname, '..', 'supabase', 'schema.sql');
const ENV_LOCAL_PATH = path.join(__dirname, '..', '.env.local');
const RUNTIME_CFG_PATH = process.env.VERCEL
  ? path.join('/tmp', 'leben-data', 'supabase-config.json')
  : path.join(__dirname, '..', 'data', 'supabase-config.json');

// .env.local 파일이 존재하면 환경변수로 자동 로드 (로컬 개발 편의)
function loadEnvLocalFile() {
  try {
    if (!fs.existsSync(ENV_LOCAL_PATH)) return;
    const raw = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key] && val) {
        process.env[key] = val;
      }
    }
  } catch (_) {}
}

loadEnvLocalFile();

function loadRuntimeConfig() {
  try {
    if (fs.existsSync(RUNTIME_CFG_PATH)) {
      return JSON.parse(fs.readFileSync(RUNTIME_CFG_PATH, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function saveRuntimeConfig(cfg) {
  try {
    const dir = path.dirname(RUNTIME_CFG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(RUNTIME_CFG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.warn('[SupabaseDB] 런타임 설정 저장 경고:', err.message);
  }
}

function resolveCredentials() {
  loadEnvLocalFile();
  const rt = loadRuntimeConfig();

  const supabaseUrl = (
    rt.supabaseUrl ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const supabaseKey = (
    rt.supabaseServiceKey ||
    rt.supabaseAnonKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const databaseUrl = (
    rt.databaseUrl ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.SUPABASE_DB_URL ||
    ''
  ).trim();

  return {
    supabaseUrl,
    supabaseKey,
    databaseUrl,
    hasRest: Boolean(supabaseUrl && supabaseKey),
    hasPg: Boolean(databaseUrl),
    isConfigured: Boolean((supabaseUrl && supabaseKey) || databaseUrl)
  };
}

let pgPool = null;
let pgPoolConnStr = '';
let supabaseClient = null;
let supabaseClientKey = '';
let schemaInitialized = false;
let lastSyncError = null;

function sanitizePgConnectionString(rawUrl) {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('supa');
    return u.toString();
  } catch (_) {
    return rawUrl.replace(/([?&])sslmode=[^&]+(&?)/gi, '$1').replace(/[?&]$/, '');
  }
}

function getPgPool() {
  const { databaseUrl } = resolveCredentials();
  if (!databaseUrl) return null;
  if (pgPool && pgPoolConnStr === databaseUrl) return pgPool;

  if (pgPool) {
    pgPool.end().catch(() => {});
  }
  pgPoolConnStr = databaseUrl;
  const cleanConnStr = sanitizePgConnectionString(databaseUrl);
  pgPool = new Pool({
    connectionString: cleanConnStr,
    ssl: cleanConnStr.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000
  });
  return pgPool;
}

function getSupabaseClient() {
  const { supabaseUrl, supabaseKey } = resolveCredentials();
  if (!supabaseUrl || !supabaseKey) return null;
  const cacheKey = `${supabaseUrl}::${supabaseKey}`;
  if (supabaseClient && supabaseClientKey === cacheKey) return supabaseClient;

  supabaseClientKey = cacheKey;
  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return supabaseClient;
}

// base64 데이터 URL 파싱
function parseBase64Image(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return null;
  }
  // SVG 샘플 데이터 URL은 용량이 작고 벡터이므로 그대로 유지 가능하지만 PNG/JPEG는 Storage 업로드
  if (dataUrl.startsWith('data:image/svg+xml')) {
    return null;
  }
  const match = dataUrl.match(/^data:(image\/([a-zA-Z0-9+.-]+));base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const rawExt = match[2].toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const buffer = Buffer.from(match[3], 'base64');
  return { mimeType, ext, buffer };
}

// 식단 사진을 Supabase Storage ('meal-photos' 버킷)에 업로드하고 Public CDN URL 반환
async function uploadMealImageIfNeeded(imgSrc, { userId, date, mealId, index = 0 }) {
  if (!imgSrc || typeof imgSrc !== 'string') return imgSrc;
  // 이미 http/https URL이거나 SVG 샘플이면 그대로 반환
  if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://') || imgSrc.startsWith('data:image/svg+xml')) {
    return imgSrc;
  }

  const client = getSupabaseClient();
  if (!client) return imgSrc;

  const parsed = parseBase64Image(imgSrc);
  if (!parsed) return imgSrc;

  try {
    const filePath = `${userId || 'user'}/${date || 'date'}/${mealId || Date.now()}_${index}.${parsed.ext}`;
    const { error } = await client.storage.from('meal-photos').upload(filePath, parsed.buffer, {
      contentType: parsed.mimeType,
      upsert: true
    });
    if (error) {
      // 버킷이 아직 없으면 생성 시도 후 재업로드
      if (error.message && (error.message.includes('not found') || error.message.includes('Bucket'))) {
        await client.storage.createBucket('meal-photos', { public: true }).catch(() => {});
        const retry = await client.storage.from('meal-photos').upload(filePath, parsed.buffer, {
          contentType: parsed.mimeType,
          upsert: true
        });
        if (retry.error) return imgSrc;
      } else {
        return imgSrc;
      }
    }
    const { data: pubData } = client.storage.from('meal-photos').getPublicUrl(filePath);
    if (pubData && pubData.publicUrl) {
      return pubData.publicUrl;
    }
  } catch (err) {
    console.warn('[SupabaseStorage] 이미지 업로드 폴백(base64 유지):', err.message);
  }
  return imgSrc;
}

// PostgreSQL 연결이 있을 때 자동으로 7개 테이블 및 인덱스 생성
async function ensureSchemaViaPg() {
  const pool = getPgPool();
  if (!pool) return false;
  try {
    const sqlText = fs.readFileSync(SCHEMA_SQL_PATH, 'utf8');
    await pool.query(sqlText);
    schemaInitialized = true;
    return true;
  } catch (err) {
    // storage.buckets 권한이 없는 일반 Postgres일 경우 storage 구문만 제외하고 재실행
    try {
      const sqlText = fs.readFileSync(SCHEMA_SQL_PATH, 'utf8');
      const withoutStorage = sqlText.replace(/INSERT INTO storage\.buckets[\s\S]*$/i, '');
      await pool.query(withoutStorage);
      schemaInitialized = true;
      return true;
    } catch (innerErr) {
      lastSyncError = innerErr.message;
      console.warn('[SupabaseDB] 스키마 자동 생성 경고:', innerErr.message);
      return false;
    }
  }
}

// DB 객체(JSON 구조)를 정규화된 7개 테이블에서 읽어와 조립
async function loadStateFromSupabase(fallbackDb) {
  const creds = resolveCredentials();
  if (!creds.isConfigured) return null;

  // 1) PostgreSQL 직접 연결(pgPool) 우선 사용
  const pool = getPgPool();
  if (pool) {
    try {
      if (!schemaInitialized) {
        await ensureSchemaViaPg();
      }
      const [
        settingsRes,
        participantsRes,
        dailyLogsRes,
        mealsRes,
        teamReportsRes,
        missionLogsRes,
        penaltiesRes
      ] = await Promise.all([
        pool.query(`SELECT * FROM public.app_settings WHERE id = 'default' LIMIT 1`),
        pool.query(`SELECT * FROM public.participants ORDER BY order_in_cohort ASC, id ASC`),
        pool.query(`SELECT * FROM public.daily_logs ORDER BY log_date DESC`),
        pool.query(`SELECT * FROM public.meals ORDER BY sort_order ASC, created_at ASC`),
        pool.query(`SELECT * FROM public.team_reports ORDER BY report_date DESC`),
        pool.query(`SELECT * FROM public.mission_logs ORDER BY created_at DESC`),
        pool.query(`SELECT * FROM public.penalties ORDER BY penalty_date DESC`)
      ]);

      // 아직 초기 데이터가 전혀 없는 빈 DB라면 fallbackDb로 즉시 시딩(Seeding)
      if (participantsRes.rows.length === 0 && fallbackDb) {
        await syncStateToSupabase(fallbackDb);
        return fallbackDb;
      }

      lastSyncError = null;
      return assembleStateFromRows({
        settingsRow: settingsRes.rows[0],
        participantRows: participantsRes.rows,
        dailyLogRows: dailyLogsRes.rows,
        mealRows: mealsRes.rows,
        teamReportRows: teamReportsRes.rows,
        missionLogRows: missionLogsRes.rows,
        penaltyRows: penaltiesRes.rows,
        fallbackDb
      });
    } catch (err) {
      lastSyncError = err.message;
      console.warn('[SupabaseDB] PG 데이터 로드 실패, REST 또는 로컬 폴백 시도:', err.message);
    }
  }

  // 2) Supabase REST Client (@supabase/supabase-js) 사용
  const client = getSupabaseClient();
  if (client) {
    try {
      const [
        settingsRes,
        participantsRes,
        dailyLogsRes,
        mealsRes,
        teamReportsRes,
        missionLogsRes,
        penaltiesRes
      ] = await Promise.all([
        client.from('app_settings').select('*').eq('id', 'default').maybeSingle(),
        client.from('participants').select('*').order('order_in_cohort', { ascending: true }),
        client.from('daily_logs').select('*').order('log_date', { ascending: false }),
        client.from('meals').select('*').order('sort_order', { ascending: true }),
        client.from('team_reports').select('*').order('report_date', { ascending: false }),
        client.from('mission_logs').select('*').order('created_at', { ascending: false }),
        client.from('penalties').select('*').order('penalty_date', { ascending: false })
      ]);

      if (participantsRes.error) {
        lastSyncError = participantsRes.error.message;
        return null;
      }

      if ((!participantsRes.data || participantsRes.data.length === 0) && fallbackDb) {
        await syncStateToSupabase(fallbackDb);
        return fallbackDb;
      }

      lastSyncError = null;
      return assembleStateFromRows({
        settingsRow: settingsRes.data,
        participantRows: participantsRes.data || [],
        dailyLogRows: dailyLogsRes.data || [],
        mealRows: mealsRes.data || [],
        teamReportRows: teamReportsRes.data || [],
        missionLogRows: missionLogsRes.data || [],
        penaltyRows: penaltiesRes.data || [],
        fallbackDb
      });
    } catch (err) {
      lastSyncError = err.message;
      console.warn('[SupabaseDB] REST 데이터 로드 경고:', err.message);
    }
  }

  return null;
}

function assembleStateFromRows({
  settingsRow,
  participantRows,
  dailyLogRows,
  mealRows,
  teamReportRows,
  missionLogRows,
  penaltyRows,
  fallbackDb
}) {
  const defSettings = fallbackDb?.settings || {};
  const settings = settingsRow
    ? {
        challengeName: settingsRow.challenge_name || defSettings.challengeName || 'LEBEN ZONE CHALLENGE',
        boxName: settingsRow.box_name || defSettings.boxName || 'CrossFit LEBEN',
        startDate: settingsRow.start_date || defSettings.startDate,
        endDate: settingsRow.end_date || defSettings.endDate,
        penaltyUnitAmount: Number(settingsRow.penalty_unit_amount ?? defSettings.penaltyUnitAmount ?? 10000),
        maxPenaltyCount: Number(settingsRow.max_penalty_count ?? defSettings.maxPenaltyCount ?? 10),
        adminPin: settingsRow.admin_pin || defSettings.adminPin || '0000',
        cafeUrl: settingsRow.cafe_url || defSettings.cafeUrl || 'https://cafe.naver.com/mycaffelatte',
        naverConfig:
          settingsRow.naver_config && Object.keys(settingsRow.naver_config).length > 0
            ? settingsRow.naver_config
            : defSettings.naverConfig || {},
        weeklyMission:
          settingsRow.weekly_mission && Object.keys(settingsRow.weekly_mission).length > 0
            ? settingsRow.weekly_mission
            : defSettings.weeklyMission || {}
      }
    : defSettings;

  const participants = (participantRows || []).map(r => ({
    id: r.id,
    name: r.name,
    team: Number(r.team) || 1,
    role: r.role || '조원',
    targetBlocks: typeof r.target_blocks === 'number' ? r.target_blocks : Number(r.target_blocks) || 11,
    pin: r.pin || '1234',
    cafeMenuId: r.cafe_menu_id || '',
    cohortGroup: r.cohort_group || '2026년 2기',
    orderInCohort: Number(r.order_in_cohort) || 1,
    naverId: r.naver_id || undefined,
    naverNickname: r.naver_nickname || undefined,
    naverTokens: r.naver_tokens || undefined
  }));

  const mealsByLogId = new Map();
  for (const m of mealRows || []) {
    const logId = m.daily_log_id;
    if (!mealsByLogId.has(logId)) {
      mealsByLogId.set(logId, []);
    }
    const imgList = Array.isArray(m.image_list)
      ? m.image_list
      : m.image_data
      ? [m.image_data]
      : [];
    const primaryPhoto = m.image_data || imgList[0] || '';
    const carbVal = Number(m.carb_blocks) || 0;
    const proteinVal = Number(m.protein_blocks) || 0;
    const fatVal = Number(m.fat_blocks) || 0;
    mealsByLogId.get(logId).push({
      id: m.id,
      type: m.meal_type || '아침',
      mealType: m.meal_type || '아침',
      time: m.meal_time || '',
      carb: carbVal,
      carbBlocks: carbVal,
      protein: proteinVal,
      proteinBlocks: proteinVal,
      fat: fatVal,
      fatBlocks: fatVal,
      memo: m.memo || '',
      photoDataUrl: primaryPhoto,
      photos: imgList,
      imageData: primaryPhoto,
      imageList: imgList
    });
  }

  const dailyLogs = (dailyLogRows || []).map(l => ({
    id: l.id,
    userId: l.user_id,
    date: l.log_date,
    kakaoReported: Boolean(l.kakao_reported),
    kakaoReportedAt: l.kakao_reported_at || null,
    cafePosted: Boolean(l.cafe_posted),
    cafePostedAt: l.cafe_posted_at || null,
    cafePostInfo: l.cafe_post_info || undefined,
    meals: mealsByLogId.get(l.id) || []
  }));

  const teamReports = (teamReportRows || []).map(tr => ({
    id: tr.id,
    team: Number(tr.team) || 1,
    date: tr.report_date,
    reportedByUserId: tr.reported_by_user_id,
    reportedByName: tr.reported_by_name,
    comment: tr.comment || '',
    reportedAt: tr.reported_at
  }));

  const missionLogs = (missionLogRows || []).map(ms => ({
    id: ms.id,
    userId: ms.user_id,
    weekLabel: ms.week_label,
    date: ms.mission_date,
    memo: ms.memo || '',
    createdAt: ms.created_at
  }));

  const penalties = (penaltyRows || []).map(p => ({
    id: p.id,
    userId: p.user_id,
    date: p.penalty_date,
    type: p.type,
    reason: p.reason,
    amount: Number(p.amount) || 10000,
    createdAt: p.created_at
  }));

  return {
    settings,
    participants,
    dailyLogs,
    teamReports,
    missionLogs,
    penalties,
    pendingNaverAuth: settingsRow?.pending_naver_auth || fallbackDb?.pendingNaverAuth || {}
  };
}

// 애플리케이션 상태(db)를 정규화된 7개 Supabase 테이블 + Storage에 동기화 저장
async function syncStateToSupabase(db) {
  const creds = resolveCredentials();
  if (!creds.isConfigured || !db) return { ok: false, reason: 'not_configured' };

  // 0) 식단 사진들 중 새 base64 이미지가 있고 Supabase Storage가 활성화되어 있으면 Storage에 업로드 후 URL로 치환
  if (creds.hasRest && Array.isArray(db.dailyLogs)) {
    for (const log of db.dailyLogs) {
      if (!Array.isArray(log.meals)) continue;
      for (const meal of log.meals) {
        const rawPhotos =
          Array.isArray(meal.photos) && meal.photos.length > 0
            ? meal.photos
            : Array.isArray(meal.imageList) && meal.imageList.length > 0
            ? meal.imageList
            : meal.photoDataUrl
            ? [meal.photoDataUrl]
            : meal.imageData
            ? [meal.imageData]
            : [];

        if (rawPhotos.length > 0) {
          const uploadedList = [];
          for (let idx = 0; idx < rawPhotos.length; idx++) {
            const url = await uploadMealImageIfNeeded(rawPhotos[idx], {
              userId: log.userId,
              date: log.date,
              mealId: meal.id,
              index: idx
            });
            uploadedList.push(url);
          }
          meal.photos = uploadedList;
          meal.imageList = uploadedList;
          meal.photoDataUrl = uploadedList[0] || '';
          meal.imageData = uploadedList[0] || '';
        }
      }
    }
  }

  const s = db.settings || {};
  const settingsRow = {
    id: 'default',
    challenge_name: s.challengeName || 'LEBEN ZONE CHALLENGE',
    box_name: s.boxName || 'CrossFit LEBEN',
    start_date: s.startDate || null,
    end_date: s.endDate || null,
    penalty_unit_amount: Number(s.penaltyUnitAmount ?? 10000),
    max_penalty_count: Number(s.maxPenaltyCount ?? 10),
    admin_pin: s.adminPin || '0000',
    cafe_url: s.cafeUrl || 'https://cafe.naver.com/mycaffelatte',
    naver_config: s.naverConfig || {},
    weekly_mission: s.weeklyMission || {},
    pending_naver_auth: db.pendingNaverAuth || {},
    updated_at: new Date().toISOString()
  };

  const participantRows = (db.participants || []).map((p, idx) => ({
    id: String(p.id),
    name: p.name || `맴버${idx + 1}`,
    team: Number(p.team) || 1,
    role: p.role || '조원',
    target_blocks: p.targetBlocks ?? 11,
    pin: p.pin || '1234',
    cafe_menu_id: p.cafeMenuId ? String(p.cafeMenuId) : null,
    cohort_group: p.cohortGroup || '2026년 2기',
    order_in_cohort: Number(p.orderInCohort) || idx + 1,
    naver_id: p.naverId || null,
    naver_nickname: p.naverNickname || null,
    naver_tokens: p.naverTokens || null,
    updated_at: new Date().toISOString()
  }));

  const dailyLogRows = [];
  const mealRows = [];
  for (const l of db.dailyLogs || []) {
    const logId = l.id || `log_${l.userId}_${l.date}`;
    dailyLogRows.push({
      id: logId,
      user_id: l.userId,
      log_date: l.date,
      kakao_reported: Boolean(l.kakaoReported),
      kakao_reported_at: l.kakaoReportedAt || null,
      cafe_posted: Boolean(l.cafePosted),
      cafe_posted_at: l.cafePostedAt || null,
      cafe_post_info: l.cafePostInfo || null,
      updated_at: new Date().toISOString()
    });

    (l.meals || []).forEach((m, idx) => {
      const imgList =
        Array.isArray(m.photos) && m.photos.length > 0
          ? m.photos
          : Array.isArray(m.imageList) && m.imageList.length > 0
          ? m.imageList
          : m.photoDataUrl
          ? [m.photoDataUrl]
          : m.imageData
          ? [m.imageData]
          : [];
      const primaryImg = m.photoDataUrl || m.imageData || imgList[0] || '';
      mealRows.push({
        id: m.id || `m_${logId}_${idx}`,
        daily_log_id: logId,
        user_id: l.userId,
        log_date: l.date,
        meal_type: m.type || m.mealType || '아침',
        meal_time: m.time || '',
        carb_blocks: Number(m.carb ?? m.carbBlocks) || 0,
        protein_blocks: Number(m.protein ?? m.proteinBlocks) || 0,
        fat_blocks: Number(m.fat ?? m.fatBlocks) || 0,
        memo: m.memo || '',
        image_data: primaryImg,
        image_list: imgList,
        sort_order: idx
      });
    });
  }

  const teamReportRows = (db.teamReports || []).map(tr => ({
    id: tr.id || `tr_${tr.team}_${tr.date}`,
    team: Number(tr.team) || 1,
    report_date: tr.date,
    reported_by_user_id: tr.reportedByUserId || null,
    reported_by_name: tr.reportedByName || '',
    comment: tr.comment || '',
    reported_at: tr.reportedAt || new Date().toISOString()
  }));

  const missionLogRows = (db.missionLogs || []).map(ms => ({
    id: ms.id,
    user_id: ms.userId,
    week_label: ms.weekLabel || 'WEEK 1',
    mission_date: ms.date,
    memo: ms.memo || '',
    created_at: ms.createdAt || new Date().toISOString()
  }));

  const penaltyRows = (db.penalties || []).map(p => ({
    id: p.id,
    user_id: p.userId,
    penalty_date: p.date,
    type: p.type || 'MANUAL',
    reason: p.reason || '',
    amount: Number(p.amount) || 10000,
    created_at: p.createdAt || new Date().toISOString()
  }));

  // 1) PostgreSQL Pool 트랜잭션 동기화
  const pool = getPgPool();
  if (pool) {
    let client;
    try {
      if (!schemaInitialized) {
        await ensureSchemaViaPg();
      }
      client = await pool.connect();
      await client.query('BEGIN');

      // app_settings upsert
      await client.query(
        `INSERT INTO public.app_settings (
          id, challenge_name, box_name, start_date, end_date,
          penalty_unit_amount, max_penalty_count, admin_pin, cafe_url,
          naver_config, weekly_mission, pending_naver_auth, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
        ON CONFLICT (id) DO UPDATE SET
          challenge_name = EXCLUDED.challenge_name,
          box_name = EXCLUDED.box_name,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          penalty_unit_amount = EXCLUDED.penalty_unit_amount,
          max_penalty_count = EXCLUDED.max_penalty_count,
          admin_pin = EXCLUDED.admin_pin,
          cafe_url = EXCLUDED.cafe_url,
          naver_config = EXCLUDED.naver_config,
          weekly_mission = EXCLUDED.weekly_mission,
          pending_naver_auth = EXCLUDED.pending_naver_auth,
          updated_at = NOW()`,
        [
          settingsRow.id,
          settingsRow.challenge_name,
          settingsRow.box_name,
          settingsRow.start_date,
          settingsRow.end_date,
          settingsRow.penalty_unit_amount,
          settingsRow.max_penalty_count,
          settingsRow.admin_pin,
          settingsRow.cafe_url,
          JSON.stringify(settingsRow.naver_config),
          JSON.stringify(settingsRow.weekly_mission),
          JSON.stringify(settingsRow.pending_naver_auth)
        ]
      );

      // participants upsert
      for (const p of participantRows) {
        await client.query(
          `INSERT INTO public.participants (
            id, name, team, role, target_blocks, pin,
            cafe_menu_id, cohort_group, order_in_cohort,
            naver_id, naver_nickname, naver_tokens, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            team = EXCLUDED.team,
            role = EXCLUDED.role,
            target_blocks = EXCLUDED.target_blocks,
            pin = EXCLUDED.pin,
            cafe_menu_id = EXCLUDED.cafe_menu_id,
            cohort_group = EXCLUDED.cohort_group,
            order_in_cohort = EXCLUDED.order_in_cohort,
            naver_id = EXCLUDED.naver_id,
            naver_nickname = EXCLUDED.naver_nickname,
            naver_tokens = EXCLUDED.naver_tokens,
            updated_at = NOW()`,
          [
            p.id,
            p.name,
            p.team,
            p.role,
            JSON.stringify(p.target_blocks),
            p.pin,
            p.cafe_menu_id,
            p.cohort_group,
            p.order_in_cohort,
            p.naver_id,
            p.naver_nickname,
            p.naver_tokens ? JSON.stringify(p.naver_tokens) : null
          ]
        );
      }

      // daily_logs upsert
      for (const l of dailyLogRows) {
        await client.query(
          `INSERT INTO public.daily_logs (
            id, user_id, log_date, kakao_reported, kakao_reported_at,
            cafe_posted, cafe_posted_at, cafe_post_info, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
          ON CONFLICT (id) DO UPDATE SET
            kakao_reported = EXCLUDED.kakao_reported,
            kakao_reported_at = EXCLUDED.kakao_reported_at,
            cafe_posted = EXCLUDED.cafe_posted,
            cafe_posted_at = EXCLUDED.cafe_posted_at,
            cafe_post_info = EXCLUDED.cafe_post_info,
            updated_at = NOW()`,
          [
            l.id,
            l.user_id,
            l.log_date,
            l.kakao_reported,
            l.kakao_reported_at,
            l.cafe_posted,
            l.cafe_posted_at,
            l.cafe_post_info ? JSON.stringify(l.cafe_post_info) : null
          ]
        );
      }

      // 삭제된 식단 반영을 위해 현재 meal id 목록 외 삭제 후 upsert
      const mealIds = mealRows.map(m => m.id);
      if (mealIds.length > 0) {
        await client.query(`DELETE FROM public.meals WHERE NOT (id = ANY($1::text[]))`, [mealIds]);
      } else {
        await client.query(`DELETE FROM public.meals`);
      }

      for (const m of mealRows) {
        await client.query(
          `INSERT INTO public.meals (
            id, daily_log_id, user_id, log_date, meal_type, meal_time,
            carb_blocks, protein_blocks, fat_blocks, memo, image_data, image_list, sort_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (id) DO UPDATE SET
            meal_type = EXCLUDED.meal_type,
            meal_time = EXCLUDED.meal_time,
            carb_blocks = EXCLUDED.carb_blocks,
            protein_blocks = EXCLUDED.protein_blocks,
            fat_blocks = EXCLUDED.fat_blocks,
            memo = EXCLUDED.memo,
            image_data = EXCLUDED.image_data,
            image_list = EXCLUDED.image_list,
            sort_order = EXCLUDED.sort_order`,
          [
            m.id,
            m.daily_log_id,
            m.user_id,
            m.log_date,
            m.meal_type,
            m.meal_time,
            m.carb_blocks,
            m.protein_blocks,
            m.fat_blocks,
            m.memo,
            m.image_data,
            JSON.stringify(m.image_list),
            m.sort_order
          ]
        );
      }

      // team_reports
      for (const tr of teamReportRows) {
        await client.query(
          `INSERT INTO public.team_reports (
            id, team, report_date, reported_by_user_id, reported_by_name, comment, reported_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (id) DO UPDATE SET
            reported_by_user_id = EXCLUDED.reported_by_user_id,
            reported_by_name = EXCLUDED.reported_by_name,
            comment = EXCLUDED.comment,
            reported_at = EXCLUDED.reported_at`,
          [
            tr.id,
            tr.team,
            tr.report_date,
            tr.reported_by_user_id,
            tr.reported_by_name,
            tr.comment,
            tr.reported_at
          ]
        );
      }

      // mission_logs
      const msIds = missionLogRows.map(m => m.id);
      if (msIds.length > 0) {
        await client.query(`DELETE FROM public.mission_logs WHERE NOT (id = ANY($1::text[]))`, [msIds]);
      } else {
        await client.query(`DELETE FROM public.mission_logs`);
      }
      for (const ms of missionLogRows) {
        await client.query(
          `INSERT INTO public.mission_logs (id, user_id, week_label, mission_date, memo, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO UPDATE SET memo = EXCLUDED.memo`,
          [ms.id, ms.user_id, ms.week_label, ms.mission_date, ms.memo, ms.created_at]
        );
      }

      // penalties
      const penIds = penaltyRows.map(p => p.id);
      if (penIds.length > 0) {
        await client.query(`DELETE FROM public.penalties WHERE NOT (id = ANY($1::text[]))`, [penIds]);
      } else {
        await client.query(`DELETE FROM public.penalties`);
      }
      for (const p of penaltyRows) {
        await client.query(
          `INSERT INTO public.penalties (id, user_id, penalty_date, type, reason, amount, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO UPDATE SET
             type = EXCLUDED.type,
             reason = EXCLUDED.reason,
             amount = EXCLUDED.amount`,
          [p.id, p.user_id, p.penalty_date, p.type, p.reason, p.amount, p.created_at]
        );
      }

      await client.query('COMMIT');
      lastSyncError = null;
      return { ok: true, mode: 'postgres_direct' };
    } catch (err) {
      if (client) {
        await client.query('ROLLBACK').catch(() => {});
      }
      lastSyncError = err.message;
      console.warn('[SupabaseDB] PG 트랜잭션 저장 오류:', err.message);
    } finally {
      if (client) client.release();
    }
  }

  // 2) Supabase REST API (@supabase/supabase-js) 동기화
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const r1 = await sb.from('app_settings').upsert(settingsRow, { onConflict: 'id' });
      if (r1.error) throw new Error(r1.error.message);

      if (participantRows.length > 0) {
        const r2 = await sb.from('participants').upsert(participantRows, { onConflict: 'id' });
        if (r2.error) throw new Error(r2.error.message);
      }
      if (dailyLogRows.length > 0) {
        const r3 = await sb.from('daily_logs').upsert(dailyLogRows, { onConflict: 'id' });
        if (r3.error) throw new Error(r3.error.message);
      }
      if (mealRows.length > 0) {
        const r4 = await sb.from('meals').upsert(mealRows, { onConflict: 'id' });
        if (r4.error) throw new Error(r4.error.message);
      }
      if (teamReportRows.length > 0) {
        await sb.from('team_reports').upsert(teamReportRows, { onConflict: 'id' });
      }
      if (missionLogRows.length > 0) {
        await sb.from('mission_logs').upsert(missionLogRows, { onConflict: 'id' });
      }
      if (penaltyRows.length > 0) {
        await sb.from('penalties').upsert(penaltyRows, { onConflict: 'id' });
      }

      lastSyncError = null;
      return { ok: true, mode: 'supabase_rest' };
    } catch (err) {
      lastSyncError = err.message;
      console.warn('[SupabaseDB] REST 동기화 경고:', err.message);
      return { ok: false, error: err.message };
    }
  }

  return { ok: false, error: lastSyncError || 'No Supabase connection available' };
}

async function getSupabaseStatus() {
  const creds = resolveCredentials();
  const status = {
    configured: creds.isConfigured,
    hasRest: creds.hasRest,
    hasPg: creds.hasPg,
    supabaseUrl: creds.supabaseUrl
      ? creds.supabaseUrl.replace(/^(https?:\/\/[^.]+)\..*$/, '$1.supabase.co')
      : '',
    connected: false,
    schemaInitialized,
    lastError: lastSyncError,
    tableCounts: null,
    tables: [
      'app_settings',
      'participants',
      'daily_logs',
      'meals',
      'team_reports',
      'mission_logs',
      'penalties'
    ],
    storageBucket: 'meal-photos'
  };

  if (!creds.isConfigured) return status;

  const pool = getPgPool();
  if (pool) {
    try {
      if (!schemaInitialized) {
        await ensureSchemaViaPg();
      }
      const res = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM public.participants)::int AS participants,
          (SELECT COUNT(*) FROM public.daily_logs)::int AS daily_logs,
          (SELECT COUNT(*) FROM public.meals)::int AS meals,
          (SELECT COUNT(*) FROM public.team_reports)::int AS team_reports,
          (SELECT COUNT(*) FROM public.mission_logs)::int AS mission_logs,
          (SELECT COUNT(*) FROM public.penalties)::int AS penalties
      `);
      status.connected = true;
      status.schemaInitialized = true;
      status.tableCounts = res.rows[0];
      return status;
    } catch (err) {
      status.lastError = err.message;
    }
  }

  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { count, error } = await sb
        .from('participants')
        .select('*', { count: 'exact', head: true });
      if (!error) {
        status.connected = true;
        status.tableCounts = { participants: count || 0 };
      } else {
        status.lastError = error.message;
      }
    } catch (err) {
      status.lastError = err.message;
    }
  }

  return status;
}

function updateSupabaseCredentials({ supabaseUrl, supabaseKey, databaseUrl }) {
  const current = loadRuntimeConfig();
  const updated = {
    ...current,
    ...(supabaseUrl !== undefined ? { supabaseUrl: String(supabaseUrl).trim() } : {}),
    ...(supabaseKey !== undefined ? { supabaseServiceKey: String(supabaseKey).trim() } : {}),
    ...(databaseUrl !== undefined ? { databaseUrl: String(databaseUrl).trim() } : {}),
    updatedAt: new Date().toISOString()
  };
  saveRuntimeConfig(updated);
  schemaInitialized = false;
  lastSyncError = null;
  return resolveCredentials();
}

module.exports = {
  resolveCredentials,
  loadStateFromSupabase,
  syncStateToSupabase,
  getSupabaseStatus,
  updateSupabaseCredentials,
  ensureSchemaViaPg,
  SCHEMA_SQL_PATH
};
