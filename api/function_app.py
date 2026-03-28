import json
import logging
import os
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

_UK = ZoneInfo("Europe/London")

import azure.functions as func
import sqlalchemy as sa

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


def get_engine() -> sa.Engine:
    """Return a SQLAlchemy engine connected to Azure SQL."""
    conn_str = os.environ["SQL_CONNECTION_STRING"]
    return sa.create_engine(f"mssql+pyodbc:///?odbc_connect={conn_str}")


def next_wednesday(from_date: date | None = None) -> date:
    """Return this week's Wednesday, or the next one if today is past Wednesday."""
    d = from_date or date.today()
    # weekday(): Monday=0 ... Wednesday=2 ... Sunday=6
    days_until = (2 - d.weekday()) % 7
    return d + timedelta(days=days_until)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return _json({"status": "ok"})


# ---------------------------------------------------------------------------
# Users  GET /api/users  POST /api/users  DELETE /api/users/{id}
# ---------------------------------------------------------------------------

@app.route(route="users", methods=["GET"])
def list_users(req: func.HttpRequest) -> func.HttpResponse:
    try:
        with get_engine().connect() as conn:
            rows = conn.execute(
                sa.text("SELECT id, name FROM users ORDER BY name")
            ).fetchall()
        return _json([{"id": r.id, "name": r.name} for r in rows])
    except Exception:
        logging.exception("list_users failed")
        return _json({"error": "internal error"}, status=500)


@app.route(route="users", methods=["POST"])
def create_user(req: func.HttpRequest) -> func.HttpResponse:
    body = req.get_json()
    name = (body.get("name") or "").strip()
    if not name:
        return _json({"error": "name is required"}, status=400)
    try:
        with get_engine().begin() as conn:
            new_id = conn.execute(
                sa.text("INSERT INTO users (name) OUTPUT INSERTED.id VALUES (:name)"),
                {"name": name},
            ).scalar()
        return _json({"id": new_id, "name": name}, status=201)
    except Exception:
        logging.exception("create_user failed")
        return _json({"error": "internal error"}, status=500)


@app.route(route="users/{user_id}", methods=["PATCH"])
def update_user(req: func.HttpRequest) -> func.HttpResponse:
    user_id = int(req.route_params["user_id"])
    body = req.get_json()
    name = (body.get("name") or "").strip()
    if not name:
        return _json({"error": "name is required"}, status=400)
    try:
        with get_engine().begin() as conn:
            conn.execute(sa.text("UPDATE users SET name = :name WHERE id = :id"), {"name": name, "id": user_id})
        return _json({"ok": True})
    except Exception:
        logging.exception("update_user failed")
        return _json({"error": "internal error"}, status=500)


@app.route(route="users/{user_id}", methods=["DELETE"])
def delete_user(req: func.HttpRequest) -> func.HttpResponse:
    user_id = int(req.route_params["user_id"])
    try:
        with get_engine().begin() as conn:
            conn.execute(sa.text("DELETE FROM users WHERE id = :id"), {"id": user_id})
        return func.HttpResponse(status_code=204)
    except Exception:
        logging.exception("delete_user failed")
        return _json({"error": "internal error"}, status=500)


# ---------------------------------------------------------------------------
# Attendance  GET /api/users/attendance
# ---------------------------------------------------------------------------

@app.route(route="users/attendance", methods=["GET"])
def get_attendance(req: func.HttpRequest) -> func.HttpResponse:
    try:
        with get_engine().connect() as conn:
            rows = conn.execute(sa.text("""
                SELECT
                    u.id,
                    u.name,
                    SUM(CASE WHEN r.status = 'in'  THEN 1 ELSE 0 END) AS attended,
                    SUM(CASE WHEN r.status = 'out' THEN 1 ELSE 0 END) AS out_count,
                    SUM(CASE WHEN r.status = 'ill' THEN 1 ELSE 0 END) AS ill_count,
                    COUNT(r.id) AS total_events,
                    SUM(CASE
                        WHEN r.status = 'in'
                         AND e.cancelled = 0
                         AND e.match_date >= DATEADD(week, -6, CAST(GETUTCDATE() AS DATE))
                         AND e.match_date <= CAST(GETUTCDATE() AS DATE)
                        THEN 1 ELSE 0
                    END) AS attended_recent,
                    SUM(CASE
                        WHEN r.status = 'ill'
                         AND e.cancelled = 0
                         AND e.match_date >= DATEADD(week, -6, CAST(GETUTCDATE() AS DATE))
                         AND e.match_date <= CAST(GETUTCDATE() AS DATE)
                        THEN 1 ELSE 0
                    END) AS ill_recent,
                    (SELECT COUNT(*) FROM events
                     WHERE cancelled = 0
                       AND match_date >= DATEADD(week, -6, CAST(GETUTCDATE() AS DATE))
                       AND match_date <= CAST(GETUTCDATE() AS DATE)
                    ) AS recent_event_count,
                    SUM(CASE WHEN ta.team IS NOT NULL AND e.winner IS NOT NULL AND e.winner != 0 AND ta.team = e.winner THEN 1 ELSE 0 END) AS wins,
                    SUM(CASE WHEN ta.team IS NOT NULL AND e.winner IS NOT NULL AND e.winner != 0 THEN 1 ELSE 0 END) AS games_with_result
                FROM users u
                LEFT JOIN rsvps r ON r.user_id = u.id
                LEFT JOIN team_assignments ta ON ta.user_id = u.id AND ta.event_id = r.event_id
                LEFT JOIN events e ON e.id = r.event_id
                GROUP BY u.id, u.name
                ORDER BY u.name
            """)).fetchall()

        result = []
        for r in rows:
            denominator = r.recent_event_count
            rate = round((r.attended_recent + r.ill_recent) / denominator, 3) if denominator > 0 else None
            result.append({
                "id": r.id,
                "name": r.name,
                "attended": r.attended,
                "out": r.out_count,
                "ill": r.ill_count,
                "total_events": r.total_events,
                "attended_recent": r.attended_recent,
                "ill_recent": r.ill_recent,
                "recent_event_count": r.recent_event_count,
                "attendance_rate": rate,
                "win_rate": round(r.wins / r.games_with_result, 3) if r.games_with_result else None,
                "games_with_result": r.games_with_result,
            })
        return _json(result)
    except Exception:
        logging.exception("get_attendance failed")
        return _json({"error": "internal error"}, status=500)


# ---------------------------------------------------------------------------
# Events  GET /api/events/current  PATCH /api/events/{id}
# ---------------------------------------------------------------------------

@app.route(route="events/current", methods=["GET"])
def get_current_event(req: func.HttpRequest) -> func.HttpResponse:
    date_param = req.params.get("date")
    if date_param:
        try:
            wednesday = date.fromisoformat(date_param)
        except ValueError:
            return _json({"error": "invalid date"}, status=400)
    else:
        wednesday = next_wednesday()
    try:
        with get_engine().begin() as conn:
            event_row = conn.execute(
                sa.text("SELECT id, match_date, location, notes, cancelled, player_limit, rsvp_opens_day, rsvp_opens_hour, winner FROM events WHERE match_date = :d"),
                {"d": wednesday.isoformat()},
            ).fetchone()

            if event_row is None:
                defaults = conn.execute(
                    sa.text("SELECT TOP 1 player_limit, rsvp_opens_day, rsvp_opens_hour FROM events ORDER BY match_date DESC")
                ).fetchone()
                new_id = conn.execute(
                    sa.text("INSERT INTO events (match_date, player_limit, rsvp_opens_day, rsvp_opens_hour) OUTPUT INSERTED.id VALUES (:d, :pl, :rod, :roh)"),
                    {"d": wednesday.isoformat(), "pl": defaults.player_limit if defaults else 14, "rod": defaults.rsvp_opens_day if defaults else 0, "roh": defaults.rsvp_opens_hour if defaults else 18},
                ).scalar()
                event = {"id": new_id, "match_date": wednesday.isoformat(), "location": None, "notes": None, "cancelled": False, "player_limit": defaults.player_limit if defaults else 14, "rsvp_opens_day": defaults.rsvp_opens_day if defaults else 0, "rsvp_opens_hour": defaults.rsvp_opens_hour if defaults else 18, "winner": None}
            else:
                event = {
                    "id": event_row.id,
                    "match_date": event_row.match_date.isoformat() if hasattr(event_row.match_date, 'isoformat') else str(event_row.match_date),
                    "location": event_row.location,
                    "notes": event_row.notes,
                    "cancelled": bool(event_row.cancelled),
                    "player_limit": event_row.player_limit,
                    "rsvp_opens_day": event_row.rsvp_opens_day,
                    "rsvp_opens_hour": event_row.rsvp_opens_hour,
                    "winner": event_row.winner,
                }

            # Compute whether the RSVP window is open (hour stored as UK local time)
            match_date = date.fromisoformat(event["match_date"])
            # Wednesday = weekday 2; days_before = (2 - rsvp_opens_day) % 7
            days_before = (2 - event["rsvp_opens_day"]) % 7
            opens_date = match_date - timedelta(days=days_before)
            opens_at = datetime(
                opens_date.year, opens_date.month, opens_date.day,
                event["rsvp_opens_hour"], 0, 0, tzinfo=_UK
            )
            event["rsvp_open"] = datetime.now(_UK) >= opens_at

            event_id = event["id"]

            rsvp_rows = conn.execute(
                sa.text("SELECT user_id, status FROM rsvps WHERE event_id = :eid ORDER BY responded_at ASC, id ASC"),
                {"eid": event_id},
            ).fetchall()
            event["rsvps"] = {r.user_id: r.status for r in rsvp_rows}
            event["in_order"] = [r.user_id for r in rsvp_rows if r.status == "in"]

            team_rows = conn.execute(
                sa.text("SELECT user_id, team FROM team_assignments WHERE event_id = :eid"),
                {"eid": event_id},
            ).fetchall()
            event["teams"] = {r.user_id: r.team for r in team_rows}

        return _json(event)
    except Exception:
        logging.exception("get_current_event failed")
        return _json({"error": "internal error"}, status=500)


@app.route(route="events/{event_id}", methods=["PATCH"])
def update_event(req: func.HttpRequest) -> func.HttpResponse:
    event_id = int(req.route_params["event_id"])
    body = req.get_json()
    fields = {}
    if "cancelled" in body:
        fields["cancelled"] = 1 if body["cancelled"] else 0
    if "location" in body:
        fields["location"] = body["location"]
    if "notes" in body:
        fields["notes"] = body["notes"]
    if "player_limit" in body:
        val = body["player_limit"]
        if isinstance(val, int) and val > 0:
            fields["player_limit"] = val
    if "rsvp_opens_day" in body:
        val = body["rsvp_opens_day"]
        if isinstance(val, int) and 0 <= val <= 6:
            fields["rsvp_opens_day"] = val
    if "rsvp_opens_hour" in body:
        val = body["rsvp_opens_hour"]
        if isinstance(val, int) and 0 <= val <= 23:
            fields["rsvp_opens_hour"] = val
    if "winner" in body:
        val = body["winner"]
        if val is None or (isinstance(val, int) and val in (0, 1, 2)):
            fields["winner"] = val
    if not fields:
        return _json({"error": "no updatable fields"}, status=400)

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["event_id"] = event_id
    try:
        with get_engine().begin() as conn:
            conn.execute(
                sa.text(f"UPDATE events SET {set_clause} WHERE id = :event_id"),
                fields,
            )
        return _json({"ok": True})
    except Exception:
        logging.exception("update_event failed")
        return _json({"error": "internal error"}, status=500)


# ---------------------------------------------------------------------------
# RSVPs  POST /api/events/{id}/rsvp
# ---------------------------------------------------------------------------

@app.route(route="events/{event_id}/rsvp", methods=["POST"])
def upsert_rsvp(req: func.HttpRequest) -> func.HttpResponse:
    event_id = int(req.route_params["event_id"])
    body = req.get_json()
    user_id = body.get("user_id")
    status = body.get("status")
    if not user_id or status not in ("in", "out", "ill"):
        return _json({"error": "user_id and status ('in','out','ill') are required"}, status=400)
    try:
        with get_engine().begin() as conn:
            conn.execute(sa.text("""
                MERGE rsvps AS target
                USING (SELECT :user_id AS user_id, :event_id AS event_id) AS source
                ON target.user_id = source.user_id AND target.event_id = source.event_id
                WHEN MATCHED THEN UPDATE SET status = :status, responded_at = CASE WHEN :status = 'in' THEN GETUTCDATE() ELSE target.responded_at END
                WHEN NOT MATCHED THEN INSERT (user_id, event_id, status, responded_at) VALUES (:user_id, :event_id, :status, CASE WHEN :status = 'in' THEN GETUTCDATE() ELSE NULL END);
            """), {"user_id": user_id, "event_id": event_id, "status": status})
        return _json({"ok": True})
    except Exception:
        logging.exception("upsert_rsvp failed")
        return _json({"error": "internal error"}, status=500)


# ---------------------------------------------------------------------------
# Teams  GET /api/events/{id}/teams  POST /api/events/{id}/teams
# ---------------------------------------------------------------------------

@app.route(route="events/{event_id}/teams", methods=["GET"])
def get_teams(req: func.HttpRequest) -> func.HttpResponse:
    event_id = int(req.route_params["event_id"])
    try:
        with get_engine().connect() as conn:
            rows = conn.execute(
                sa.text("SELECT user_id, team FROM team_assignments WHERE event_id = :eid"),
                {"eid": event_id},
            ).fetchall()
        return _json({r.user_id: r.team for r in rows})
    except Exception:
        logging.exception("get_teams failed")
        return _json({"error": "internal error"}, status=500)


@app.route(route="events/{event_id}/teams", methods=["POST"])
def save_teams(req: func.HttpRequest) -> func.HttpResponse:
    event_id = int(req.route_params["event_id"])
    body = req.get_json()
    assignments = body.get("assignments", [])
    try:
        with get_engine().begin() as conn:
            conn.execute(
                sa.text("DELETE FROM team_assignments WHERE event_id = :eid"),
                {"eid": event_id},
            )
            for a in assignments:
                conn.execute(
                    sa.text("INSERT INTO team_assignments (user_id, event_id, team) VALUES (:uid, :eid, :team)"),
                    {"uid": a["user_id"], "eid": event_id, "team": a["team"]},
                )
        return _json({"ok": True})
    except Exception:
        logging.exception("save_teams failed")
        return _json({"error": "internal error"}, status=500)


# ---------------------------------------------------------------------------
# Admin  POST /api/admin/login
# ---------------------------------------------------------------------------

@app.route(route="auth/login", methods=["POST"])
def admin_login(req: func.HttpRequest) -> func.HttpResponse:
    body = req.get_json()
    password = (body.get("password") or "").strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if not admin_password:
        return _json({"error": "Admin not configured"}, status=500)
    if password == admin_password:
        return _json({"ok": True})
    return _json({"ok": False}, status=401)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _json(data: object, status: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(data),
        status_code=status,
        mimetype="application/json",
    )
