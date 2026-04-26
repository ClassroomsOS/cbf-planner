-- Migration: 20260421230411
-- Observability layer — extend error_codes with missing columns needed by exam resilience layer
-- (Original migration was applied directly to prod; this reconstructs the schema delta)

ALTER TABLE error_codes
  ADD COLUMN IF NOT EXISTS error_type text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS auto_recoverable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_admin boolean DEFAULT true;
