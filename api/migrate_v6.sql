-- Migration v6: add star rating to users (1-5, default 3)
ALTER TABLE users ADD rating TINYINT NOT NULL DEFAULT 3 CHECK (rating BETWEEN 1 AND 5);
