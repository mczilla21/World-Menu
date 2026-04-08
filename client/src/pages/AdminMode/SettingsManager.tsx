import { useState, useEffect } from 'react';
import { useSettings, LANGUAGE_OPTIONS } from '../../hooks/useSettings';
import QRCode from 'qrcode';

interface PackagingOption {
  id: number;
  name: string;
  sort_order: number;
  is_active: number;
}

export default function SettingsManager() {
  const { settings, updateSetting, updateSettings } = useSettings();
  const [restaurantName, setRestaurantName] = useState(settings.restaurant_name);
  const [tableCount, setTableCount] = useState(settings.table_count);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currency_symbol);
  const [orderPrefix, setOrderPrefix] = useState(settings.order_prefix);
  const [themeColor, setThemeColor] = useState(settings.theme_color);
  const [nativeLang, setNativeLang] = useState(settings.native_language);
  const [customerMode, setCustomerMode] = useState(settings.customer_mode_enabled === '1');
  const [qrTable, setQrTable] = useState('1');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [dirty, setDirty] = useState(false);

  // v2 settings
  const [orderTypesEnabled, setOrderTypesEnabled] = useState<Set<string>>(new Set((settings.order_types_enabled || 'dine_in,takeout,pickup').split(',').filter(Boolean)));
  const [takeoutOnly, setTakeoutOnly] = useState(settings.takeout_only === '1');
  const [callWaiterEnabled, setCallWaiterEnabled] = useState(settings.call_waiter_enabled !== '0');
  const [tippingEnabled, setTippingEnabled] = useState(settings.tipping_enabled === '1');
  const [tipPercentages, setTipPercentages] = useState(settings.tip_percentages || '15,18,20');
  const [adminPin, setAdminPin] = useState(settings.admin_pin || '');
  const [cardSurcharge, setCardSurcharge] = useState(settings.card_surcharge || '3');

  // Idle screen
  const [idleEnabled, setIdleEnabled] = useState(settings.idle_screen_enabled === '1');
  const [idleTimeout, setIdleTimeout] = useState(settings.idle_screen_timeout || '3');
  const [idleMessage, setIdleMessage] = useState(settings.idle_screen_message || 'Welcome! Tap to start ordering');
  const [idleBgImage, setIdleBgImage] = useState(settings.idle_screen_bg_image || '');

  // Server network URL
  const [serverUrl, setServerUrl] = useState('');

  // Packaging
  const [packagingOptions, setPackagingOptions] = useState<PackagingOption[]>([]);
  const [newPackaging, setNewPackaging] = useState('');

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    fetch('/api/server-info').then(r => r.json()).then(data => {
      if (data.url) setServerUrl(data.url);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setRestaurantName(settings.restaurant_name);
    setTableCount(settings.table_count);
    setCurrencySymbol(settings.currency_symbol);
    setOrderPrefix(settings.order_prefix);
    setThemeColor(settings.theme_color);
    setNativeLang(settings.native_language);
    setCustomerMode(settings.customer_mode_enabled === '1');
    setOrderTypesEnabled(new Set((settings.order_types_enabled || 'dine_in,takeout,pickup').split(',').filter(Boolean)));
    setTakeoutOnly(settings.takeout_only === '1');
    setCallWaiterEnabled(settings.call_waiter_enabled !== '0');
    setTippingEnabled(settings.tipping_enabled === '1');
    setTipPercentages(settings.tip_percentages || '15,18,20');
    setAdminPin(settings.admin_pin || '');
    setCardSurcharge(settings.card_surcharge || '3');
    setIdleEnabled(settings.idle_screen_enabled === '1');
    setIdleTimeout(settings.idle_screen_timeout || '3');
    setIdleMessage(settings.idle_screen_message || 'Welcome! Tap to start ordering');
    setIdleBgImage(settings.idle_screen_bg_image || '');
  }, [settings]);

  useEffect(() => {
    fetch('/api/packaging-options').then(r => r.json()).then(setPackagingOptions).catch(() => {});
  }, []);

  const handleSave = async () => {
    await updateSettings({
      restaurant_name: restaurantName,
      table_count: tableCount,
      currency_symbol: currencySymbol,
      order_prefix: orderPrefix,
      theme_color: themeColor,
      native_language: nativeLang,
      supported_languages: LANGUAGE_OPTIONS.map(l => l.code).join(','),
      customer_mode_enabled: customerMode ? '1' : '0',
      order_types_enabled: [...orderTypesEnabled].join(','),
      takeout_only: takeoutOnly ? '1' : '0',
      call_waiter_enabled: callWaiterEnabled ? '1' : '0',
      tipping_enabled: tippingEnabled ? '1' : '0',
      tip_percentages: tipPercentages,
      admin_pin: adminPin,
      card_surcharge: cardSurcharge,
      idle_screen_enabled: idleEnabled ? '1' : '0',
      idle_screen_timeout: idleTimeout,
      idle_screen_message: idleMessage,
      idle_screen_bg_image: idleBgImage,
    });
    setDirty(false);
  };

  const toggleOrderType = (type: string) => {
    const next = new Set(orderTypesEnabled);
    if (next.has(type)) {
      if (next.size <= 1) return; // Must have at least one
      next.delete(type);
    } else {
      next.add(type);
    }
    setOrderTypesEnabled(next);
    setDirty(true);
  };

  const handleLogoUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/uploads', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.filename) {
      await updateSetting('logo', data.filename);
    }
  };

  const generateQR = async () => {
    const baseUrl = serverUrl || window.location.origin;
    const url = `${baseUrl}/menu/${qrTable}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    setQrDataUrl(dataUrl);
  };

  useEffect(() => {
    generateQR();
  }, [qrTable]);

  // Packaging CRUD
  const addPackaging = async () => {
    if (!newPackaging.trim()) return;
    const res = await fetch('/api/packaging-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPackaging.trim() }),
    });
    if (res.ok) {
      const item = await res.json();
      setPackagingOptions([...packagingOptions, item]);
      setNewPackaging('');
    }
  };

  const deletePackaging = async (id: number) => {
    await fetch(`/api/packaging-options/${id}`, { method: 'DELETE' });
    setPackagingOptions(packagingOptions.filter(p => p.id !== id));
  };

  const showTakeout = orderTypesEnabled.has('takeout') || orderTypesEnabled.has('pickup');

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Restaurant Info */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-200">Restaurant Info</h3>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Restaurant Name</label>
          <input
            value={restaurantName}
            onChange={e => { setRestaurantName(e.target.value); setDirty(true); }}
            className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Logo</label>
          <div className="flex items-center gap-3">
            {settings.logo && (
              <img src={`/uploads/${settings.logo}`} alt="Logo" className="w-16 h-16 rounded-lg object-cover" />
            )}
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleLogoUpload(file);
                };
                input.click();
              }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
            >
              {settings.logo ? 'Change Logo' : 'Upload Logo'}
            </button>
          </div>
        </div>
      </div>

      {/* Language Settings */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-200">Languages</h3>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">System Default Language</label>
          <select
            value={nativeLang}
            onChange={e => { setNativeLang(e.target.value); setDirty(true); }}
            className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white outline-none"
          >
            {LANGUAGE_OPTIONS.map(l => (
              <option key={l.code} value={l.code}>{l.name} ({l.flag})</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 mt-1">Default language for the entire app. Staff can set their own language in their profile.</p>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-3">
          <p className="text-xs text-slate-400">🌐 All 60+ languages are available for customers automatically. They pick their language when they sit down.</p>
        </div>
      </div>

      {/* Order Types */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-200">Order Types</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'dine_in', label: 'Dine-in', color: 'blue' },
            { key: 'takeout', label: 'Takeout', color: 'orange' },
            { key: 'pickup', label: 'Pickup', color: 'green' },
          ].map(t => {
            const isOn = orderTypesEnabled.has(t.key);
            return (
              <button
                key={t.key}
                onClick={() => toggleOrderType(t.key)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isOn
                    ? t.color === 'blue' ? 'bg-blue-600 text-white' : t.color === 'orange' ? 'bg-orange-600 text-white' : 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-200">Takeout Only Mode</div>
            <div className="text-xs text-slate-500">For food trucks — skip table selection</div>
          </div>
          <button
            onClick={() => { setTakeoutOnly(!takeoutOnly); setDirty(true); }}
            className={`w-12 h-7 rounded-full transition-colors ${takeoutOnly ? 'bg-orange-600' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${takeoutOnly ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Service */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-200">Service</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-200">Call Waiter Button</div>
            <div className="text-xs text-slate-500">Show "Call Waiter" button in customer mode</div>
          </div>
          <button
            onClick={() => { setCallWaiterEnabled(!callWaiterEnabled); setDirty(true); }}
            className={`w-12 h-7 rounded-full transition-colors ${callWaiterEnabled ? 'bg-green-600' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${callWaiterEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-200">Tipping</div>
            <div className="text-xs text-slate-500">Allow customers to add a tip at checkout</div>
          </div>
          <button
            onClick={() => { setTippingEnabled(!tippingEnabled); setDirty(true); }}
            className={`w-12 h-7 rounded-full transition-colors ${tippingEnabled ? 'bg-green-600' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${tippingEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        {tippingEnabled && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tip Percentages (comma-separated)</label>
            <input
              value={tipPercentages}
              onChange={e => { setTipPercentages(e.target.value); setDirty(true); }}
              placeholder="15,18,20"
              className="w-full bg-slate-700 rounded-lg px-4 py-2 text-white outline-none"
            />
          </div>
        )}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Card Processing Surcharge (%)</label>
          <div className="flex items-center gap-3">
            <input
              value={cardSurcharge}
              onChange={e => { setCardSurcharge(e.target.value); setDirty(true); }}
              placeholder="3"
              type="number"
              min="0"
              max="10"
              step="0.5"
              className="w-24 bg-slate-700 rounded-lg px-4 py-2 text-white outline-none"
            />
            <span className="text-xs text-slate-500">Set to 0 to disable. Customers see both cash and card prices at checkout.</span>
          </div>
        </div>
      </div>

      {/* Website Integration */}
      <WebsiteEmbed />

      {/* Printers */}
      <PrinterSettings />

      {/* Payments */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-200">Payments</h3>
        <p className="text-xs text-slate-400">Connect a payment provider. Helcim has the lowest rates. The system uses whichever has keys (priority: Helcim → Square → Stripe).</p>

        {/* Helcim */}
        <div className="bg-slate-700/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Helcim</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Best rate — 2-3% interchange+</span>
          </div>
          <p className="text-[10px] text-slate-400">Get API token at <span className="text-blue-400">helcim.com → Settings → API Access</span></p>
          <input value={settings.helcim_api_token || ''} onChange={e => updateSetting('helcim_api_token', e.target.value.trim())}
            placeholder="API Token" type="password" className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-xs font-mono" />
          {settings.helcim_api_token ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Helcim connected</div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-slate-600" /> Not connected</div>
          )}
        </div>

        {/* Square */}
        <div className="bg-slate-700/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Square</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Recommended — 2.6% + 10¢</span>
          </div>
          <p className="text-[10px] text-slate-400">Get keys at <span className="text-blue-400">developer.squareup.com</span></p>
          <input value={settings.square_access_token || ''} onChange={e => updateSetting('square_access_token', e.target.value.trim())}
            placeholder="Access Token" type="password" className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-xs font-mono" />
          <input value={settings.square_location_id || ''} onChange={e => updateSetting('square_location_id', e.target.value.trim())}
            placeholder="Location ID" className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-xs font-mono" />
          {settings.square_access_token ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Square connected</div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-slate-600" /> Not connected</div>
          )}
        </div>

        {/* Stripe */}
        <div className="bg-slate-700/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Stripe</span>
            <span className="text-[10px] text-slate-400 bg-slate-600/50 px-2 py-0.5 rounded-full">2.9% + 30¢</span>
          </div>
          <p className="text-[10px] text-slate-400">Get keys at <span className="text-blue-400">dashboard.stripe.com/apikeys</span></p>
          <input value={settings.stripe_publishable_key || ''} onChange={e => updateSetting('stripe_publishable_key', e.target.value.trim())}
            placeholder="Publishable Key (pk_...)" className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-xs font-mono" />
          <input value={settings.stripe_secret_key || ''} onChange={e => updateSetting('stripe_secret_key', e.target.value.trim())}
            placeholder="Secret Key (sk_...)" type="password" className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-xs font-mono" />
          {settings.stripe_secret_key ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Stripe connected</div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-slate-600" /> Not connected</div>
          )}
        </div>
      </div>

      {/* Security */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-200">Security</h3>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Admin PIN</label>
          <input
            type="text"
            inputMode="numeric"
            value={adminPin}
            onChange={e => { setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setDirty(true); }}
            placeholder="e.g. 1234 (leave empty to disable)"
            className="w-full bg-slate-700 rounded-lg px-4 py-2 text-white outline-none tracking-widest text-lg"
            maxLength={6}
          />
          <p className="text-xs text-slate-500 mt-1">Required to exit customer mode. Leave empty for no PIN.</p>
        </div>
      </div>

      {/* Packaging (when takeout/pickup enabled) */}
      {showTakeout && (
        <div className="bg-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-slate-200">Packaging Options</h3>
          <p className="text-xs text-slate-400">Options offered for takeout/pickup orders (e.g. chopsticks, utensils, bags)</p>
          {packagingOptions.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-sm text-white flex-1">{p.name}</span>
              <button onClick={() => deletePackaging(p.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={newPackaging}
              onChange={(e) => setNewPackaging(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPackaging()}
              placeholder="Option name (e.g. Chopsticks)"
              className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-white outline-none"
            />
            <button onClick={addPackaging} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Add</button>
          </div>
        </div>
      )}

      {/* Ordering */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-200">Ordering</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tables</label>
            <input
              value={tableCount}
              onChange={e => { setTableCount(e.target.value); setDirty(true); }}
              type="number"
              min="1"
              max="100"
              className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Currency</label>
            <input
              value={currencySymbol}
              onChange={e => { setCurrencySymbol(e.target.value); setDirty(true); }}
              className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white outline-none"
              maxLength={5}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Order Prefix</label>
            <input
              value={orderPrefix}
              onChange={e => { setOrderPrefix(e.target.value); setDirty(true); }}
              className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white outline-none"
              maxLength={3}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Theme Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={themeColor}
              onChange={e => { setThemeColor(e.target.value); setDirty(true); }}
              className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-0"
            />
            <span className="text-sm text-slate-400">{themeColor}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-200">Customer Self-Order</div>
            <div className="text-xs text-slate-500">Allow customers to order via QR code</div>
          </div>
          <button
            onClick={() => { setCustomerMode(!customerMode); setDirty(true); }}
            className={`w-12 h-7 rounded-full transition-colors ${customerMode ? 'bg-green-600' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${customerMode ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* QR Code Generator */}
      {customerMode && (
        <div className="bg-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-slate-200">QR Code Generator</h3>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400">Table:</label>
            <select
              value={qrTable}
              onChange={e => setQrTable(e.target.value)}
              className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none"
            >
              {Array.from({ length: parseInt(tableCount) || 20 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-xl">
                <img src={qrDataUrl} alt={`QR code for table ${qrTable}`} className="w-48 h-48" />
              </div>
              <p className="text-xs text-slate-400">Table {qrTable} &mdash; {serverUrl || window.location.origin}/menu/{qrTable}</p>
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `table-${qrTable}-qr.png`;
                  link.href = qrDataUrl;
                  link.click();
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
              >
                Download QR
              </button>
            </div>
          )}
          <button
            onClick={async () => {
              const baseUrl = serverUrl || window.location.origin;
              const count = parseInt(tableCount) || 20;
              const printWin = window.open('', '_blank', 'width=800,height=600');
              if (!printWin) return;
              let html = '<html><head><title>Table QR Codes</title><style>body{font-family:system-ui;margin:0}' +
                '.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;padding:16px}' +
                '.card{text-align:center;border:1px solid #ccc;border-radius:12px;padding:16px;break-inside:avoid}' +
                '.card img{width:160px;height:160px}' +
                '.card h3{font-size:24px;margin:8px 0 4px}' +
                '.card p{font-size:10px;color:#666;margin:0}' +
                '@media print{.grid{gap:8px;padding:8px}.card{padding:8px}.card img{width:120px;height:120px}}</style></head><body><div class="grid">';
              for (let i = 1; i <= count; i++) {
                const url = `${baseUrl}/menu/${i}`;
                const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
                html += `<div class="card"><img src="${dataUrl}"/><h3>Table ${i}</h3><p>${url}</p></div>`;
              }
              html += '</div><script>window.onload=function(){window.print()}<\/script></body></html>';
              printWin.document.write(html);
              printWin.document.close();
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors"
          >
            Print All Table QR Codes
          </button>
        </div>
      )}

      {/* Idle / Welcome Screen */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-200">Tablet Welcome Screen</h3>
        <p className="text-xs text-slate-400">Show a welcome screen on table tablets when idle. Tap anywhere to dismiss and start ordering.</p>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-200">Enable Welcome Screen</div>
            <div className="text-xs text-slate-500">Shows after inactivity on customer tablets</div>
          </div>
          <button
            onClick={() => { setIdleEnabled(!idleEnabled); setDirty(true); }}
            className={`w-12 h-7 rounded-full transition-colors ${idleEnabled ? 'bg-green-600' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${idleEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {idleEnabled && (
          <>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Timeout (minutes before showing)</label>
              <select
                value={idleTimeout}
                onChange={e => { setIdleTimeout(e.target.value); setDirty(true); }}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white outline-none"
              >
                {[1, 2, 3, 5, 10, 15].map(m => (
                  <option key={m} value={m}>{m} {m === 1 ? 'minute' : 'minutes'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Welcome Message</label>
              <textarea
                value={idleMessage}
                onChange={e => { setIdleMessage(e.target.value); setDirty(true); }}
                placeholder="Welcome! Tap to start ordering"
                rows={2}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white outline-none resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Background Image</label>
              <div className="flex items-center gap-3">
                {idleBgImage && (
                  <img src={`/uploads/${idleBgImage}`} alt="Background" className="w-20 h-14 rounded-lg object-cover" />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('file', file);
                        const res = await fetch('/api/uploads', { method: 'POST', body: formData });
                        const data = await res.json();
                        if (data.filename) { setIdleBgImage(data.filename); await updateSetting('idle_screen_bg_image', data.filename); }
                      };
                      input.click();
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
                  >
                    {idleBgImage ? 'Change' : 'Upload'}
                  </button>
                  {idleBgImage && (
                    <button
                      onClick={() => { setIdleBgImage(''); setDirty(true); }}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg text-sm text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Uses your restaurant logo + name automatically. Background image is optional.</p>
            </div>

            {/* Preview */}
            <div
              className="relative rounded-xl overflow-hidden h-40 flex items-center justify-center"
              style={{
                background: idleBgImage ? undefined : `linear-gradient(135deg, ${themeColor}dd, ${themeColor}44)`,
              }}
            >
              {idleBgImage && (
                <>
                  <img src={`/uploads/${idleBgImage}`} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50" />
                </>
              )}
              <div className="relative z-10 text-center">
                {settings.logo && (
                  <img src={`/uploads/${settings.logo}`} alt="" className="w-12 h-12 rounded-xl object-contain mx-auto mb-2 bg-white/10" />
                )}
                <div className="text-white font-bold text-lg" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>
                  {restaurantName || 'Restaurant Name'}
                </div>
                <div className="text-white/80 text-xs mt-1">{idleMessage || 'Welcome message'}</div>
                <div className="text-white/50 text-[10px] mt-2">Preview</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Software Updates */}
      <UpdateChecker />

      {/* Backup & Restore */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-200">Backup & Restore</h3>
        <p className="text-xs text-slate-400">Download your entire menu, settings, and history. Restore to recover from data loss or move to a new device.</p>
        <div className="flex gap-2">
          <a
            href="/api/backup/full"
            download
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-center bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Download Backup
          </a>
          <label className="flex-1 py-3 rounded-xl text-sm font-semibold text-center bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer">
            Restore Backup
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!confirm('Restore from backup? This will replace ALL current menu data and settings.')) return;
                try {
                  const text = await file.text();
                  const data = JSON.parse(text);
                  const res = await fetch('/api/backup/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                  });
                  const result = await res.json();
                  if (result.ok) {
                    alert('Backup restored! Refreshing...');
                    window.location.reload();
                  } else {
                    alert('Restore failed: ' + (result.error || 'Unknown error'));
                  }
                } catch (err) {
                  alert('Invalid backup file');
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="text-[10px] text-slate-500">Tip: Download a backup before making major menu changes or closing for the day.</p>
      </div>

      {/* Close Day */}
      <EndOfDay />
      <DailyLogView />

      {/* Sandbox / Go Live */}
      {settings.sandbox_mode === '1' && (
        <div className="bg-orange-900/30 border border-orange-700/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧪</span>
            <h3 className="font-semibold text-orange-300">Sandbox Mode Active</h3>
          </div>
          <p className="text-xs text-orange-300/70">You're in test mode. All orders and data are practice runs. When you're ready to serve real customers, tap Go Live below. This will clear all test data and switch to production mode.</p>
          <button
            onClick={async () => {
              if (!confirm('Go live? This will clear all test orders, logs, and time entries. Your menu, employees, and settings will be kept.')) return;
              await fetch('/api/reset-financial-data', { method: 'POST' });
              await updateSetting('sandbox_mode', '0');
              alert('You are now LIVE! World Menu is ready for real customers.');
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold text-base transition-colors"
          >
            🚀 Go Live — Start Serving Real Customers
          </button>
        </div>
      )}

      {/* Save */}
      {dirty && (
        <button
          onClick={handleSave}
          className="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-xl font-bold text-lg transition-colors"
        >
          Save Settings
        </button>
      )}
    </div>
  );
}

function DailyLogView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const fetchLogs = async () => {
    const res = await fetch('/api/daily-logs');
    setLogs(await res.json());
    setShowLogs(true);
  };

  if (!showLogs) {
    return (
      <button onClick={fetchLogs} className="text-xs text-slate-500 hover:text-slate-300">
        View past daily logs
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase">Daily Logs</span>
        <button onClick={() => setShowLogs(false)} className="text-xs text-slate-500">Hide</button>
      </div>
      {logs.length === 0 && <p className="text-xs text-slate-600">No logs yet</p>}
      {logs.map(log => {
        const topItems = JSON.parse(log.top_items || '[]');
        return (
          <div key={log.id} className="bg-slate-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-white">{log.date}</span>
              <span className="text-sm font-bold text-emerald-400">${log.total_revenue.toFixed(2)}</span>
            </div>
            <div className="text-xs text-slate-400">
              {log.order_count} orders · {log.item_count} items
            </div>
            {topItems.length > 0 && (
              <div className="text-[10px] text-slate-500 mt-1">
                Top: {topItems.slice(0, 5).map((i: any) => `${i.name} (${i.qty})`).join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PrinterSettings() {
  const { settings, updateSetting } = useSettings();
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<{ ip: string; port: number; name: string }[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleScan = async () => {
    setScanning(true);
    setFound([]);
    setTestResult(null);
    try {
      const res = await fetch('/api/printer/scan', { method: 'POST' });
      const data = await res.json();
      setFound(data.printers || []);
      if (data.printers?.length === 0) {
        setTestResult('No printers found. Make sure your printer is on and connected to the same network.');
      }
    } catch {
      setTestResult('Scan failed.');
    }
    setScanning(false);
  };

  const handleTest = async (ip: string) => {
    setTesting(ip);
    setTestResult(null);
    try {
      const res = await fetch('/api/printer/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      const data = await res.json();
      setTestResult(data.ok ? `Test page sent to ${ip}!` : `Failed to print to ${ip}`);
    } catch {
      setTestResult(`Failed to connect to ${ip}`);
    }
    setTesting(null);
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-slate-200">Printers</h3>
      <p className="text-xs text-slate-400">Auto-find thermal printers on your network. Assign one for receipts and one for kitchen tickets.</p>

      <button
        onClick={handleScan}
        disabled={scanning}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
          scanning ? 'bg-slate-600 text-slate-400' : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        {scanning ? 'Scanning network...' : 'Scan for Printers'}
      </button>

      {found.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-slate-400 font-medium">Found {found.length} printer{found.length !== 1 ? 's' : ''}:</span>
          {found.map(p => (
            <div key={p.ip} className="bg-slate-700/50 rounded-lg p-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white font-mono flex-1">{p.ip}</span>
              <button onClick={() => handleTest(p.ip)} disabled={testing === p.ip}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-600 hover:bg-slate-500 text-slate-200">
                {testing === p.ip ? '...' : 'Test'}
              </button>
              <button onClick={() => updateSetting('printer_receipt_ip', p.ip)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white">
                Set Receipt
              </button>
              <button onClick={() => updateSetting('printer_kitchen_ip', p.ip)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white">
                Set Kitchen
              </button>
            </div>
          ))}
        </div>
      )}

      {testResult && <p className="text-xs text-amber-400">{testResult}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Receipt Printer IP</label>
          <input value={settings.printer_receipt_ip || ''} onChange={e => updateSetting('printer_receipt_ip', e.target.value.trim())}
            placeholder="192.168.1.100" className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm font-mono" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Kitchen Printer IP</label>
          <input value={settings.printer_kitchen_ip || ''} onChange={e => updateSetting('printer_kitchen_ip', e.target.value.trim())}
            placeholder="192.168.1.101" className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm font-mono" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-200">Auto-print Kitchen Tickets</div>
          <div className="text-xs text-slate-500">Print automatically when orders come in</div>
        </div>
        <button onClick={() => updateSetting('printer_auto_kitchen', settings.printer_auto_kitchen === '1' ? '0' : '1')}
          className={`w-12 h-7 rounded-full transition-colors ${settings.printer_auto_kitchen === '1' ? 'bg-green-600' : 'bg-slate-600'}`}>
          <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${settings.printer_auto_kitchen === '1' ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div className="flex gap-4 text-xs">
        <span className={settings.printer_receipt_ip ? 'text-emerald-400' : 'text-slate-500'}>
          Receipt: {settings.printer_receipt_ip || 'Not set'}
        </span>
        <span className={settings.printer_kitchen_ip ? 'text-emerald-400' : 'text-slate-500'}>
          Kitchen: {settings.printer_kitchen_ip || 'Not set'}
        </span>
      </div>
    </div>
  );
}

function WebsiteEmbed() {
  const [copied, setCopied] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const baseUrl = serverUrl || window.location.origin;

  useEffect(() => {
    fetch('/api/server-info').then(r => r.json()).then(data => {
      if (data.url) setServerUrl(data.url);
    }).catch(() => {});
  }, []);

  const embedCodes = [
    {
      label: 'Order Button',
      desc: 'Floating "Order Online" button that opens the menu in a popup',
      code: `<script src="${baseUrl}/embed.js" data-url="${baseUrl}" data-text="Order Online" data-color="#3b82f6" data-mode="button"></script>`,
    },
    {
      label: 'Inline Menu',
      desc: 'Embed the full menu directly into your page',
      code: `<script src="${baseUrl}/embed.js" data-url="${baseUrl}" data-mode="inline"></script>`,
    },
    {
      label: 'Direct Link',
      desc: 'Link customers directly to your online menu',
      code: `${baseUrl}/menu`,
    },
    {
      label: 'iframe',
      desc: 'Manual iframe embed for full control',
      code: `<iframe src="${baseUrl}/menu" style="width:100%;max-width:480px;height:700px;border:none;border-radius:16px;" title="Order Online"></iframe>`,
    },
  ];

  const handleCopy = (code: string, label: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-slate-200">Website Integration</h3>
      <p className="text-xs text-slate-400">Add online ordering to your existing website. Copy any embed code below and paste it into your site's HTML.</p>

      {embedCodes.map(embed => (
        <div key={embed.label} className="bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">{embed.label}</span>
            <button
              onClick={() => handleCopy(embed.code, embed.label)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                copied === embed.label ? 'bg-emerald-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
              }`}
            >
              {copied === embed.label ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mb-2">{embed.desc}</p>
          <pre className="text-[10px] text-slate-300 bg-slate-900 rounded p-2 overflow-x-auto font-mono whitespace-pre-wrap break-all">
            {embed.code}
          </pre>
        </div>
      ))}
    </div>
  );
}

function UpdateChecker() {
  const { settings, updateSetting } = useSettings();
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    fetch('/api/version').then(r => r.json()).then(v => setCurrentVersion(v.version || '1.0.0')).catch(() => {});
  }, []);

  const checkForUpdate = async () => {
    setChecking(true);
    setUpdateResult(null);
    try {
      const res = await fetch('/api/check-update');
      setResult(await res.json());
    } catch {
      setResult({ message: 'Could not check for updates' });
    }
    setChecking(false);
  };

  const applyUpdate = async () => {
    if (!confirm('Update World Menu POS? Your data will be kept. The server will need a restart after.')) return;
    setUpdating(true);
    setUpdateResult(null);
    try {
      const res = await fetch('/api/apply-update', { method: 'POST' });
      setUpdateResult(await res.json());
    } catch {
      setUpdateResult({ ok: false, message: 'Update failed' });
    }
    setUpdating(false);
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-200">Software Updates</h3>
          <p className="text-xs text-slate-400 mt-1">Current version: <b>{currentVersion}</b></p>
          <p className="text-xs text-slate-500">Checks automatically twice a day</p>
        </div>
        <button onClick={checkForUpdate} disabled={checking}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: checking ? '#e2e8f0' : '#3b82f6', color: checking ? '#94a3b8' : '#fff' }}>
          {checking ? 'Checking...' : 'Check Now'}
        </button>
      </div>

      {result && result.available && !updating && !updateResult && (
        <div className="p-4 rounded-lg" style={{ background: '#dcfce7', border: '1px solid #86efac' }}>
          <div className="font-bold" style={{ color: '#166534', fontSize: 16 }}>Update available: v{result.latestVersion}</div>
          <div className="text-sm" style={{ color: '#15803d' }}>{result.releaseName}</div>
          {result.releaseDate && <div className="text-xs mt-1" style={{ color: '#16a34a' }}>{result.releaseDate.slice(0, 10)}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={applyUpdate}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: '#22c55e', color: '#fff' }}>
              Update Now
            </button>
          </div>
        </div>
      )}

      {updating && (
        <div className="p-5 rounded-lg text-center" style={{ background: '#eff6ff', border: '1px solid #93c5fd' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div className="font-bold" style={{ color: '#1e40af', fontSize: 16 }}>Updating World Menu POS...</div>
          <div className="text-sm mt-2" style={{ color: '#3b82f6' }}>Downloading and installing. Please wait, this may take a minute.</div>
          <div className="text-xs mt-2" style={{ color: '#93c5fd' }}>Do not close this page or turn off the computer.</div>
          <div style={{ marginTop: 12, width: '100%', height: 4, background: '#bfdbfe', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: '60%', height: '100%', background: '#3b82f6', borderRadius: 2, animation: 'updatePulse 1.5s ease-in-out infinite' }} />
          </div>
          <style>{`@keyframes updatePulse { 0%,100% { width: 30%; } 50% { width: 80%; } }`}</style>
        </div>
      )}

      {result && !result.available && !result.message && (
        <div className="text-sm" style={{ color: '#22c55e' }}>You're up to date!</div>
      )}

      {updateResult && (
        <div className="p-4 rounded-lg" style={{ background: updateResult.ok ? '#dcfce7' : '#fee2e2', border: `1px solid ${updateResult.ok ? '#86efac' : '#fca5a5'}` }}>
          <div style={{ color: updateResult.ok ? '#166534' : '#991b1b', fontWeight: 600, fontSize: 15 }}>{updateResult.message}</div>
          {updateResult.ok && (
            <div className="mt-3 p-3 rounded-lg" style={{ background: '#f0fdf4' }}>
              <p className="text-sm font-semibold" style={{ color: '#166534' }}>To finish the update:</p>
              <ol className="text-sm mt-1 space-y-1" style={{ color: '#15803d', paddingLeft: 20 }}>
                <li>Close the server window (the black command prompt)</li>
                <li>Double-click <b>START.bat</b> to restart</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {result && result.message && (
        <div className="text-sm" style={{ color: '#94a3b8' }}>{result.message}</div>
      )}

      {/* GitHub repo is set internally — not shown to end users */}
    </div>
  );
}

function AutoReloadOnUpdate({ trigger }: { trigger: boolean }) {
  useEffect(() => {
    if (!trigger) return;
    const timer = setTimeout(() => window.location.reload(), 8000);
    return () => clearTimeout(timer);
  }, [trigger]);
  return null;
}

function EndOfDay() {
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [closed, setClosed] = useState(false);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const [activeRes, finishedRes, timeRes] = await Promise.all([
        fetch('/api/orders/active').then(r => r.json()),
        fetch('/api/orders/finished').then(r => r.json()),
        fetch(`/api/time-entries?date=${new Date().toISOString().slice(0, 10)}`).then(r => r.json()),
      ]);
      const allOrders = [...activeRes, ...finishedRes];
      const totalRevenue = allOrders.reduce((s: number, o: any) =>
        s + (o.items || []).reduce((is: number, i: any) => is + (i.item_price || 0) * i.quantity, 0), 0);
      const totalOrders = allOrders.length;
      const totalItems = allOrders.reduce((s: number, o: any) => s + (o.items || []).length, 0);
      const totalTips = allOrders.reduce((s: number, o: any) => s + (o.tip_amount || 0), 0);
      const voidedCount = allOrders.filter((o: any) => o.status === 'voided').length;

      // Time entries
      const clockedOut = timeRes.filter((e: any) => e.clock_out);
      const totalHours = clockedOut.reduce((s: number, e: any) =>
        s + (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000, 0);
      const totalLabor = clockedOut.reduce((s: number, e: any) => {
        const hours = (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
        return s + hours * (e.hourly_rate || 0);
      }, 0);

      setSummary({ totalRevenue, totalOrders, totalItems, totalTips, voidedCount, totalHours, totalLabor, timeEntries: timeRes });
    } catch {}
    setLoading(false);
  };

  const handleCloseDay = async () => {
    if (!confirm('Close the day? This will archive all orders, save the daily log, and reset for tomorrow.')) return;
    await fetch('/api/daily-reset', { method: 'POST' });
    setClosed(true);
  };

  const handlePrint = () => {
    if (!summary) return;
    const date = new Date().toLocaleDateString();
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`<html><head><title>Daily Report — ${date}</title>
      <style>body{font-family:monospace;font-size:12px;padding:20px;max-width:300px;margin:0 auto}
      h1{font-size:16px;text-align:center;border-bottom:2px solid #000;padding-bottom:8px}
      h2{font-size:13px;margin-top:16px;border-bottom:1px dashed #999;padding-bottom:4px}
      .row{display:flex;justify-content:space-between;padding:2px 0}
      .total{font-weight:bold;font-size:14px;border-top:2px solid #000;padding-top:8px;margin-top:8px}
      .center{text-align:center}</style></head><body>
      <h1>${settings.restaurant_name || 'Restaurant'}</h1>
      <div class="center">${date}</div>
      <h2>Sales Summary</h2>
      <div class="row"><span>Orders</span><span>${summary.totalOrders}</span></div>
      <div class="row"><span>Items Sold</span><span>${summary.totalItems}</span></div>
      <div class="row"><span>Voided</span><span>${summary.voidedCount}</span></div>
      <div class="row"><span>Tips</span><span>${currency}${summary.totalTips.toFixed(2)}</span></div>
      <div class="row total"><span>TOTAL REVENUE</span><span>${currency}${summary.totalRevenue.toFixed(2)}</span></div>
      <h2>Labor</h2>
      <div class="row"><span>Total Hours</span><span>${summary.totalHours.toFixed(1)}h</span></div>
      <div class="row"><span>Labor Cost</span><span>${currency}${summary.totalLabor.toFixed(2)}</span></div>
      ${(summary.timeEntries || []).map((e: any) =>
        `<div class="row"><span>${e.employee_name}</span><span>${e.clock_in?.slice(11, 16)} → ${e.clock_out?.slice(11, 16) || '...'}</span></div>`
      ).join('')}
      <div class="center" style="margin-top:20px;font-size:10px;color:#999">Generated by World Menu POS</div>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  if (closed) {
    return (
      <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-lg font-bold text-emerald-400">Day Closed!</h3>
        <p className="text-sm text-emerald-300/70 mt-1">All orders archived. Ready for tomorrow.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-slate-200">End of Day</h3>
      <p className="text-xs text-slate-400">Review today's numbers, print a report, then close out for the day.</p>

      {!summary ? (
        <button
          onClick={loadSummary}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-semibold text-base transition-colors"
        >
          {loading ? 'Loading...' : 'Review & Close Day'}
        </button>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">{summary.totalOrders}</div>
              <div className="text-[10px] text-slate-500 uppercase">Orders</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-emerald-400">{currency}{summary.totalRevenue.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500 uppercase">Revenue</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-amber-400">{currency}{summary.totalTips.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500 uppercase">Tips</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-blue-400">{summary.totalHours.toFixed(1)}h</div>
              <div className="text-[10px] text-slate-500 uppercase">Labor Hours</div>
            </div>
          </div>

          {summary.voidedCount > 0 && (
            <div className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
              {summary.voidedCount} voided order(s) today
            </div>
          )}

          {/* Labor breakdown */}
          {summary.timeEntries && summary.timeEntries.length > 0 && (
            <div className="bg-slate-700/30 rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-400 mb-2 uppercase">Staff Hours</div>
              {summary.timeEntries.map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-300">{e.employee_name}</span>
                  <span className="text-slate-500">{e.clock_in?.slice(11, 16)} → {e.clock_out?.slice(11, 16) || 'Still clocked in'}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs mt-2 pt-2 border-t border-slate-700/50">
                <span className="text-slate-400">Labor Cost</span>
                <span className="text-emerald-400 font-bold">{currency}{summary.totalLabor.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-semibold text-sm transition-colors">
              🖨 Print Report
            </button>
            <button
              onClick={handleCloseDay}
              className="flex-1 bg-red-600 hover:bg-red-500 py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              Close Day
            </button>
          </div>
          <button onClick={() => setSummary(null)} className="w-full text-xs text-slate-500 hover:text-slate-300 py-1">
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
