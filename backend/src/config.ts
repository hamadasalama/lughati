import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const req = (k: string, d?: string): string => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error('متغير بيئة مفقود: ' + k);
  return v;
};

const uploadDir = req('UPLOAD_DIR', 'uploads');

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: +req('PORT', '4000'),
  databaseUrl: req('DATABASE_URL'),
  jwtSecret: req('JWT_SECRET'),
  corsOrigin: req('CORS_ORIGIN', process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'),
  uploadDir,
  maxUploadMb: +req('MAX_UPLOAD_MB', '6'),
  // عدد الوسطاء الموثوقين أمام الخادم (Nginx/IIS) حتى يُقرأ IP الحقيقي في تحديد المعدل
  trustProxy: req('TRUST_PROXY', '0'),
  // فحص فيروسات اختياري عبر ClamAV (clamdscan/clamscan). معطّل افتراضياً.
  clamav: {
    enabled: String(req('CLAMAV_ENABLED', 'false')).toLowerCase() === 'true',
    bin: req('CLAMAV_BIN', 'clamdscan'),
    timeoutMs: +req('CLAMAV_TIMEOUT_MS', '20000'),
  },
  migrationsDir: req('MIGRATIONS_DIR', path.resolve(__dirname, '../../database/migrations')),
  seedsDir: req('SEEDS_DIR', path.resolve(__dirname, '../../database/seeds')),
  // مسار مطلق محسوب من مكان الملف حتى يعمل على أي جهاز (بدل مسار ثابت)
  uploadDirAbs: path.isAbsolute(uploadDir) ? uploadDir : path.resolve(__dirname, '..', uploadDir)
};