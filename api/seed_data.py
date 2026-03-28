"""
Seed script: generates ~10 weeks of historic match data via the API.
Usage:  python seed_data.py [base_url]
Default base_url: http://localhost:7071
"""
import random
import sys
from datetime import date, timedelta

import requests

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:7071"

SAMPLE_NAMES = [
    "Marc", "Jake", "Tom", "Sam", "Dan", "Liam", "Chris", "Ben",
    "Harry", "Jack", "Will", "Ollie", "Ash", "Ryan", "Kieran", "Callum",
    "Matt", "Josh", "Luke", "Alex",
]

# ── helpers ──────────────────────────────────────────────────────────────────

def api(method, path, **kwargs):
    r = requests.request(method, f"{BASE}/api{path}", **kwargs)
    r.raise_for_status()
    return r.json() if r.content else None

def past_wednesdays(n: int) -> list[date]:
    today = date.today()
    # most recent Wednesday (not today if today is Wednesday)
    days_back = (today.weekday() - 2) % 7 or 7
    latest = today - timedelta(days=days_back)
    return [latest - timedelta(weeks=i) for i in range(n)]

# ── ensure players exist ──────────────────────────────────────────────────────

users = api("GET", "/users")
if not users:
    print("No players found — creating sample squad...")
    for name in SAMPLE_NAMES:
        api("POST", "/users", json={"name": name})
    users = api("GET", "/users")

print(f"Using {len(users)} players: {[u['name'] for u in users]}")

# ── seed matches ──────────────────────────────────────────────────────────────

random.seed(42)
wednesdays = past_wednesdays(10)

for match_date in wednesdays:
    date_str = match_date.isoformat()
    event = api("GET", f"/events/current?date={date_str}")
    event_id = event["id"]

    # Skip if already has RSVPs (don't overwrite real data)
    if event.get("rsvps"):
        print(f"  {date_str} — skipping (already has data)")
        continue

    # Randomly pick who's in/out/ill
    shuffled = random.sample(users, len(users))
    n_in   = random.randint(max(6, len(users) // 2), min(14, len(users)))
    n_ill  = random.randint(0, 2)
    n_out  = len(users) - n_in - n_ill

    playing = shuffled[:n_in]
    ill     = shuffled[n_in:n_in + n_ill]
    out     = shuffled[n_in + n_ill:]

    for u in playing:
        api("POST", f"/events/{event_id}/rsvp", json={"user_id": u["id"], "status": "in"})
    for u in ill:
        api("POST", f"/events/{event_id}/rsvp", json={"user_id": u["id"], "status": "ill"})
    for u in out:
        api("POST", f"/events/{event_id}/rsvp", json={"user_id": u["id"], "status": "out"})

    # Assign teams (balanced split)
    random.shuffle(playing)
    half = len(playing) // 2
    assignments = (
        [{"user_id": u["id"], "team": 1} for u in playing[:half + len(playing) % 2]] +
        [{"user_id": u["id"], "team": 2} for u in playing[half + len(playing) % 2:]]
    )
    api("POST", f"/events/{event_id}/teams", json={"assignments": assignments})

    # Random winner
    winner = random.choice([1, 2])
    api("PATCH", f"/events/{event_id}", json={"winner": winner})

    winner_name = "🔴 Red" if winner == 1 else "⚫ Black"
    print(f"  {date_str} — {len(playing)} playing, {len(ill)} ill, {len(out)} out — {winner_name} won")

print("\nDone.")
