import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, publicFileUrl } from '../api/client';

export type ThemeTextKey =
  | 'brandTitle' | 'brandSubtitle'
  | 'loginSchool' | 'loginSubtitle'
  | 'loginQuote1' | 'loginQuote2' | 'loginQuote3'
  | 'creditName' | 'creditRole';

export interface BrandingTheme {
  colors: { accent: string; sidebar: string; heading: string };
  typography: { fontFamily: string; baseSize: number; headingSize: number; lineHeight: number };
  background: {
    type: 'color' | 'gradient' | 'image';
    color: string; from: string; to: string;
    angle: number; overlay: number; fixed: boolean;
    image: { file_id: number } | null;
  };
  texts: Record<ThemeTextKey, string>;
}

export interface Branding {
  schoolName: string;
  teacher: string;
  logoSchool: { file_id: number } | null;
  theme: BrandingTheme;
}

export const DEFAULT_BRANDING: Branding = {
  schoolName: 'اسم المدرسة',
  teacher: 'أستاذة مها',
  logoSchool: null,
  theme: {
    colors: { accent: '#1a5c42', sidebar: '#123f2e', heading: '#123f2e' },
    typography: {
      fontFamily: "'Sakkal Majalla', 'Traditional Arabic', 'Amiri', serif",
      baseSize: 17, headingSize: 27, lineHeight: 1.65,
    },
    background: {
      type: 'gradient', color: '#f6f2e8', from: '#f7f3e9', to: '#e8f0ea',
      angle: 160, overlay: 0.45, fixed: true, image: null,
    },
    texts: {
      brandTitle: 'منصة لغتي',
      brandSubtitle: 'تقييم طالبات مادة اللغة العربية',
      loginSchool: 'مدارس هيا الأهلية',
      loginSubtitle: 'منصة تقييم طالبات مادة لغتي',
      loginQuote1: 'بِكَ تُفْتَحُ أَبْوَابُ العِلْمِ وَتُزْهِرُ الأَجْيَالُ.',
      loginQuote2: 'التعلمُ نورٌ يهدي العقول، والتقييمُ البنّاءُ طريقُ التميّز',
      loginQuote3: 'كلُّ طالبةٍ قادرةٌ على النجاح حين نكتشف مواطن قوّتها وندعمها',
      creditName: 'أستاذة مها',
      creditRole: 'معلمة مادة لغتي',
    },
  },
};

export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'سكّال مجلّة (الافتراضي)', value: "'Sakkal Majalla', 'Traditional Arabic', 'Amiri', serif" },
  { label: 'أميري / نسخ تقليدي', value: "'Amiri', 'Traditional Arabic', 'Times New Roman', serif" },
  { label: 'خط النظام', value: "system-ui, 'Segoe UI', Tahoma, sans-serif" },
  { label: 'سيغو (حديث وواضح)', value: "'Segoe UI', Tahoma, Arial, sans-serif" },
  { label: 'تايمز (رسمي)', value: "'Times New Roman', 'Traditional Arabic', serif" },
];

function mergeTheme(base: BrandingTheme, patch: any): BrandingTheme {
  if (!patch || typeof patch !== 'object') return base;
  return {
    colors: { ...base.colors, ...(patch.colors ?? {}) },
    typography: { ...base.typography, ...(patch.typography ?? {}) },
    background: { ...base.background, ...(patch.background ?? {}) },
    texts: { ...base.texts, ...(patch.texts ?? {}) },
  };
}

/** يحوّل الألوان/الخط/الخلفية إلى متغيّرات CSS حيّة على مستوى الصفحة */
function applyTheme(theme: BrandingTheme) {
  const root = document.documentElement;
  const s = root.style;
  s.setProperty('--pk', theme.colors.sidebar);
  s.setProperty('--pk2', theme.colors.accent);
  s.setProperty('--heading', theme.colors.heading);
  s.setProperty('--font-ui', theme.typography.fontFamily);
  s.setProperty('--base-size', theme.typography.baseSize + 'px');
  s.setProperty('--heading-size', theme.typography.headingSize + 'px');
  s.setProperty('--line-height', String(theme.typography.lineHeight));

  const bg = theme.background;
  s.setProperty('--bg-attachment', bg.fixed ? 'fixed' : 'scroll');
  if (bg.type === 'image' && bg.image?.file_id) {
    s.setProperty('--bg-color', bg.color);
    s.setProperty(
      '--bg-image',
      `linear-gradient(rgba(0,0,0,${bg.overlay}), rgba(0,0,0,${bg.overlay})), url("${publicFileUrl(bg.image.file_id, true)}")`
    );
  } else if (bg.type === 'gradient') {
    s.setProperty('--bg-color', bg.from);
    s.setProperty('--bg-image', `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`);
  } else {
    s.setProperty('--bg-color', bg.color);
    s.setProperty('--bg-image', 'none');
  }
  document.title = theme.texts.brandTitle + ' — ' + theme.texts.brandSubtitle;
}

interface BrandingCtx {
  branding: Branding;
  refresh: () => Promise<void>;
}

const Ctx = createContext<BrandingCtx>({ branding: DEFAULT_BRANDING, refresh: async () => {} });

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

  const refresh = useCallback(async () => {
    try {
      const data = await api('/settings/public');
      setBranding({
        schoolName: data?.schoolName ?? DEFAULT_BRANDING.schoolName,
        teacher: data?.teacher ?? DEFAULT_BRANDING.teacher,
        logoSchool: data?.logoSchool?.file_id ? data.logoSchool : null,
        theme: mergeTheme(DEFAULT_BRANDING.theme, data?.theme),
      });
    } catch {
      // تعذّر الاتصال: نبقى على الهوية الافتراضية بدل تعطيل الواجهة
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { applyTheme(branding.theme); }, [branding.theme]);

  return <Ctx.Provider value={{ branding, refresh }}>{children}</Ctx.Provider>;
}

export function useBranding() {
  return useContext(Ctx);
}
