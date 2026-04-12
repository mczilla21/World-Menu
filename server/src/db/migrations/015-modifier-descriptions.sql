-- Add description column to modifiers for customer-facing help text
ALTER TABLE modifiers ADD COLUMN description TEXT DEFAULT "";
