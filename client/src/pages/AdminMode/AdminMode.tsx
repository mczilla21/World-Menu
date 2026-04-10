import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenu } from '../../hooks/useMenu';
import { useI18n } from '../../i18n/useI18n';

const CategoryManager = lazy(() => import('./CategoryManager'));
const MenuItemManager = lazy(() => import('./MenuItemManager'));
const ModifierManager = lazy(() => import('./ModifierManager'));
const TranslationManager = lazy(() => import('./TranslationManager'));
const SettingsManager = lazy(() => import('./SettingsManager'));
const LicenseManager = lazy(() => import('./LicenseManager'));
const ReportsDashboard = lazy(() => import('./ReportsDashboard'));
const TaxReports = lazy(() => import('./TaxReports'));
const FloorPlanEditor = lazy(() => import('./FloorPlanEditor'));

// Lazy-load individual POS managers directly (no more PosManager wrapper duplication)
const EmployeeManager = lazy(() => import('./pos/EmployeeManager'));
const DiscountManager = lazy(() => import('./pos/DiscountManager'));
const TaxManager = lazy(() => import('./pos/TaxManager'));
const InventoryManager = lazy(() => import('./pos/InventoryManager'));
const CustomerManager = lazy(() => import('./pos/CustomerManager'));
const ReservationManager = lazy(() => import('./pos/ReservationManager'));
const GiftCardManager = lazy(() => import('./pos/GiftCardManager'));
const ScheduleManager = lazy(() => import('./pos/ScheduleManager'));
const CashDrawerManager = lazy(() => import('./pos/CashDrawerManager'));
const RefundManager = lazy(() => import('./pos/RefundManager'));
const StationManager = lazy(() => import('./pos/StationManager'));

type Section = 'menu' | 'floorplan' | 'team' | 'finance' | 'operations' | 'settings';
type SubTab = string;

const sections: { key: Section; label: string; icon: string; color: string; activeColor: string; subtabs: { key: string; label: string; emoji: string; color: string }[] }[] = [
  {
    key: 'menu', label: 'Menu', icon: '🍜', color: '#fef3c7', activeColor: '#f59e0b',
    subtabs: [
      { key: 'items', label: 'Items & Categories', emoji: '📋', color: '#f59e0b' },
      { key: 'modifiers', label: 'Customizations', emoji: '🔧', color: '#ea580c' },
      { key: 'translations', label: 'Languages', emoji: '🌐', color: '#0ea5e9' },
    ],
  },
  {
    key: 'floorplan', label: 'Floor Plan', icon: '🗺️', color: '#dcfce7', activeColor: '#22c55e',
    subtabs: [
      { key: 'floorplan', label: 'Layout', emoji: '🪑', color: '#22c55e' },
    ],
  },
  {
    key: 'team', label: 'Team', icon: '👥', color: '#dbeafe', activeColor: '#3b82f6',
    subtabs: [
      { key: 'employees', label: 'Employees & Time', emoji: '👥', color: '#3b82f6' },
      { key: 'stations', label: 'Stations', emoji: '📺', color: '#8b5cf6' },
      { key: 'schedules', label: 'Schedules', emoji: '🕐', color: '#6366f1' },
      { key: 'customers', label: 'Customers', emoji: '⭐', color: '#0ea5e9' },
    ],
  },
  {
    key: 'finance', label: 'Finance', icon: '💰', color: '#ede9fe', activeColor: '#8b5cf6',
    subtabs: [
      { key: 'reports', label: 'Dashboard', emoji: '📈', color: '#8b5cf6' },
      { key: 'tax_reports', label: 'Tax & Export', emoji: '🧾', color: '#059669' },
      { key: 'discounts', label: 'Discounts & Promos', emoji: '🏷️', color: '#ec4899' },
      { key: 'gift_cards', label: 'Gift Cards', emoji: '🎁', color: '#f59e0b' },
      { key: 'tax_rates', label: 'Tax Rates', emoji: '📊', color: '#14b8a6' },
      { key: 'cash_drawer', label: 'Cash Drawer', emoji: '💵', color: '#22c55e' },
    ],
  },
  {
    key: 'operations', label: 'Operations', icon: '📦', color: '#fee2e2', activeColor: '#ef4444',
    subtabs: [
      { key: 'inventory', label: 'Inventory', emoji: '📦', color: '#ef4444' },
      { key: 'reservations', label: 'Reservations', emoji: '📅', color: '#f97316' },
      { key: 'refunds', label: 'Refunds', emoji: '↩️', color: '#64748b' },
    ],
  },
  {
    key: 'settings', label: 'Settings', icon: '⚙️', color: '#f1f5f9', activeColor: '#64748b',
    subtabs: [
      { key: 'settings', label: 'Restaurant Settings', emoji: '⚙️', color: '#64748b' },
      { key: 'license', label: 'License', emoji: '🔑', color: '#8b5cf6' },
    ],
  },
];

export default function AdminMode() {
  const [section, setSection] = useState<Section>('menu');
  const [subTab, setSubTab] = useState<SubTab>('items');
  const { items, categories, refresh } = useMenu();
  const navigate = useNavigate();
  const { t } = useI18n();

  const switchRole = () => {
    localStorage.removeItem('role'); sessionStorage.removeItem('wm_employee');
    navigate('/');
  };

  const currentSection = sections.find(s => s.key === section)!;

  const handleSectionChange = (s: Section) => {
    setSection(s);
    const sec = sections.find(x => x.key === s)!;
    setSubTab(sec.subtabs[0].key);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/staff-select')} style={{ fontSize: 18, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>←</button>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{t('Admin Panel')}</h1>
        </div>
        <button onClick={switchRole} style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Logout</button>
      </header>

      {/* Main sections — colorful bubble cards */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {sections.map(s => {
          const isActive = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => handleSectionChange(s.key)}
              style={{
                flex: '1 1 auto', minWidth: 70, padding: '10px 6px', border: 'none', cursor: 'pointer',
                borderRadius: 14,
                fontSize: 11, fontWeight: 700,
                background: isActive ? s.activeColor : s.color,
                color: isActive ? '#fff' : '#0f172a',
                boxShadow: isActive ? `0 4px 12px ${s.activeColor}40` : 'none',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 20, display: 'block', marginBottom: 2 }}>{s.icon}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tabs — vibrant pills */}
      {currentSection.subtabs.length > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          {currentSection.subtabs.map(st => {
            const isActive = subTab === st.key;
            return (
              <button
                key={st.key}
                onClick={() => setSubTab(st.key)}
                style={{
                  padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: isActive ? st.color : '#f1f5f9',
                  color: isActive ? '#fff' : '#475569',
                  boxShadow: isActive ? `0 2px 8px ${st.color}30` : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {st.emoji} {st.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Suspense fallback={<div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Loading...</div>}>
          {/* Menu */}
          {subTab === 'items' && (
            <div className="space-y-4">
              <CategoryManager categories={categories} onUpdate={refresh} />
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }} />
              <MenuItemManager items={items} categories={categories} onUpdate={refresh} />
            </div>
          )}
          {subTab === 'modifiers' && <ModifierManager categories={categories} />}
          {subTab === 'translations' && <TranslationManager items={items} categories={categories} />}

          {/* Floor Plan */}
          {subTab === 'floorplan' && <FloorPlanEditor />}

          {/* Team */}
          {subTab === 'employees' && <EmployeeManager />}
          {subTab === 'stations' && <StationManager />}
          {subTab === 'schedules' && <ScheduleManager />}
          {subTab === 'customers' && <CustomerManager />}

          {/* Finance */}
          {subTab === 'reports' && <ReportsDashboard />}
          {subTab === 'tax_reports' && <TaxReports />}
          {subTab === 'discounts' && <DiscountManager />}
          {subTab === 'gift_cards' && <GiftCardManager />}
          {subTab === 'tax_rates' && <TaxManager />}
          {subTab === 'cash_drawer' && <CashDrawerManager />}

          {/* Operations */}
          {subTab === 'inventory' && <InventoryManager />}
          {subTab === 'reservations' && <ReservationManager />}
          {subTab === 'refunds' && <RefundManager />}

          {/* Settings */}
          {subTab === 'settings' && <SettingsManager />}
          {subTab === 'license' && <LicenseManager />}
        </Suspense>
      </div>
    </div>
  );
}
