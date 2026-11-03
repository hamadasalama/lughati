import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface Toast { id: number; text: string; err?: boolean; }
interface ToastCtx { push: (text: string, err?: boolean) => void; }

const TCtx = createContext<ToastCtx>({ push: () => {} });
let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, err?: boolean) => {
    const id = seq++;
    setItems((xs) => [...xs, { id, text, err }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 3400);
  }, []);
  return (
    <TCtx.Provider value={{ push }}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={'toast' + (t.err ? ' err' : '')}>{t.text}</div>
        ))}
      </div>
    </TCtx.Provider>
  );
}

export function useToast() {
  return useContext(TCtx);
}

export function Modal({ title, onClose, wide, children }: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      className="ovl"
      onMouseDown={(e) => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      }}
    >
      <div className={'modal' + (wide ? ' wide' : '')} ref={ref}>
        <div className="mhead">
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>
        <div className="mbody">{children}</div>
      </div>
    </div>
  );
}
