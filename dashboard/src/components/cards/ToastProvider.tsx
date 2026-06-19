import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; msg: string; sub?: string; type: ToastType; }

interface ToastCtx { toast: (msg: string, type?: ToastType, sub?: string) => void; }

const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function useToast() { return useContext(Ctx); }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, type: ToastType = 'info', sub?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, msg, sub, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const Icon = { success: CheckCircle2, error: XCircle, info: Info };

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => {
          const I = Icon[t.type];
          return (
            <div key={t.id} className={`toast ${t.type}`}>
              <I size={16} color={
                t.type === 'success' ? 'var(--accent-teal)' :
                t.type === 'error'   ? 'var(--accent-red)'  : 'var(--accent-blue)'
              } style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div className="toast-msg">{t.msg}</div>
                {t.sub && <div className="toast-sub">{t.sub}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
