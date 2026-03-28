-- Migration: add player_limit to events and responded_at to rsvps
-- Run once against your Azure SQL database.

ALTER TABLE events
    ADD player_limit INT NOT NULL DEFAULT 14;

ALTER TABLE rsvps
    ADD responded_at DATETIME2 NULL;

-- Backfill responded_at for existing 'in' RSVPs so ordering is consistent
UPDATE rsvps SET responded_at = GETUTCDATE() WHERE status = 'in' AND responded_at IS NULL;
