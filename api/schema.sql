-- Run this against your Azure SQL database to set up the schema.

CREATE TABLE users (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    name       NVARCHAR(255) NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE events (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    match_date   DATE NOT NULL UNIQUE,   -- always a Wednesday
    location     NVARCHAR(255),
    notes        NVARCHAR(1000),
    cancelled    BIT NOT NULL DEFAULT 0,
    player_limit    INT NOT NULL DEFAULT 14,
    rsvp_opens_day  TINYINT NOT NULL DEFAULT 0,   -- 0=Mon … 6=Sun
    rsvp_opens_hour TINYINT NOT NULL DEFAULT 18,  -- UTC hour
    winner          TINYINT NULL CHECK (winner IN (1, 2)),  -- NULL=no result, 1=Red, 2=Black
    created_at      DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE rsvps (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id     INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    status       NVARCHAR(3) NOT NULL CHECK (status IN ('in', 'out', 'ill')),
    responded_at DATETIME2,
    UNIQUE (user_id, event_id)
);

CREATE TABLE team_assignments (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id   INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team       TINYINT NOT NULL CHECK (team IN (1, 2)),
    UNIQUE (user_id, event_id)
);
