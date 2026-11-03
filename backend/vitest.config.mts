import { defineConfig } from 'vitest/config';

export default defineConfig({
  // الجذر = جذر المشروع كي يجد vitest مجلد tests الموجود خارج backend
  // (npm test يشغَّل من مجلد backend عبر سكربت الحزمة)
  root: '..',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    // بالتتابع لا بالتوازي: كل ملفات الاختبار تفرّغ قاعدة الاختبار نفسها وتعيد بذرها
    fileParallelism: false
  }
});
