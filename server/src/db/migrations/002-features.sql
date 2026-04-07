-- =============================================
-- World Menu v2: Feature Expansion Migration
-- =============================================

-- === Menu Item Enhancements ===
ALTER TABLE menu_items ADD COLUMN is_popular INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN prep_time_minutes INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN is_special INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN special_price REAL DEFAULT NULL;
ALTER TABLE menu_items ADD COLUMN serves TEXT DEFAULT '';
ALTER TABLE menu_items ADD COLUMN is_alcohol INTEGER DEFAULT 0;

-- === Order Enhancements ===
ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in';
ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN customer_status TEXT DEFAULT 'received';
ALTER TABLE orders ADD COLUMN tip_amount REAL DEFAULT 0;

-- === Order Item Enhancements ===
ALTER TABLE order_items ADD COLUMN variant_name TEXT DEFAULT '';
ALTER TABLE order_items ADD COLUMN combo_id INTEGER DEFAULT NULL;
ALTER TABLE order_items ADD COLUMN combo_slot_label TEXT DEFAULT '';

-- === Item Variants (Sizes) ===
CREATE TABLE IF NOT EXISTS item_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- === Combo Meals ===
CREATE TABLE IF NOT EXISTS combos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS combo_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- === Allergens ===
CREATE TABLE IF NOT EXISTS item_allergens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  allergen_code TEXT NOT NULL,
  UNIQUE(menu_item_id, allergen_code)
);

-- === Service Calls (Call Waiter) ===
CREATE TABLE IF NOT EXISTS service_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  resolved_at TEXT
);

-- === Packaging Options (Takeout) ===
CREATE TABLE IF NOT EXISTS packaging_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS order_packaging (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  packaging_option_id INTEGER NOT NULL,
  UNIQUE(order_id, packaging_option_id)
);

-- === New Settings ===
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('order_types_enabled', 'dine_in,takeout,pickup'),
  ('takeout_only', '0'),
  ('call_waiter_enabled', '1'),
  ('tipping_enabled', '0'),
  ('tip_percentages', '15,18,20');
