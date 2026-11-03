# UniTrack Backend

Flask REST API with JWT auth and SQLAlchemy models.

## Setup

```bash
copy .env.example .env
.\venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

API: `http://localhost:5000` — health: `GET /api/health`

Default admin is seeded from `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

For PostgreSQL production, set `DATABASE_URL` and install `requirements-prod.txt`.

## Structure

```
app/
  models/       SQLAlchemy entities
  blueprints/   REST route modules
  services/     auth + seed helpers
  utils/        db, jwt, socketio, decorators
```
