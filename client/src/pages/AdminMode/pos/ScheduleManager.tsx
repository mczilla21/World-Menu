import { useState, useEffect } from 'react';

interface Schedule { id: number; name: string; start_time: string; end_time: string; days: string; category_ids: string; is_active: number; }

export default function ScheduleManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [start, setStart] = useState('11:00');
  const [end, setEnd] = useState('15:00');
  const [days, setDays] = useState('mon,tue,wed,thu,fri,sat,sun');
  const [catIds, setCatIds] = useState('');

  const fetch_ = async () => {
    const [s, c] = await Promise.all([
      fetch('/api/menu-schedules').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]);
    setSchedules(s); setCategories(c);
  };
  useEffect(() => { fetch_(); }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await fetch('/api/menu-schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), start_time: start, end_time: end, days, category_ids: catIds }) });
    setName('');
    fetch_();
  };

  const remove = async (id: number) => {
    await fetch(`/api/menu-schedules/${id}`, { method: 'DELETE' });
    fetch_();
  };

  const dayList = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Create Schedule</h3>
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Schedule name (e.g. Lunch, Happy Hour)" className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Start</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">End</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Days</label>
            <div className="flex gap-1">
              {dayList.map(d => (
                <button key={d} onClick={() => {
                  const ds = days.split(',').filter(Boolean);
                  setDays(ds.includes(d) ? ds.filter(x => x !== d).join(',') : [...ds, d].join(','));
                }} className={`px-2.5 py-1.5 rounded text-xs font-medium ${days.includes(d) ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Show categories (leave empty for all)</label>
            <div className="flex flex-wrap gap-1">
              {categories.map(c => (
                <button key={c.id} onClick={() => {
                  const ids = catIds.split(',').filter(Boolean);
                  const idStr = String(c.id);
                  setCatIds(ids.includes(idStr) ? ids.filter(x => x !== idStr).join(',') : [...ids, idStr].join(','));
                }} className={`px-2.5 py-1.5 rounded text-xs font-medium ${catIds.split(',').includes(String(c.id)) ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-sm font-medium">Create Schedule</button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Schedules</h3>
        {schedules.length === 0 && <p className="text-xs text-slate-500">No schedules yet</p>}
        {schedules.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700/50 mb-1.5">
            <div className="flex-1">
              <span className="text-sm font-medium text-white">{s.name}</span>
              <span className="text-xs text-slate-400 ml-2">{s.start_time} – {s.end_time}</span>
              <span className="text-xs text-slate-500 ml-2">{s.days}</span>
            </div>
            <button onClick={() => remove(s.id)} className="text-xs text-red-400">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
