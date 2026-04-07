import { useState, useEffect } from 'react';

interface Reservation { id: number; customer_name: string; phone: string; party_size: number; date: string; time: string; table_number: string; status: string; notes: string; }

export default function ReservationManager() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [party, setParty] = useState('2');
  const [time, setTime] = useState('18:00');
  const [table, setTable] = useState('');

  const fetch_ = () => fetch(`/api/reservations?date=${date}`).then(r => r.json()).then(setReservations);
  useEffect(() => { fetch_(); }, [date]);

  const handleAdd = async () => {
    if (!name.trim() || !time) return;
    await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: name.trim(), phone, party_size: parseInt(party), date, time, table_number: table }) });
    setName(''); setPhone(''); setParty('2'); setTable('');
    fetch_();
  };

  const updateStatus = async (id: number, status: string) => {
    const r = reservations.find(r => r.id === id)!;
    await fetch(`/api/reservations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...r, status }) });
    fetch_();
  };

  const remove = async (id: number) => {
    await fetch(`/api/reservations/${id}`, { method: 'DELETE' });
    fetch_();
  };

  const statusColors: Record<string, string> = {
    confirmed: 'bg-blue-600/20 text-blue-400',
    seated: 'bg-emerald-600/20 text-emerald-400',
    cancelled: 'bg-red-600/20 text-red-400',
    no_show: 'bg-slate-600/20 text-slate-400',
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">New Reservation</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Guest name" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <input type="number" value={party} onChange={e => setParty(e.target.value)} placeholder="Party size" min="1" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <input value={table} onChange={e => setTable(e.target.value)} placeholder="Table # (opt)" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
        </div>
        <button onClick={handleAdd} className="mt-2 bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-sm font-medium">Add Reservation</button>
      </div>

      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-200">Reservations ({reservations.length})</h3>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-700 rounded-lg px-3 py-1.5 text-white outline-none text-xs" />
        </div>
        {reservations.length === 0 && <p className="text-xs text-slate-500">No reservations for this date</p>}
        <div className="space-y-1.5">
          {reservations.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700/50">
              <span className="text-lg font-bold text-white w-14">{r.time}</span>
              <div className="flex-1">
                <span className="text-sm font-medium text-white">{r.customer_name}</span>
                <span className="text-xs text-slate-400 ml-2">{r.party_size} guests</span>
                {r.table_number && <span className="text-xs text-blue-400 ml-2">Table {r.table_number}</span>}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[r.status] || 'bg-slate-600 text-slate-300'}`}>{r.status}</span>
              <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)} className="bg-slate-600 rounded text-xs text-white px-1.5 py-1 outline-none">
                <option value="confirmed">Confirmed</option>
                <option value="seated">Seated</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <button onClick={() => remove(r.id)} className="text-xs text-red-400">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
