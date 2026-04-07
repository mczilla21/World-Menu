-- Add ingredients field to menu items
ALTER TABLE menu_items ADD COLUMN ingredients TEXT DEFAULT '';
