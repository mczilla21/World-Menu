import { useState, useCallback, createContext, useContext, useRef } from 'react';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModal({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    modal?.resolve(true);
    setModal(null);
  };

  const handleCancel = () => {
    modal?.resolve(false);
    setModal(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={handleCancel}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
            style={{ background: '#1e293b', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="text-4xl mb-4">
                {modal.danger ? '⚠️' : 'ℹ️'}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{modal.title}</h3>
              {modal.message && (
                <p className="text-sm text-slate-400 mb-1">{modal.message}</p>
              )}
            </div>
            <div className="flex border-t border-slate-700">
              <button
                onClick={handleCancel}
                className="flex-1 py-4 text-sm font-semibold text-slate-400 hover:bg-slate-700/50 transition-colors"
              >
                {modal.cancelText || 'Cancel'}
              </button>
              <div className="w-px bg-slate-700" />
              <button
                onClick={handleConfirm}
                autoFocus
                className="flex-1 py-4 text-sm font-bold transition-colors"
                style={{
                  color: modal.danger ? '#ef4444' : '#3b82f6',
                  background: 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = modal.danger ? '#ef444415' : '#3b82f615')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {modal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
