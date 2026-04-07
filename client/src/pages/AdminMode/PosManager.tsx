import { useState } from 'react';
import EmployeeManager from './pos/EmployeeManager';
import DiscountManager from './pos/DiscountManager';
import TaxManager from './pos/TaxManager';
import InventoryManager from './pos/InventoryManager';
import CustomerManager from './pos/CustomerManager';
import ReservationManager from './pos/ReservationManager';
import GiftCardManager from './pos/GiftCardManager';
import ScheduleManager from './pos/ScheduleManager';
import CashDrawerManager from './pos/CashDrawerManager';
import RefundManager from './pos/RefundManager';

type Tab = 'employees' | 'discounts' | 'tax' | 'inventory' | 'customers' | 'reservations' | 'gift_cards' | 'schedules' | 'cash_drawer' | 'refunds';

interface TabItem {
  key: Tab;
  label: string;
  icon: string;
}

interface TabGroup {
  name: string;
  icon: string;
  tabs: TabItem[];
}

const tabGroups: TabGroup[] = [
  {
    name: 'People',
    icon: '👤',
    tabs: [
      { key: 'employees', label: 'Employees', icon: '👥' },
      { key: 'customers', label: 'Customers', icon: '⭐' },
    ],
  },
  {
    name: 'Money',
    icon: '💵',
    tabs: [
      { key: 'discounts', label: 'Discounts & Promos', icon: '🏷️' },
      { key: 'gift_cards', label: 'Gift Cards', icon: '🎁' },
      { key: 'tax', label: 'Tax Rates', icon: '📊' },
      { key: 'cash_drawer', label: 'Cash Drawer', icon: '💰' },
    ],
  },
  {
    name: 'Operations',
    icon: '⚙️',
    tabs: [
      { key: 'inventory', label: 'Inventory', icon: '📦' },
      { key: 'reservations', label: 'Reservations', icon: '📅' },
      { key: 'schedules', label: 'Schedules', icon: '🕐' },
      { key: 'refunds', label: 'Refunds', icon: '↩️' },
    ],
  },
];

export default function PosManager() {
  const [tab, setTab] = useState<Tab>('employees');

  return (
    <div className="space-y-4">
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        {tabGroups.map((group, gi) => (
          <div
            key={group.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0px',
            }}
          >
            {gi > 0 && (
              <div
                style={{
                  width: '1px',
                  height: '32px',
                  backgroundColor: '#d1d5db',
                  marginRight: '12px',
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  paddingLeft: '4px',
                }}
              >
                {group.icon} {group.name}
              </span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {group.tabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s, color 0.15s',
                      backgroundColor: tab === t.key ? '#7c3aed' : '#f3f4f6',
                      color: tab === t.key ? '#ffffff' : '#374151',
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {tab === 'employees' && <EmployeeManager />}
      {tab === 'discounts' && <DiscountManager />}
      {tab === 'tax' && <TaxManager />}
      {tab === 'inventory' && <InventoryManager />}
      {tab === 'customers' && <CustomerManager />}
      {tab === 'reservations' && <ReservationManager />}
      {tab === 'gift_cards' && <GiftCardManager />}
      {tab === 'schedules' && <ScheduleManager />}
      {tab === 'cash_drawer' && <CashDrawerManager />}
      {tab === 'refunds' && <RefundManager />}
    </div>
  );
}
