import { useState } from 'react';
import { useLanguage, type DisplayLang } from '../hooks/useLanguage';

const options: { key: DisplayLang; label: string; desc: string }[] = [
  { key: 'native', label: 'Native', desc: 'Show items in restaurant language' },
  { key: 'translated', label: 'Translated', desc: 'Show items in selected language' },
  { key: 'both', label: 'Both', desc: 'Show both languages side by side' },
];

export default function LangToggle() {
  const { lang, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
      >
        🌐 {options.find(o => o.key === lang)?.label || 'Language'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden min-w-[200px]">
            {options.map(opt => (
              <button
                key={opt.key}
                onClick={() => { setLanguage(opt.key); setOpen(false); }}
                className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                  lang === opt.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div>
                  <div className="font-semibold">{opt.label}</div>
                  <div className={`text-xs mt-0.5 ${lang === opt.key ? 'text-blue-200' : 'text-slate-500'}`}>{opt.desc}</div>
                </div>
                {lang === opt.key && <span>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
