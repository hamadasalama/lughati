export type Role = 'teacher' | 'student' | 'admin';

export interface Me {
  id: number;
  username: string;
  role: Role;
  student_id: number | null;
  name?: string | null;
}

export interface Student {
  id: number;
  code: string;
  name: string;
  grade: string;
  section: string;
  notes: string | null;
  active: boolean;
}

export interface Evaluation {
  id: number;
  student_id: number;
  eval_date: string;
  attendance: 'present' | 'excused' | 'absent';
  behavior: number | null;
  participation: number | null;
  homework: number | null;
  notes: string | null;
}

export interface Settings {
  [key: string]: any;
}

export interface Account {
  id: number;
  username: string;
  role: string;
  student_id: number | null;
  active: boolean;
  student_name?: string | null;
  student_code?: string | null;
}

export interface AuditLog {
  id: number;
  at: string;
  user_id: number | null;
  username: string | null;
  role: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: any;
  ip: string | null;
}

export interface AuditPage {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface StudentReport {
  student: Student;
  evaluations: Evaluation[];
  counts: {
    present: number;
    excused: number;
    absent: number;
    behavior: number | null;
    participation: number | null;
    homework: number | null;
  };
  tests: {
    id: number;
    title: string;
    test_date: string;
    kind: 'test' | 'nafis';
    max_score: number;
    score: number | null;
    note: string | null;
    file_id: number | null;
    file_original_name: string | null;
    file_mime: string | null;
  }[];
  worksheets: {
    id: number;
    title: string;
    description: string | null;
    due_date: string | null;
    done: boolean;
    file_id: number | null;
  }[];
  plans: {
    id: number;
    title: string;
    goal: string | null;
    actions: string | null;
    description?: string | null;
    status: string;
    from_date: string | null;
    to_date: string | null;
    file_id: number | null;
    created_at: string;
    followups: { id: number; note: string; created_at: string }[];
  }[];
  skills: { id: number; name: string; level: number | null }[];
  stars: { week_start: string; week_label: string; reason: string | null }[];
}

export interface Msg {
  id?: number;
  sender: 'teacher' | 'student';
  body: string;
  sent_at: string;
}

export interface Star {
  week_start: string;
  week_label: string;
  student_id: number;
  student_name?: string;
  reason?: string | null;
}
