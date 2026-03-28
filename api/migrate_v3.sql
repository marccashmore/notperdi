-- Migration v3: add RSVP opening window to events
-- rsvp_opens_day: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
-- rsvp_opens_hour: 0–23 (UTC)
ALTER TABLE events ADD rsvp_opens_day  TINYINT NOT NULL DEFAULT 0;
ALTER TABLE events ADD rsvp_opens_hour TINYINT NOT NULL DEFAULT 18;
