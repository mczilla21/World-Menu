-- Daily sales log
CREATE TABLE IF NOT EXISTS daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  order_count INTEGER DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  top_items TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Add archived flag to orders instead of deleting
ALTER TABLE orders ADD COLUMN is_archived INTEGER DEFAULT 0;
