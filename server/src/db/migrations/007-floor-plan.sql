-- Floor plan tables with position, type, and capacity
CREATE TABLE IF NOT EXISTS floor_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  type TEXT DEFAULT 'table',
  x REAL DEFAULT 100,
  y REAL DEFAULT 100,
  width REAL DEFAULT 80,
  height REAL DEFAULT 80,
  rotation REAL DEFAULT 0,
  capacity INTEGER DEFAULT 4,
  is_active INTEGER DEFAULT 1
);
