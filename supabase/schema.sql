-- ============================================================================
-- LEBEN ZONE CHALLENGE · Supabase PostgreSQL Database Schema
-- ============================================================================
-- 구성 테이블 (총 7개 정규화 테이블 + 1개 Storage 버킷):
--   1. app_settings   : 챌린지 기본 설정, 네이버 카페 연동 설정, 주간 미션 설정
--   2. participants   : 기수별 참가자(1조~5조, 각 4명) 및 개인 카페 게시판 매핑
--   3. daily_logs     : 참가자별·날짜별 일일 인증 상태 (단톡 보고 / 카페 업로드 여부)
--   4. meals          : 끼니별(아침·점심·저녁·간식) 식단 기록, 탄·단·지 블럭, 사진 URL
--   5. team_reports   : 조별 식단담당자 일일 취합 보고 내역
--   6. mission_logs   : 주간 미션 운동 완료 인증 내역
--   7. penalties      : 벌금 및 패널티 부과 내역
-- ============================================================================

-- 1. 앱 및 챌린지 전역 설정 테이블 (app_settings)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  challenge_name TEXT NOT NULL DEFAULT 'LEBEN ZONE CHALLENGE',
  box_name TEXT NOT NULL DEFAULT 'CrossFit LEBEN',
  start_date TEXT,
  end_date TEXT,
  penalty_unit_amount INTEGER NOT NULL DEFAULT 10000,
  max_penalty_count INTEGER NOT NULL DEFAULT 10,
  admin_pin TEXT NOT NULL DEFAULT '0000',
  cafe_url TEXT NOT NULL DEFAULT 'https://cafe.naver.com/mycaffelatte',
  naver_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  weekly_mission JSONB NOT NULL DEFAULT '{}'::jsonb,
  pending_naver_auth JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 참가자 및 네이버 카페 개인 게시판 매핑 테이블 (participants)
CREATE TABLE IF NOT EXISTS public.participants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team INTEGER NOT NULL DEFAULT 1,
  role TEXT NOT NULL DEFAULT '조원',
  target_blocks JSONB NOT NULL DEFAULT '11'::jsonb,
  pin TEXT NOT NULL DEFAULT '1234',
  cafe_menu_id TEXT,
  cohort_group TEXT NOT NULL DEFAULT '2026년 2기',
  order_in_cohort INTEGER NOT NULL DEFAULT 1,
  naver_id TEXT,
  naver_nickname TEXT,
  naver_tokens JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participants_team ON public.participants(team);
CREATE INDEX IF NOT EXISTS idx_participants_cohort ON public.participants(cohort_group, order_in_cohort);

-- 3. 일일 식단 인증 및 카페/단톡 보고 상태 테이블 (daily_logs)
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  kakao_reported BOOLEAN NOT NULL DEFAULT FALSE,
  kakao_reported_at TEXT,
  cafe_posted BOOLEAN NOT NULL DEFAULT FALSE,
  cafe_posted_at TEXT,
  cafe_post_info JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON public.daily_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON public.daily_logs(user_id, log_date);

-- 4. 끼니별(아침·점심·저녁·간식) 식단 및 탄·단·지 블럭 테이블 (meals)
CREATE TABLE IF NOT EXISTS public.meals (
  id TEXT PRIMARY KEY,
  daily_log_id TEXT NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  meal_type TEXT NOT NULL, -- '아침' | '점심' | '저녁' | '간식'
  meal_time TEXT DEFAULT '',
  carb_blocks NUMERIC(6,2) NOT NULL DEFAULT 0,
  protein_blocks NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_blocks NUMERIC(6,2) NOT NULL DEFAULT 0,
  memo TEXT DEFAULT '',
  image_data TEXT,
  image_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meals_daily_log ON public.meals(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON public.meals(user_id, log_date);

-- 5. 조별 식단담당자 일일 취합 보고 테이블 (team_reports)
CREATE TABLE IF NOT EXISTS public.team_reports (
  id TEXT PRIMARY KEY,
  team INTEGER NOT NULL,
  report_date TEXT NOT NULL,
  reported_by_user_id TEXT,
  reported_by_name TEXT,
  comment TEXT DEFAULT '',
  reported_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team, report_date)
);

CREATE INDEX IF NOT EXISTS idx_team_reports_date ON public.team_reports(report_date);

-- 6. 주간 미션 완료 인증 로그 테이블 (mission_logs)
CREATE TABLE IF NOT EXISTS public.mission_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  week_label TEXT NOT NULL,
  mission_date TEXT NOT NULL,
  memo TEXT DEFAULT '',
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mission_logs_week ON public.mission_logs(week_label, user_id);

-- 7. 패널티 및 벌금 내역 테이블 (penalties)
CREATE TABLE IF NOT EXISTS public.penalties (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  penalty_date TEXT NOT NULL,
  type TEXT NOT NULL, -- 'OVER_BLOCK' | 'NO_CAFE' | 'NO_KAKAO' | 'NO_MISSION' | 'MANUAL'
  reason TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 10000,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_penalties_user ON public.penalties(user_id, penalty_date);

-- 8. 식단 사진 전용 Supabase Storage 버킷 생성 (meal-photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-photos', 'meal-photos', true)
ON CONFLICT (id) DO NOTHING;
