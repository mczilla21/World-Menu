import { useState, useEffect } from 'react';

interface Customer { id: number; name: string; phone: string; email: string; points: number; total_visits: number; total_spent: number; birthday: string; notes: string; }

export default function CustomerManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const fetch_ = () => {
    if (search.trim()) {
      fetch(`/api/customers/search?q=${encodeURIComponent(search)}`).then(r => r.json()).then(setCustomers);
    } else {
      fetch('/api/customers').then(r => r.json()).then(setCustomers);
    }
  };
  useEffect(() => { fetch_(); }, [search]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), phone, email }) });
    setName(''); setPhone(''); setEmail('');
    fetch_();
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Add Customer</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-sm font-medium">Add</button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-200">Customers ({customers.length})</h3>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="bg-slate-700 rounded-lg px-3 py-1.5 text-white outline-none text-xs w-40" />
        </div>
        <div className="space-y-1.5">
          {customers.length === 0 && <p className="text-xs text-slate-500">No customers yet</p>}
          {customers.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700/50">
              <div className="flex-1">
                <span className="text-sm font-medium text-white">{c.name}</span>
                {c.phone && <span className="text-xs text-slate-400 ml-2">{c.phone}</span>}
              </div>
              <span className="text-xs text-amber-400">{c.points} pts</span>
              <span className="text-xs text-slate-400">{c.total_visits} visits</span>
              <span className="text-xs text-emerald-400">${c.total_spent.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
