# UniTrack — Architecture & Phase Plan

Single-university Transport & Travel Tracking System (FYP). Schema and APIs are **SaaS-ready** via a `University` tenant root; Phase 1 runs **one** seeded university only.

## Stack

| Layer | Tech |
|--------|------|
| Mobile | React Native + Expo + TypeScript, React Navigation, Axios, AsyncStorage, expo-location, react-native-maps, expo-notifications, expo-av |
| Admin | `/admin-web` — React + Vite + TypeScript (web only) |
| API | Python Flask REST, JWT, Flask-SocketIO (live location later) |
| DB | SQLAlchemy — SQLite (dev); PostgreSQL via `DATABASE_URL` + `requirements-prod.txt` |

SocketIO uses `async_mode=threading` (compatible with current Windows/Python; live events come later).

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
/admin-web    Admin dashboard (fleet, drivers, routes, students, SOS)
/mobile       Expo app — DriverNavigator + StudentNavigator
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

## Phase 5 — next (not built yet)

- QR digital pass
- Driver ratings / complaints UI
- Full admin live multi-bus fleet map polish
- Fuel / maintenance estimates
- CSV bulk student upload
- SocketIO live broadcast (Phase 3–4 use polling + local notifications)
- PostgreSQL production deploy

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

## End-to-end test (Phase 4)

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

## Core API

| Method | Path | Who |
|--------|------|-----|
| POST | `/api/auth/login` | all |
| GET | `/api/auth/me` | JWT |
| POST | `/api/users/students` | admin |
| POST | `/api/users/students/:id/approve` | admin |
| PATCH | `/api/users/students/:id/route` | admin |
| GET | `/api/users/students` | admin |
| POST | `/api/users/drivers` | admin |
| GET | `/api/users/drivers` | admin |
| POST | `/api/users/me/push-token` | JWT |
| CRUD | `/api/buses` | admin |
| CRUD | `/api/routes` (+ stops) | admin |
| POST | `/api/attendance` | student |
| GET | `/api/attendance/today` | student |
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
