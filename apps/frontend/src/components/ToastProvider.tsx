import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Alert } from '@heroui/alert';

type ToastColor = 'danger' | 'default' | 'primary' | 'secondary' | 'success' | 'warning';

type Toast = {
  id: string;
  content: string;
  color?: ToastColor;
};

type ToastContextValue = {
  toast: (content: string, color: ToastColor, delayMs: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function ToastView({ toastList, onClose }: { toastList: Toast[]; onClose: (id: string) => void }) {
  return createPortal(
    <section aria-live="polite" className="absolute bottom-10 right-5 z-50 flex flex-col space-y-4">
      {toastList.map(toast => (
        <Alert
          key={toast.id}
          color={toast.color ?? 'default'}
          title={toast.content}
          onClick={() => onClose(toast.id)}
        />
      ))}
    </section>,
    document.body
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastList, setToastList] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function removeToastTimer(id: string) {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }

  function removeToast(id: string) {
    removeToastTimer(id);
    setToastList(prev => prev.filter(toast => toast.id !== id));
  }

  function addToast(content: string, color: ToastColor, delayMs: number) {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      removeToast(id);
    }, delayMs);
    timers.current.set(id, timer);
    setToastList(prev => [
      ...prev.slice(-3),
      {
        id,
        content,
        color,
      },
    ]);
  }

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timerId of activeTimers.values()) {
        clearTimeout(timerId);
      }
    };
  }, []);

  useEffect(() => {
    const activeIds = new Set(toastList.map(toast => toast.id));
    for (const [toastId, timerId] of timers.current.entries()) {
      if (!activeIds.has(toastId)) {
        clearTimeout(timerId);
        timers.current.delete(toastId);
      }
    }
  }, [toastList]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <ToastView toastList={toastList} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToasts must be used inside ToastProvider');
  }

  return context;
}
