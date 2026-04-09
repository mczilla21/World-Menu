import { useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { LANGUAGE_OPTIONS } from '../hooks/useSettings';

export default function LangToggle() {
  const { lang, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  // Current language label
  const currentLang = LANGUAGE_OPTIONS.find(o => o.code === lang);
  const label = currentLang?.name || lang || 'Language';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
      >
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden min-w-[220px] max-h-[60vh] overflow-y-auto">
            {LANGUAGE_OPTIONS.map(opt => (
              <button
                key={opt.code}
                onClick={() => { setLanguage(opt.code); setOpen(false); }}
                className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                  lang === opt.code ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div>
                  <div className="font-semibold">{opt.name}</div>
                  <div className={`text-xs mt-0.5 ${lang === opt.code ? 'text-blue-200' : 'text-slate-500'}`}>{opt.flag}</div>
                </div>
                {lang === opt.code && <span>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
