CREATE INDEX IF NOT EXISTS idx_orders_table_closed ON orders(table_number, closed);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, closed, is_archived);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock ON time_entries(clock_in);
