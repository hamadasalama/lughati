-- مخطط منصة لغتي الكامل: جداول، علاقات، قيود، فهارس
CREATE TABLE students (
  id          serial PRIMARY KEY,
  code        varchar(30)  NOT NULL UNIQUE,          -- الرمز الثابت الذي يُربط به حساب الطالبة ولا يتغير
  name        varchar(120) NOT NULL,
  grade       varchar(20)  NOT NULL,
  section     varchar(10)  NOT NULL,                 -- الشعبة (class محجوزة في SQL)
  notes       text,
  active      boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            serial PRIMARY KEY,
  username      varchar(60)  NOT NULL UNIQUE,
  password_hash varchar(200) NOT NULL,                 -- bcrypt فقط، ولا تُعاد للواجهة أبداً
  role          varchar(10)  NOT NULL CHECK (role IN ('teacher','student','admin')),
  student_id    integer      UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  active        boolean      NOT NULL DEFAULT true,
  token_version integer      NOT NULL DEFAULT 0,       -- يُرفع عند تغيير كلمة المرور فتُبطَل كل الجلسات القديمة
  created_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT student_role_needs_student CHECK ((role = 'student') = (student_id IS NOT NULL))
);

-- التقييم تراكمي: لا يوجد UNIQUE على (student_id, eval_date) عمداً
CREATE TABLE evaluations (
  id            bigserial PRIMARY KEY,
  student_id    integer   NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  eval_date     date      NOT NULL,
  attendance    varchar(8) NOT NULL CHECK (attendance IN ('present','excused','absent')),
  behavior      smallint CHECK (behavior BETWEEN 1 AND 5),
  participation smallint CHECK (participation BETWEEN 1 AND 5),
  homework      smallint CHECK (homework BETWEEN 1 AND 5),
  notes         text,
  demo          boolean   NOT NULL DEFAULT false,
  created_by    integer   REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT absent_has_no_scores CHECK (
    attendance = 'present' OR (behavior IS NULL AND participation IS NULL AND homework IS NULL)
  )
);

CREATE TABLE worksheets (
  id          serial PRIMARY KEY,
  title       varchar(160) NOT NULL,
  description text,
  grade       varchar(20) NOT NULL,
  section     varchar(10) NOT NULL,
  work_date   date NOT NULL DEFAULT CURRENT_DATE,
  demo        boolean NOT NULL DEFAULT false,
  created_by  integer REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- لا صفوف targets = الورقة لجميع طالبات الصف؛ وجود صف = معيّنة لطالبة بعينها
CREATE TABLE worksheet_targets (
  worksheet_id integer NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
  student_id   integer NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  done         boolean NOT NULL DEFAULT false,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (worksheet_id, student_id)
);

CREATE TABLE tests (
  id         serial PRIMARY KEY,
  title      varchar(160) NOT NULL,
  kind       varchar(8) NOT NULL CHECK (kind IN ('test','nafis')),  -- نافس ضمن نفس الجدول
  max_score  numeric(5,2) NOT NULL DEFAULT 10 CHECK (max_score > 0),
  test_date  date NOT NULL DEFAULT CURRENT_DATE,
  grade      varchar(20) NOT NULL,
  section    varchar(10) NOT NULL,
  demo       boolean NOT NULL DEFAULT false,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE results (
  id         bigserial PRIMARY KEY,
  test_id    integer NOT NULL REFERENCES tests(id)    ON DELETE CASCADE,
  student_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score      numeric(5,2) NOT NULL CHECK (score >= 0),
  note       text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_id)
);

CREATE TABLE plans (
  id         serial PRIMARY KEY,
  student_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title      varchar(160) NOT NULL,
  goal       text,
  actions    text,
  from_date  date,
  to_date    date,
  status     varchar(8) NOT NULL DEFAULT 'active' CHECK (status IN ('active','done')),
  demo       boolean NOT NULL DEFAULT false,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE plan_followups (
  id          bigserial PRIMARY KEY,
  plan_id     integer NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  follow_date date NOT NULL DEFAULT CURRENT_DATE,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skills (
  id          serial PRIMARY KEY,
  name        varchar(120) NOT NULL UNIQUE,
  description text,
  demo        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE skill_levels (
  id         bigserial PRIMARY KEY,
  skill_id   integer NOT NULL REFERENCES skills(id)   ON DELETE CASCADE,
  student_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  level      smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  note       text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, student_id)
);

CREATE TABLE messages (
  id           bigserial PRIMARY KEY,
  student_id   integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sender       varchar(8) NOT NULL CHECK (sender IN ('teacher','student')),
  body         text NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  seen_teacher boolean NOT NULL DEFAULT false,
  seen_student boolean NOT NULL DEFAULT false
);

CREATE TABLE weekly_star (                 -- «أميرتي هذا الأسبوع» (بداية الأسبوع = الأحد)
  id          serial PRIMARY KEY,
  week_start  date NOT NULL UNIQUE,
  week_label  varchar(40) NOT NULL,
  student_id  integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reason      text,
  demo        boolean NOT NULL DEFAULT false,
  created_by  integer REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE achievements (
  id          serial PRIMARY KEY,
  title       varchar(160) NOT NULL,
  description text,
  category    varchar(40) NOT NULL DEFAULT 'أخرى',
  ach_date    date NOT NULL DEFAULT CURRENT_DATE,
  visible     boolean NOT NULL DEFAULT true,   -- الظهور لبوابة الطالبات
  demo        boolean NOT NULL DEFAULT false,
  created_by  integer REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- كل ملف مرفوع يمر من هنا: التنزيل يتم عبر /api/files/:id فقط، مع فحص ملكية في الخادم
CREATE TABLE files (
  id             bigserial PRIMARY KEY,
  stored_name    varchar(120) NOT NULL UNIQUE,   -- اسم عشوائي على القرص (لا يمكن تخمين مسار)
  original_name  varchar(255) NOT NULL,
  mime           varchar(120) NOT NULL,
  size_bytes     integer NOT NULL,
  kind           varchar(20) NOT NULL,           -- worksheet | achievement | logo
  student_id     integer REFERENCES students(id)     ON DELETE CASCADE,  -- خاص بطالبة محددة
  worksheet_id   integer REFERENCES worksheets(id)   ON DELETE CASCADE,
  achievement_id integer REFERENCES achievements(id) ON DELETE CASCADE,
  uploaded_by    integer REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key        varchar(60) PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id        bigserial PRIMARY KEY,
  at        timestamptz NOT NULL DEFAULT now(),
  user_id   integer,
  username  varchar(60),
  role      varchar(10),
  action    varchar(60) NOT NULL,   -- login / login_fail / evaluation.create / file.download ...
  entity    varchar(40),
  entity_id varchar(40),
  details   jsonb,
  ip        varchar(60)
);

CREATE INDEX idx_eval_student      ON evaluations(student_id, eval_date);
CREATE INDEX idx_eval_date         ON evaluations(eval_date);
CREATE INDEX idx_targets_student   ON worksheet_targets(student_id);
CREATE INDEX idx_results_student   ON results(student_id);
CREATE INDEX idx_plans_student     ON plans(student_id);
CREATE INDEX idx_levels_student    ON skill_levels(student_id);
CREATE INDEX idx_messages_student  ON messages(student_id, sent_at);
CREATE INDEX idx_files_student     ON files(student_id);
CREATE INDEX idx_audit_at          ON audit_logs(at DESC);
