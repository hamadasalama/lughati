-- 002: ربط المرفقات بالاختبارات والخطط، وإضافة تاريخ التسليم لأوراق العمل
-- ملاحظة: قاعدة البيانات الحالية أُضيف إليها tests.file_id يدوياً، لذلك نستخدم IF NOT EXISTS
-- ونضيف قيود المفاتيح الأجنبية بشكل آمن حتى لا تفشل الترحيلات على نسخ قديمة.

ALTER TABLE tests      ADD COLUMN IF NOT EXISTS file_id integer;
ALTER TABLE plans      ADD COLUMN IF NOT EXISTS file_id integer;
ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS due_date date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tests_file_id_fkey') THEN
    ALTER TABLE tests ADD CONSTRAINT tests_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_file_id_fkey') THEN
    ALTER TABLE plans ADD CONSTRAINT plans_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tests_file    ON tests(file_id);
CREATE INDEX IF NOT EXISTS idx_plans_file    ON plans(file_id);
CREATE INDEX IF NOT EXISTS idx_files_worksheet ON files(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_files_achievement ON files(achievement_id);
