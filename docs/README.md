# UniTrack — Architecture & Phase Plan

Single-university Transport & Travel Tracking System (FYP). Schema and APIs are **SaaS-ready** via a `University` tenant root; Phase 1 runs **one** seeded university only.

## Stack

| Layer | Tech |
|--------|------|
| Mobile | React Native + Expo + TypeScript, React Navigation, Axios, AsyncStorage, expo-location, react-native-maps, expo-notifications, expo-av, react-native-qrcode-svg |
| Admin | `/admin-web` — React + Vite + TypeScript; Leaflet/OSM live fleet map |
| API | Python Flask REST, JWT, Flask-SocketIO live broadcast (`async_mode=threading`) |
| DB | SQLAlchemy — SQLite (dev default); PostgreSQL via `DATABASE_URL` + `requirements-prod.txt` |

Live location: drivers still **POST** GPS over REST; the server **broadcasts** `trip_location` over Socket.IO. Admin Live Map and Student map subscribe while focused; **HTTP polling remains the fallback** if the socket disconnects.

## Roles

1. **System Admin** — `/admin-web` only (no AdminNavigator in mobile)
2. **Bus Driver** — mobile Driver Mode
3. **Student/Passenger** — mobile Student Mode (parents share student login)

## Locked product rules

- One student → one `active_route_id` (admin reassignment only)
- Daily attendance mandatory (`taking` / `absent`)
- No public self-registration — admin creates/approves users
- Speeding threshold: **70 km/h** (warning + `SpeedingLog`)

## Repo layout

```
/backend      Flask API, models, JWT auth, core REST
/admin-web    Admin dashboard (fleet, live map, students, ratings, SOS, fuel…)
/mobile       Expo app — DriverNavigator + StudentNavigator (pass + feedback)
/docs         This document
```

## Phase 1 — Backend APIs

- [x] Directory structure + `.env.example`
- [x] SQLAlchemy models (User, Bus, Driver/Student profiles, Route/Stop, Trip/Location, Attendance, Complaint, Rating, SpeedingLog, University)
- [x] JWT auth: login only; admin create/approve student & create driver
- [x] REST: buses CRUD, routes/stops CRUD, attendance submit, trip start/end + location
- [x] Mobile navigators shell (role-based; no AdminNavigator)
- [x] Admin-web shell + login stub

## Phase 2 — Admin Web UI (done)

- [x] Reactive auth (AuthContext) — no localStorage redirect loop
- [x] Layout shell: sidebar nav (Dashboard, Buses, Drivers, Routes, Students)
- [x] Buses: list + create/edit (`bus_number`, `registration`, `capacity`, `is_active`)
- [x] Drivers: list + create (`email`, `password`, `full_name`, phone, license, `bus_id`)
- [x] Routes: list + create/update with ordered stops (`name`, lat/lng, `sequence_order`)
- [x] Students: list (approved/pending), create, approve, assign/reassign route + stop
- [x] Dashboard: counts from list APIs (no live map)

## Phase 3 — Mobile core (done)

- [x] Persist `driver_profile` / `student_profile` after login + `/api/auth/me`
- [x] API helpers under `mobile/src/api/*` + shared types
- [x] Driver: route picker, Start/End Trip, restore `GET /api/trips/mine/active`
- [x] Driver: foreground GPS every ~7s → `POST /api/trips/:id/location`; speeding banner (>70 or `speeding:true`)
- [x] Driver: stop-wise attendance from `GET /api/attendance/route/:route_id`
- [x] Student: assigned route + ordered stops; mandatory Will Take Bus / Absent
- [x] Student: live bus map when an active trip exists for their route (poll ~8s)
- [x] `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` documented for LAN / Maps tiles

## Phase 4 — Alerts, safety, maps polish (done)

- [x] Student map always shown when `active_route_id` is set (stops + “Waiting for driver…”); bus marker + ~8s poll when trip active; optional Haversine ETA text
- [x] Driver MapView during active trip (stops + live GPS); route-stop preview when idle
- [x] Backend: `MissedBusAlert`, `SosAlert`, `DeviceToken` + `/api/alerts/*` + `POST /api/users/me/push-token`
- [x] Student: Missed Bus button; proximity local notification (~1 km / ~5 min ETA, once per trip)
- [x] Driver: poll missed-bus alerts + loud sound/modal + acknowledge; SOS with confirm; red speeding banner on map
- [x] Driver: best-effort background location (foreground service) + AsyncStorage offline location queue
- [x] Admin: SOS alerts page (list open/recent, mark resolved); optional `GET /api/alerts/speeding`

### Phase 4 limitations (Expo)

- **Background GPS:** Works best with a dev/production build that grants *Always* / background location. On **Expo Go**, tracking while minimized may work on Android via foreground service patterns, but **fully killed-state** location is unreliable / unsupported. Foreground + offline queue remain the reliable path.
- **Proximity alerts:** Local notifications fire while the student screen is focused (and after push-token registration). True OS geofencing / background approach while the app is killed is constrained on Expo Go — remote push from the server is a Phase 5+ upgrade if tokens are stored.
- **Missed-bus sound:** Plays a remote alert tone via `expo-av` (needs network once); modal still shows if audio fails.

## Phase 5 — Pass, feedback, admin ops (done)

- [x] Digital QR bus pass: `GET /api/students/me/pass` (HMAC token + today `valid_date`); student **Bus Pass** screen (`react-native-qrcode-svg`)
- [x] Pass revoke: admin **Revoke pass** → `POST /api/users/students/:user_id/revoke` sets `is_approved=false` (pass endpoint then returns 403)
- [x] Ratings: `POST /api/ratings` (student), `GET /api/ratings` (admin list + averages); student Feedback screen
- [x] Complaints: `POST /api/complaints`, `GET /api/complaints`, `PATCH …/resolve`; admin Complaints page
- [x] Admin **Live Map**: Leaflet + OSM; Socket.IO `trip_location` + poll fallback on `GET /api/trips/active` ~6s (optional `VITE_GOOGLE_MAPS_API_KEY` documented if switching later)
- [x] Admin **Speeding** page (`GET /api/alerts/speeding`); Dashboard attendance summary (`GET /api/attendance/summary`)
- [x] CSV bulk student upload: `POST /api/users/students/bulk` (multipart CSV or JSON)
- [x] Fuel / maintenance: `BusMaintenanceLog` + `GET /api/maintenance/buses` estimates; admin Fuel/Maint. page

### Fuel estimate formula (FYP / pragmatic)

```
distance_km     = sum of Haversine segments between consecutive TripLocation points (per bus trips)
estimated_liters = distance_km / FUEL_KM_PER_LITER   # default 8.0 from .env
```

Admins may also enter `liters_added` + free-text notes (no IoT sensors).

### Phase 5 stretch (done)

- [x] **SocketIO live broadcast** on successful `POST /api/trips/:id/location` → event `trip_location` to rooms `route:{id}` + `university:{id}`; JWT handshake + `join`; admin-web + student map listen; poll fallback when socket down
- [x] **PostgreSQL production path:** `DATABASE_URL` (incl. `postgres://` normalize), `requirements-prod.txt` (`psycopg2-binary`), optional `backend/docker-compose.postgres.yml`, docs in `backend/README.md`. SQLite remains default local/dev; no forced data migration

#### Socket.IO contract

| Item | Value |
|------|--------|
| Auth | Handshake `auth: { token: "<JWT>" }` (same access token as REST). Rejected if missing/invalid. |
| Join (admin) | Client emits `join` → `{ room: "university" }` → room `university:{university_id}` from JWT |
| Join (student) | Client emits `join` → `{ room: "route", route_id: N }` — only if `N` is their `active_route_id` |
| Event | `trip_location` |
| Payload | `{ trip_id, route_id, bus_id, latitude, longitude, speed_kmh, recorded_at }` |
| Driver | No socket listen — REST POST only; server broadcasts |
| Async mode | `threading` (Windows-friendly; do not switch to eventlet/gevent unless tested) |

Dev proxy: admin-web Vite proxies `/socket.io` → Flask when `VITE_API_URL` is empty.

#### PostgreSQL enable (summary)

```bash
cd backend
docker compose -f docker-compose.postgres.yml up -d   # optional
# .env: DATABASE_URL=postgresql://unitrack:unitrack@localhost:5432/unitrack
pip install -r requirements-prod.txt
python run.py   # create_all + seed on first boot
```

Full notes: `backend/README.md`.

## Run (dev)

```bash
# Backend
cd backend
cp .env.example .env   # Windows: copy .env.example .env
# activate venv, then:
pip install -r requirements.txt
python run.py          # http://localhost:5000

# Admin web
cd admin-web && npm install && npm run dev

# Mobile
cd mobile
cp .env.example .env   # set EXPO_PUBLIC_API_URL + EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
npm install && npx expo start -c
```

### Google Maps setup (native Android / iOS)

Maps use `react-native-maps` via `SafeMapView` (`loadingEnabled={false}`, `onMapReady` + `animateToRegion` / `fitToCoordinates`). **Expo Go** omits the `provider` prop (never `PROVIDER_GOOGLE` there). Custom/dev/standalone builds with a real key use `PROVIDER_GOOGLE`. Expo **web** keeps a safe stub.

**Expo Go grey/beige map (Google logo, no road tiles):** common limitation — Expo Go does not use your `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. Markers/region can still work; for reliable Google road tiles use a native build:
```bash
cd mobile
# set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env first
npx expo run:android
```

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or reuse) an API key and enable **Maps SDK for Android** and **Maps SDK for iOS**.
2. Restrict the key (recommended): Android package `edu.unitrack.app`; iOS bundle `edu.unitrack.app`.
3. Put the key only in `mobile/.env` (never commit it):
   ```
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_real_key_here
   ```
4. Restart Metro with a clean cache so `app.config.js` re-reads the env (`npx expo start -c`), or rebuild with `npx expo run:android`.
5. Test Student/Driver maps on device/emulator (not web).

Wiring (already in `mobile/app.config.js`): `ios.config.googleMapsApiKey`, `android.config.googleMaps.apiKey`, and `extra.googleMapsApiKey` all read `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

**API URL tips**

| Client | `EXPO_PUBLIC_API_URL` |
|--------|------------------------|
| iOS simulator / most local | `http://localhost:5000` |
| Android emulator | `http://10.0.2.2:5000` (or localhost via Expo) |
| Physical phone | `http://<your-PC-LAN-IP>:5000` (same Wi‑Fi; allow firewall on port 5000) |

Default seed admin: see `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.example`.

## End-to-end test (Phase 4 — still valid)

1. Start backend + admin-web. Log in as admin.
2. Ensure **Bus**, **Driver** (with bus), **Route** (2+ stops with real lat/lng), and **Student** (approved, assigned route + stop) exist.
3. **Student mobile:** sign in → mark **Will Take Bus** → confirm **Route map** shows ordered stops (your stop highlighted) and “Waiting for driver to start trip” (no bus marker yet).
4. **Driver mobile:** pick route → **Start Trip** → allow location (foreground + background if prompted) → confirm **MapView** with stops + your GPS marker; minimize briefly and confirm posts continue when platform allows.
5. **Student:** map updates with **bus marker** + optional distance/ETA; when bus is within ~1 km (or ~5 min ETA) of your stop, a **local notification** fires once.
6. **Student:** tap **Missed Bus** → success message.
7. **Driver:** high-priority missed-student modal + sound → **Acknowledge**.
8. **Driver:** tap **SOS — EMERGENCY** → confirm → success.
9. **Admin web → SOS:** open alert appears with driver + coords → **Resolve**.
10. **Driver:** exceed 70 km/h (or mock high `speed_kmh`) → red speeding banner on map; **End Trip**.

Parents use the same student credentials (Student Mode).

## End-to-end test (Phase 5)

1. **Bus Pass:** Student → **Bus Pass** → QR + name + student number + today’s date. Admin → Students → **Revoke pass** → student refresh fails with revoked/403; **Approve** again to restore.
2. **Rating:** After (or during) a trip on the student’s route → **Rate / Complaint** → pick stars → submit → Admin **Ratings** shows row + driver average.
3. **Complaint:** Student sends subject/body → Admin **Complaints** → **Resolve**.
4. **Live Map:** With an active driver trip posting GPS → Admin **Live Map** shows a marker that moves via Socket.IO (`live (socket)` in the status line) or ~6s poll fallback.
5. **Speeding:** Trigger speed &gt; threshold → Admin **Speeding** table shows the log.
6. **Dashboard:** Confirm taking/absent/marked counts for today.
7. **CSV:** Upload a CSV with header `email,password,full_name,student_number` (+ optional phone/route/stop) → success/error counts; duplicate email/number reported.
8. **Fuel / Maint.:** Drive a trip with several location points → Admin **Fuel / Maint.** shows non-zero distance_km / estimated liters; add a note + optional liters.

## Stretch smoke tests

### A) Socket.IO live broadcast

1. Start backend with `python run.py` (must use `socketio.run`, not bare Flask).
2. Admin-web → **Live Map** — status should show **live (socket)** after connect (JWT join to `university:{id}`).
3. Student mobile → Home (map focused, assigned route) — app joins `route:{id}`.
4. Driver → Start Trip → allow GPS → posts to `/api/trips/:id/location`.
5. Confirm admin marker and student bus pin move **sooner than the poll interval** (sub-second to a few seconds after each POST).
6. Kill/block the socket (stop backend briefly, or DevTools offline) → status falls back to **polling** / markers still update on the HTTP interval.
7. Optional: browser console / React Native debugger — listen for event name `trip_location`.

### B) PostgreSQL (if Docker/Postgres available)

1. `cd backend && docker compose -f docker-compose.postgres.yml up -d`
2. Set `DATABASE_URL=postgresql://unitrack:unitrack@localhost:5432/unitrack` in `.env`
3. `pip install -r requirements-prod.txt` then `python run.py`
4. `GET /api/health` OK; log in as seeded admin; create a bus (proves enums/constraints on Postgres).
5. Revert to `sqlite:///unitrack.db` anytime for local demos — no data is auto-migrated between engines.

If Postgres is not installed on the machine, the enable summary under Phase 5 stretch plus config review is enough; do not block demos on SQLite.

## Core API

| Method | Path | Who |
|--------|------|-----|
| POST | `/api/auth/login` | all |
| GET | `/api/auth/me` | JWT |
| POST | `/api/users/students` | admin |
| POST | `/api/users/students/bulk` | admin |
| POST | `/api/users/students/:id/approve` | admin |
| POST | `/api/users/students/:id/revoke` | admin |
| PATCH | `/api/users/students/:id/route` | admin |
| GET | `/api/users/students` | admin |
| POST | `/api/users/drivers` | admin |
| GET | `/api/users/drivers` | admin |
| POST | `/api/users/me/push-token` | JWT |
| GET | `/api/students/me/pass` | student |
| CRUD | `/api/buses` | admin |
| CRUD | `/api/routes` (+ stops) | admin |
| POST | `/api/attendance` | student |
| GET | `/api/attendance/today` | student |
| GET | `/api/attendance/summary` | admin |
| GET | `/api/attendance/route/:id` | admin/driver |
| POST | `/api/trips/start` | driver |
| POST | `/api/trips/:id/end` | driver |
| POST | `/api/trips/:id/location` | driver |
| GET | `/api/trips/mine/active` | driver |
| GET | `/api/trips/active` | admin/driver/student |
| POST | `/api/alerts/missed-bus` | student |
| GET | `/api/alerts/missed-bus/active` | driver |
| PATCH | `/api/alerts/missed-bus/:id/acknowledge` | driver |
| POST | `/api/alerts/sos` | driver |
| GET | `/api/alerts/sos` | admin |
| PATCH | `/api/alerts/sos/:id/resolve` | admin |
| GET | `/api/alerts/speeding` | admin |
| POST | `/api/ratings` | student |
| GET | `/api/ratings` | admin |
| POST | `/api/complaints` | student |
| GET | `/api/complaints` | admin |
| PATCH | `/api/complaints/:id/resolve` | admin |
| GET | `/api/maintenance/buses` | admin |
| GET/POST | `/api/maintenance/logs` | admin |
