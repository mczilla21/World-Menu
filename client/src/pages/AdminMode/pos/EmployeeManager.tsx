import { useState, useEffect } from 'react';
import { LANGUAGE_OPTIONS, useSettings } from '../../../hooks/useSettings';

interface Employee { id: number; name: string; pin: string; role: string; hourly_rate: number; is_active: number; language?: string; }
interface TimeEntry { id: number; employee_name: string; employee_role: string; clock_in: string; clock_out: string; tips: number; hourly_rate: number; }

export default function EmployeeManager() {
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';
  const loggedIn = (() => { try { return JSON.parse(sessionStorage.getItem('wm_employee') || ''); } catch { return null; } })();
  const isOwner = loggedIn?.role === 'owner';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('server');
  const [rate, setRate] = useState('');
  const [empLang, setEmpLang] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editLang, setEditLang] = useState('');
  const [editPin, setEditPin] = useState('');

  const fetch_ = async () => {
    const [e, t] = await Promise.all([
      fetch('/api/employees/all').then(r => r.json()),
      fetch(`/api/time-entries?date=${date}`).then(r => r.json()),
    ]);
    setEmployees(e); setEntries(t);
  };
  useEffect(() => { fetch_(); }, [date]);

  const handleAdd = async () => {
    if (!name.trim() || !pin.trim()) return;
    await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), pin, role, hourly_rate: parseFloat(rate) || 0, language: empLang }) });
    setName(''); setPin(''); setRate(''); setEmpLang('');
    fetch_();
  };

  const toggleActive = async (emp: Employee) => {
    await fetch(`/api/employees/${emp.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: emp.is_active ? 0 : 1 }) });
    fetch_();
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditName(emp.name);
    setEditRole(emp.role);
    setEditRate(String(emp.hourly_rate));
    setEditLang(emp.language || '');
    setEditPin(emp.pin);
  };

  const saveEdit = async (id: number) => {
    await fetch(`/api/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), role: editRole, hourly_rate: parseFloat(editRate) || 0, language: editLang, pin: editPin }),
    });
    setEditingId(null);
    fetch_();
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Delete ${emp.name}? If they have time entries, they'll be deactivated instead.`)) return;
    const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.deactivated) alert(`${emp.name} has clock-in history — deactivated instead of deleted to keep records.`);
    fetch_();
  };

  const getHours = (entry: TimeEntry) => {
    if (!entry.clock_out) return 'Active';
    const ms = new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime();
    return (ms / 3600000).toFixed(1) + 'h';
  };

  const totalHours = entries.filter(e => e.clock_out).reduce((s, e) => {
    return s + (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
  }, 0);

  const totalLabor = entries.filter(e => e.clock_out).reduce((s, e) => {
    const hours = (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
    return s + hours * (e.hourly_rate || 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Add employee */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Add Employee</h3>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN (4 digit)" maxLength={4} className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <select value={role} onChange={e => setRole(e.target.value)} className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm">
            <option value="server">Server</option>
            <option value="kitchen">Kitchen</option>
            <option value="manager">Manager</option>
            <option value="host">Host</option>
          </select>
          <select value={empLang} onChange={e => setEmpLang(e.target.value)} className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm">
            <option value="">System Default</option>
            {LANGUAGE_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <input value={rate} onChange={e => setRate(e.target.value)} placeholder={`${currency}/hr`} type="number" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-sm font-medium">Add</button>
        </div>
      </div>

      {/* Employee list */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Employees ({employees.length})</h3>
        <div className="space-y-1.5">
          {employees.map(emp => (
            <div key={emp.id} className={`rounded-lg ${emp.is_active ? 'bg-slate-700/50' : 'bg-slate-700/20 opacity-50'}`}>
              {editingId === emp.id ? (
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name" className="bg-slate-600 rounded-lg px-3 py-2 text-white outline-none text-sm" />
                    <select value={editRole} onChange={e => setEditRole(e.target.value)} className="bg-slate-600 rounded-lg px-3 py-2 text-white outline-none text-sm">
                      <option value="server">Server</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="manager">Manager</option>
                      <option value="host">Host</option>
                    </select>
                    <input value={editRate} onChange={e => setEditRate(e.target.value)} placeholder={`${currency}/hr`} type="number" className="bg-slate-600 rounded-lg px-3 py-2 text-white outline-none text-sm" />
                    {isOwner && <input value={editPin} onChange={e => setEditPin(e.target.value)} placeholder="PIN" maxLength={4} className="bg-slate-600 rounded-lg px-3 py-2 text-white outline-none text-sm" />}
                    <select value={editLang} onChange={e => setEditLang(e.target.value)} className="bg-slate-600 rounded-lg px-3 py-2 text-white outline-none text-sm">
                      <option value="">System Default</option>
                      {LANGUAGE_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(emp.id)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white">Save</button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-1.5 bg-slate-600 rounded-lg text-xs text-slate-300">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 cursor-pointer" onClick={() => startEdit(emp)}>
                    <span className="text-sm font-medium text-white">{emp.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{emp.role}</span>
                    {isOwner && <span className="text-xs text-slate-500 ml-2">PIN: {emp.pin}</span>}
                    {emp.language && <span className="text-xs text-blue-400 ml-2">{LANGUAGE_OPTIONS.find(l => l.code === emp.language)?.name || emp.language}</span>}
                  </div>
                  <span className="text-xs text-emerald-400">{currency}{emp.hourly_rate}/hr</span>
                  <button onClick={() => startEdit(emp)} className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-400 hover:bg-blue-900/50">Edit</button>
                  <button onClick={() => toggleActive(emp)} className={`text-xs px-2 py-1 rounded ${emp.is_active ? 'bg-red-900/50 text-red-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                    {emp.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => handleDelete(emp)} className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-500 hover:bg-red-900/50">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Time entries */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-200">Time Clock</h3>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-700 rounded-lg px-3 py-1.5 text-white outline-none text-xs" />
        </div>
        <div className="space-y-1.5">
          {entries.length === 0 && <p className="text-xs text-slate-500">No entries for this date</p>}
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-700/50">
              <span className="text-sm font-medium text-white w-28">{entry.employee_name}</span>
              <span className="text-xs text-slate-400">{entry.clock_in?.slice(11, 16)} → {entry.clock_out?.slice(11, 16) || '...'}</span>
              <span className={`text-xs font-bold ml-auto ${entry.clock_out ? 'text-slate-300' : 'text-emerald-400 animate-pulse'}`}>{getHours(entry)}</span>
              {entry.tips > 0 && <span className="text-xs text-amber-400">+{currency}{entry.tips} tips</span>}
            </div>
          ))}
        </div>
        {entries.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex gap-6 text-xs">
            <span className="text-slate-400">Total: <span className="text-white font-bold">{totalHours.toFixed(1)}h</span></span>
            <span className="text-slate-400">Labor: <span className="text-emerald-400 font-bold">{currency}{totalLabor.toFixed(2)}</span></span>
            <span className="text-slate-400">Tips: <span className="text-amber-400 font-bold">{currency}{entries.reduce((s, e) => s + (e.tips || 0), 0).toFixed(2)}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
