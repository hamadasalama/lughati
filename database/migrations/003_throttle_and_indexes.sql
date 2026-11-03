-- فهارس الأداء الناقصة + جدول قفل محاولات الدخول (يعمل مع أكثر من نسخة خادم)

CREATE INDEX IF NOT EXISTS idx_tests_grade_section       ON tests(grade, section);
CREATE INDEX IF NOT EXISTS idx_worksheets_grade_section  ON worksheets(grade, section);
CREATE INDEX IF NOT EXISTS idx_files_worksheet           ON files(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_files_achievement         ON files(achievement_id);
CREATE INDEX IF NOT EXISTS idx_followups_plan           ON plan_followups(plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_star_student       ON weekly_star(student_id);
CREATE INDEX IF NOT EXISTS idx_achievements_visible_date ON achievements(visible, ach_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_at           ON audit_logs(action, at DESC);

-- قفل محاولات الدخول: bucket = 'u:<username>' أو 'ip:<address>'
-- في الذاكرة كان يعمل لنسخة واحدة فقط؛ هنا يُشترك بين كل النسخ عبر PostgreSQL.
CREATE TABLE IF NOT EXISTS login_throttle (
  bucket       varchar(160) PRIMARY KEY,
  fails        integer      NOT NULL DEFAULT 0,
  window_start timestamptz  NOT NULL DEFAULT now(),
  locked_until timestamptz
);
CREATE INDEX IF NOT EXISTS idx_login_throttle_until ON login_throttle(locked_until);
CREATE INDEX IF NOT EXISTS idx_login_throttle_window ON login_throttle(window_start);
