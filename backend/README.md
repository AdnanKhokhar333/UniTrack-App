# UniTrack Backend

Flask REST API with JWT auth, SQLAlchemy models, and Flask-SocketIO live location broadcast (`async_mode=threading`, Windows-friendly).

## Setup (SQLite — default local/dev)

```bash
copy .env.example .env
.\venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

API: `http://localhost:5000` — health: `GET /api/health`

Default admin is seeded from `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## PostgreSQL (production path)

SQLite stays the default for local/FYP demos. Nothing forces you to migrate existing SQLite data.

1. **Create a database** (pick one):
   - Docker (optional helper in this folder):
     ```bash
     docker compose -f docker-compose.postgres.yml up -d
     ```
     Connection string: `postgresql://unitrack:unitrack@localhost:5432/unitrack`
   - Or create a DB manually in Postgres (`CREATE DATABASE unitrack;`) and use your own user/password.

2. **Install the Postgres driver** (on top of base requirements):
   ```bash
   pip install -r requirements-prod.txt
   ```

3. **Point `.env` at Postgres** (comment out / replace the SQLite URL):
   ```
   DATABASE_URL=postgresql://unitrack:unitrack@localhost:5432/unitrack
   ```
   `postgres://…` is also accepted and normalized to `postgresql://…`.

4. **First run** — start the API as usual:
   ```bash
   python run.py
   ```
   On boot, SQLAlchemy `db.create_all()` creates tables and `seed_defaults()` inserts the demo university + admin if missing. There is **no Alembic migrate step** required for FYP/Phase stretch; for a long-lived production deploy you may later add migrations, but `create_all` is enough for a clean Postgres database.

5. **Smoke check**
   ```bash
   curl http://localhost:5000/api/health
   ```
   Log in via admin-web or mobile with the seeded admin. Enums (`UserRole`, `TripStatus`, etc.) use string values and work on both SQLite and Postgres.

**Note:** Switching `DATABASE_URL` starts a **new empty schema** — it does not copy rows from `unitrack.db`. Keep SQLite for demos, or re-seed / re-create users on Postgres.

## Socket.IO live location

- Driver still posts GPS via `POST /api/trips/:id/location` (no driver socket listen).
- After a successful save, the server emits **`trip_location`** to:
  - room `route:{route_id}` (students on that route)
  - room `university:{university_id}` (admins for that university)
- Clients authenticate with the same JWT: handshake `auth: { token }` (or `?token=`).
- Client emits **`join`**: `{ room: "university" }` (admin) or `{ room: "route", route_id }` (student; must match assigned route).
- Payload: `trip_id`, `route_id`, `bus_id`, `latitude`, `longitude`, `speed_kmh`, `recorded_at`.
- Admin Live Map and Student map subscribe while open; HTTP polling remains the fallback if the socket disconnects.

See `docs/README.md` for test steps.

## Structure

```
app/
  models/       SQLAlchemy entities
  blueprints/   REST route modules
  services/     auth + seed helpers
  sockets/      SocketIO join + trip_location broadcast
  utils/        db, jwt, socketio, decorators
```
