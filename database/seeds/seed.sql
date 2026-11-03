-- الإعدادات الافتراضية (idempotent) — لا بيانات طالبات ولا درجات ملفقة هنا
INSERT INTO settings(key, value) VALUES
 ('schoolName', '"اسم المدرسة"'),
 ('eduAdmin',   '"الإدارة العامة للتعليم"'),
 ('principal',  '"أ. بدور الجارد"'),
 ('teacher',    '"أستاذة مها"'),
 ('grades',     '["الرابع","الخامس","السادس"]'),
 ('classes',    '["أ","ب"]'),
 ('scale',      '{"max":5,"labels":{"5":"ممتاز","4":"جيد جدًا","3":"جيد","2":"يحتاج إلى تحسين","1":"يحتاج إلى متابعة"}}'),
 ('alerts',     '{"lowStreak":3,"lowThreshold":2,"absenceDays":3,"noEvalDays":14}'),
 ('info',       '{"about":"","goals":"","bio":""}'),
 ('logoSchool', 'null'),
 ('logoMoe',    'null')
ON CONFLICT (key) DO NOTHING;
