-- Per-item modifier group assignments
-- If an item has entries here, use them. If not, fall back to category-level.
CREATE TABLE IF NOT EXISTS item_modifier_groups (
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_group_id INTEGER NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (menu_item_id, modifier_group_id)
);
