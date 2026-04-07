-- =============================================
-- World Menu POS: Full Feature Set
-- =============================================

-- === 1. Employees ===
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT DEFAULT 'server',
  hourly_rate REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- === 2. Time Entries (Clock In/Out) ===
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  clock_in TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  clock_out TEXT,
  break_minutes INTEGER DEFAULT 0,
  tips REAL DEFAULT 0,
  notes TEXT DEFAULT ''
);

-- === 3. Discounts & Promos ===
CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'percent',
  value REAL NOT NULL DEFAULT 0,
  code TEXT DEFAULT '',
  min_order REAL DEFAULT 0,
  max_uses INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  schedule_start TEXT DEFAULT '',
  schedule_end TEXT DEFAULT '',
  schedule_days TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- === 4. Refunds & Voids ===
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id),
  order_item_id INTEGER,
  amount REAL NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  type TEXT DEFAULT 'refund',
  employee_id INTEGER REFERENCES employees(id),
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- === 5. Tax Rates ===
CREATE TABLE IF NOT EXISTS tax_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 0,
  applies_to TEXT DEFAULT 'all',
  is_active INTEGER DEFAULT 1
);

-- Default tax rate
INSERT OR IGNORE INTO tax_rates (id, name, rate, applies_to) VALUES (1, 'Sales Tax', 7.0, 'all');

-- === 6. Split Payments ===
CREATE TABLE IF NOT EXISTS split_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  method TEXT NOT NULL DEFAULT 'card',
  amount REAL NOT NULL DEFAULT 0,
  guest_number INTEGER DEFAULT 0,
  reference TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- === 7. Cash Drawer Sessions ===
CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER REFERENCES employees(id),
  opened_at TEXT DEFAULT (datetime('now', 'localtime')),
  closed_at TEXT,
  starting_amount REAL DEFAULT 0,
  ending_amount REAL,
  expected_amount REAL DEFAULT 0,
  cash_in REAL DEFAULT 0,
  cash_out REAL DEFAULT 0,
  over_short REAL DEFAULT 0,
  notes TEXT DEFAULT ''
);

-- === 8. Customers & Loyalty ===
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  points INTEGER DEFAULT 0,
  total_visits INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  birthday TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- === 9. Inventory ===
CREATE TABLE IF NOT EXISTS inventory (
  menu_item_id INTEGER PRIMARY KEY REFERENCES menu_items(id),
  stock_count INTEGER DEFAULT -1,
  low_stock_threshold INTEGER DEFAULT 5,
  auto_86 INTEGER DEFAULT 1
);

-- === 10. Menu Schedules ===
CREATE TABLE IF NOT EXISTS menu_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  days TEXT DEFAULT 'mon,tue,wed,thu,fri,sat,sun',
  category_ids TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1
);

-- === 11. Reservations ===
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  party_size INTEGER DEFAULT 2,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  table_number TEXT DEFAULT '',
  status TEXT DEFAULT 'confirmed',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- === 12. Gift Cards ===
CREATE TABLE IF NOT EXISTS gift_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  balance REAL NOT NULL DEFAULT 0,
  original_amount REAL NOT NULL DEFAULT 0,
  customer_name TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- === 13. Order enhancements for POS ===
ALTER TABLE orders ADD COLUMN employee_id INTEGER DEFAULT NULL;
ALTER TABLE orders ADD COLUMN discount_id INTEGER DEFAULT NULL;
ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN tax_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN payment_reference TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN customer_id INTEGER DEFAULT NULL;
ALTER TABLE orders ADD COLUMN gift_card_id INTEGER DEFAULT NULL;
