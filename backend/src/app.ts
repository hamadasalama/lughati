import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config';
import { q } from './database/pool';
import { notFound, errorHandler, wrap } from './middleware/errors';

import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import studentsRoutes from './routes/students';
import evaluationsRoutes from './routes/evaluations';
import worksheetsRoutes from './routes/worksheets';
import testsRoutes from './routes/tests';
import plansRoutes from './routes/plans';
import skillsRoutes from './routes/skills';
import messagesRoutes from './routes/messages';
import starRoutes from './routes/star';
import achievementsRoutes from './routes/achievements';
import filesRoutes from './routes/files';
import reportsRoutes from './routes/reports';
import settingsRoutes from './routes/settings';
import auditRoutes from './routes/audit';

export function createApp(opts: { staticDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // خلف وكيل عكسي (Nginx/IIS) نثق بعدد محدد من الوسطاء ليعمل حد المحاولات على IP الحقيقي
  if (/^\d+$/.test(env.trustProxy) && +env.trustProxy > 0) app.set('trust proxy', +env.trustProxy);
  else if (env.trustProxy === 'true') app.set('trust proxy', true);

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(compression());
  // ترويسات أمان: nosniff, frameguard, referrer-policy, HSTS في الإنتاج...
  // CSP تُطبّق في الإنتاج فقط (الواجهة تُقدَّم من نفس الخادم)، وتُعطَّل في التطوير
  // حتى لا تتعارض مع خادم Vite. تسمح بالأنماط المضمّنة لأن الواجهة تستخدم style props.
  const prodCsp = {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", 'blob:'],
      objectSrc: ["'self'", 'blob:'],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  };
  app.use(helmet({
    contentSecurityPolicy: env.nodeEnv === 'production' ? prodCsp : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'same-origin' },
    strictTransportSecurity: env.nodeEnv === 'production' ? undefined : false,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // طباعة المسار في نافذة الخادم للتأكد
  console.log('📂 Upload Directory:', env.uploadDirAbs);
  if (!fs.existsSync(env.uploadDirAbs)) {
    console.log('⚠️ Warning: Upload directory does not exist. Creating it...');
    fs.mkdirSync(env.uploadDirAbs, { recursive: true });
  }

  // لا نقدّم مجلد uploads كملفات ثابتة عامة: كل ملف يجب أن يمر عبر /api/files/:id
  // حتى تُفرض المصادقة والملكية على الخادم (ملفات الاختبارات والخطط خاصة).

  // فحص صحة
  app.get('/api/health', wrap(async (_req, res) => {
    const { rows } = await q('SELECT now() AS now');
    res.json({ status: 'ok', db: 'ok', now: rows[0].now });
  }));

  // مسارات API
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/students', studentsRoutes);
  app.use('/api/evaluations', evaluationsRoutes);
  app.use('/api/worksheets', worksheetsRoutes);
  app.use('/api/tests', testsRoutes);
  app.use('/api/plans', plansRoutes);
  app.use('/api/skills', skillsRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/star', starRoutes);
  app.use('/api/achievements', achievementsRoutes);
  app.use('/api/files', filesRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/audit', auditRoutes);

  // في الإنتاج: تقديم واجهة React المبنية من نفس الخادم
  if (opts.staticDir && fs.existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads'))
        return res.sendFile(path.join(opts.staticDir!, 'index.html'));
      next();
    });
  }

  // معالجة الأخطاء (يجب أن تكون في النهاية)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}