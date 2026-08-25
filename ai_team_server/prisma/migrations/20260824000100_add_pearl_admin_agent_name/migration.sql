-- Additive only: registers the PEARL_ADMIN value on the existing AgentName enum.
-- Existing assignments and agent values are not changed.
ALTER TYPE "AgentName" ADD VALUE IF NOT EXISTS 'PEARL_ADMIN';
