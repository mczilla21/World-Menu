-- Order approval flow: customer orders need server approval before going to kitchen
ALTER TABLE orders ADD COLUMN needs_approval INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN approved_by INTEGER DEFAULT NULL;
ALTER TABLE orders ADD COLUMN approved_at TEXT DEFAULT NULL;
