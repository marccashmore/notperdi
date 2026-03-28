-- Migration v4: add match result to events
-- winner: NULL = no result, 1 = Red won, 2 = Black won
ALTER TABLE events ADD winner TINYINT NULL CHECK (winner IN (1, 2));
