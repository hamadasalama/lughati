-- اسم المستخدم يجب أن يكون فريداً بغض النظر عن حالة الأحرف:
-- تسجيل الدخول يقارن lower(username)، فوجود StudentA وstudenta يعني هويتين متطابقتين عملياً.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users GROUP BY lower(username) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'يوجد تكرار في أسماء المستخدمين باختلاف حالة الأحرف — صحّحيها قبل تشغيل الترحيل';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx ON users(lower(username));
