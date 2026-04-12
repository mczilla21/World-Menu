-- Recreate order_items with ON DELETE CASCADE so voided/deleted orders clean up items
-- SQLite doesn't support ALTER TABLE to add/change constraints, so recreate
CREATE TABLE IF NOT EXISTS order_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  is_done INTEGER NOT NULL DEFAULT 0,
  show_in_kitchen INTEGER NOT NULL DEFAULT 1,
  notes TEXT DEFAULT '',
  customer_number INTEGER DEFAULT 0,
  item_price REAL DEFAULT 0,
  variant_name TEXT DEFAULT '',
  combo_id INTEGER,
  combo_slot_label TEXT DEFAULT ''
);

INSERT OR IGNORE INTO order_items_new SELECT * FROM order_items;
DROP TABLE IF EXISTS order_items;
ALTER TABLE order_items_new RENAME TO order_items;
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
