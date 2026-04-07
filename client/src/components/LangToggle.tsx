import { useLanguage, type DisplayLang } from '../hooks/useLanguage';

const cycle: Record<DisplayLang, DisplayLang> = { native: 'translated', translated: 'both', both: 'native' };
const labels: Record<DisplayLang, string> = { native: 'Native', translated: 'Alt', both: 'Both' };

export default function LangToggle() {
  const { lang, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(cycle[lang])}
      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 transition-colors"
      title="Switch display language (this device)"
    >
      {labels[lang]}
    </button>
  );
}
