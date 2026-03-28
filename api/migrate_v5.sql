-- Migration v5: allow draw (0) as a match result
-- Drop the existing check constraint (auto-named) and recreate it with 0 included.
DECLARE @con NVARCHAR(200)
SELECT @con = name FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('events') AND col_name(parent_object_id, parent_column_id) = 'winner'
IF @con IS NOT NULL EXEC('ALTER TABLE events DROP CONSTRAINT ' + @con)
ALTER TABLE events ADD CONSTRAINT chk_events_winner CHECK (winner IN (0, 1, 2));
-- 0 = Draw, 1 = Red won, 2 = Black won, NULL = no result yet
