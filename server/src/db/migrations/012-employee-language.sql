-- Add language preference per employee
-- When null/empty, uses the system default language
ALTER TABLE employees ADD COLUMN language TEXT DEFAULT '';
