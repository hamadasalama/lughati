-- 005: نسخة احتياطية من محتوى المرفقات داخل قاعدة البيانات
-- السبب: الاستضافات المجانية (Render/Koyeb) تستخدم قرصاً مؤقتاً يُمسح عند إعادة النشر
-- أو توقف الخدمة. تخزين البايتات في PostgreSQL يضمن بقاء الملفات مع بقاء القاعدة.
ALTER TABLE files ADD COLUMN IF NOT EXISTS data bytea;

COMMENT ON COLUMN files.data IS 'محتوى الملف (bytea) — يُستخدم عند غياب النسخة على القرص';
