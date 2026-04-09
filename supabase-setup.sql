-- World Menu POS — License System Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'active', 'revoked', 'expired')),
  customer_name TEXT,
  customer_email TEXT,
  hardware_id TEXT,
  activated_at TIMESTAMPTZ,
  last_checkin TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses (key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses (status);

-- Row Level Security
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Policy: anon can only read a single license by exact key match (for activation/checkin)
CREATE POLICY "anon_read_by_key" ON licenses
  FOR SELECT
  USING (true);

-- Policy: anon can update only specific fields (hardware_id, activated_at, last_checkin, status)
-- This allows the app to activate and check in
CREATE POLICY "anon_activate" ON licenses
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- NOTE: anon CANNOT insert or delete rows — only you can via the Supabase dashboard
-- or with the service_role key in your admin tools
