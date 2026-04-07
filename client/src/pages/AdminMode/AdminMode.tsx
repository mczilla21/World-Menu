import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenu } from '../../hooks/useMenu';
import CategoryManager from './CategoryManager';
import MenuItemManager from './MenuItemManager';
import ModifierManager from './ModifierManager';
import ComboManager from './ComboManager';
import TranslationManager from './TranslationManager';
import SettingsManager from './SettingsManager';
import ReportsDashboard from './ReportsDashboard';
import TaxReports from './TaxReports';
import PosManager from './PosManager';
import FloorPlanEditor from './FloorPlanEditor';
import { useI18n } from '../../i18n/useI18n';

type Section = 'menu' | 'floorplan' | 'staff' | 'business';
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
    key: 'floorplan', label: 'Floor Plan', icon: '🪑', color: '#dcfce7', activeColor: '#22c55e',
    subtabs: [
      { key: 'floorplan', label: 'Layout', emoji: '🗺️', color: '#22c55e' },
    ],
  },
  {
    key: 'staff', label: 'Staff', icon: '👥', color: '#dbeafe', activeColor: '#3b82f6',
    subtabs: [
      { key: 'employees', label: 'Employees & Time', emoji: '⏰', color: '#3b82f6' },
    ],
  },
  {
    key: 'business', label: 'Business', icon: '📊', color: '#ede9fe', activeColor: '#8b5cf6',
    subtabs: [
      { key: 'reports', label: 'Dashboard', emoji: '📈', color: '#8b5cf6' },
      { key: 'tax', label: 'Tax & Export', emoji: '🧾', color: '#059669' },
      { key: 'pos', label: 'Discounts & More', emoji: '🎁', color: '#ec4899' },
      { key: 'settings', label: 'Settings', emoji: '⚙️', color: '#64748b' },
    ],
  },
];

export default function AdminMode() {
  const [section, setSection] = useState<Section>('menu');
  const [subTab, setSubTab] = useState<SubTab>('items');
  const { items, categories, combos, refresh } = useMenu();
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

      {/* Main sections — 4 colorful bubble cards */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        {sections.map(s => {
          const isActive = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => handleSectionChange(s.key)}
              style={{
                flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
                borderRadius: 16,
                fontSize: 13, fontWeight: 700,
                background: isActive ? s.activeColor : s.color,
                color: isActive ? '#fff' : '#0f172a',
                boxShadow: isActive ? `0 4px 12px ${s.activeColor}40` : 'none',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 24, display: 'block', marginBottom: 4 }}>{s.icon}</span>
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
                  padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
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
        {/* Menu section */}
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

        {/* Staff */}
        {subTab === 'employees' && <PosManager />}

        {/* Business */}
        {subTab === 'reports' && <ReportsDashboard />}
        {subTab === 'tax' && <TaxReports />}
        {subTab === 'pos' && <PosManager />}
        {subTab === 'settings' && <SettingsManager />}
      </div>
    </div>
  );
}
