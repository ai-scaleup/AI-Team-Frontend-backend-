-- Additive only: registers the FREAP_CHIARA value on the existing AgentName enum.
-- Safe to re-run; no existing rows or values are modified or removed.
ALTER TYPE "AgentName" ADD VALUE IF NOT EXISTS 'FREAP_CHIARA';
