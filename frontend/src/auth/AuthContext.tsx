import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { Me } from '../api/types';

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  setMe: (m: Me | null) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  me: null,
  loading: true,
  setMe: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const m = await api('/auth/me');
      // الخادم يعيد { user: ... } — نفكّ الغلاف حتى تعمل الأدوار في الواجهة
      setMe(m?.user ?? m);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return <Ctx.Provider value={{ me, loading, setMe, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
