-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('restaurant_name', 'My Restaurant'),
  ('native_language', 'en'),
  ('supported_languages', 'en'),
  ('currency_symbol', '$'),
  ('table_count', '20'),
  ('order_prefix', 'A'),
  ('theme_color', '#3b82f6'),
  ('customer_mode_enabled', '1'),
  ('logo', ''),
  ('github_repo', 'mczilla21/World-Menu');

-- Translations (flexible multi-language)
CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  field TEXT NOT NULL,
  lang TEXT NOT NULL,
  value TEXT NOT NULL,
  UNIQUE(entity_type, entity_id, field, lang)
);

-- Menu structure
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  show_in_kitchen INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  price REAL DEFAULT 0,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- Modifier system
CREATE TABLE IF NOT EXISTS modifier_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  selection_type TEXT DEFAULT 'single',
  required INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES modifier_groups(id),
  name TEXT NOT NULL,
  extra_price REAL DEFAULT 0,
  default_on INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  table_number TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  closed INTEGER DEFAULT 0,
  source TEXT DEFAULT 'server',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  menu_item_id INTEGER,
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  is_done INTEGER DEFAULT 0,
  show_in_kitchen INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  customer_number INTEGER DEFAULT 0,
  item_price REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_sequence (
  date_key TEXT PRIMARY KEY,
  last_number INTEGER DEFAULT 0
);
