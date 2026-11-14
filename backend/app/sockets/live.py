"""Live trip location rooms + JWT handshake.

Rooms
-----
- ``university:{university_id}`` — admin joins (JWT university_id)
- ``route:{route_id}`` — student joins only their ``active_route_id``

Events
------
- Client → server: ``join`` with ``{ room: "university" }`` or
  ``{ room: "route", route_id: N }``
- Server → client: ``trip_location`` payload after each successful
  ``POST /api/trips/:id/location``

Auth: pass the access JWT as ``auth.token`` in the Socket.IO handshake
(or ``?token=`` query). Same token as REST ``Authorization: Bearer``.
"""

from __future__ import annotations

from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import join_room

from app.models.route import Route
from app.models.user import User
from app.utils.extensions import socketio

# sid → { user_id, role, university_id }
_clients: dict[str, dict] = {}
_handlers_registered = False

EVENT_TRIP_LOCATION = "trip_location"


def room_university(university_id: int) -> str:
    return f"university:{university_id}"


def room_route(route_id: int) -> str:
    return f"route:{route_id}"


def _extract_token(auth) -> str | None:
    token = None
    if isinstance(auth, dict):
        token = auth.get("token") or auth.get("access_token")
    if not token:
        token = request.args.get("token")
    if not token:
        return None
    if isinstance(token, str) and token.lower().startswith("bearer "):
        token = token[7:].strip()
    return token or None


def _client() -> dict | None:
    return _clients.get(request.sid)


def register_socket_handlers() -> None:
    """Attach connect / join / disconnect handlers (idempotent)."""
    global _handlers_registered
    if _handlers_registered:
        return
    _handlers_registered = True

    @socketio.on("connect")
    def on_connect(auth=None):
        token = _extract_token(auth)
        if not token:
            return False
        try:
            decoded = decode_token(token)
        except Exception:
            return False

        role = decoded.get("role")
        university_id = decoded.get("university_id")
        sub = decoded.get("sub")
        if not role or university_id is None or sub is None:
            return False

        _clients[request.sid] = {
            "user_id": int(sub),
            "role": role,
            "university_id": int(university_id),
        }
        return True

    @socketio.on("disconnect")
    def on_disconnect():
        _clients.pop(request.sid, None)

    @socketio.on("join")
    def on_join(data=None):
        client = _client()
        if not client:
            return {"ok": False, "error": "not authenticated"}

        data = data or {}
        kind = (data.get("room") or "").strip().lower()

        if kind == "university":
            if client["role"] != "admin":
                return {"ok": False, "error": "admin only"}
            room = room_university(client["university_id"])
            join_room(room)
            return {"ok": True, "room": room}

        if kind == "route":
            route_id = data.get("route_id")
            if route_id is None:
                return {"ok": False, "error": "route_id required"}
            try:
                route_id = int(route_id)
            except (TypeError, ValueError):
                return {"ok": False, "error": "invalid route_id"}

            if client["role"] == "admin":
                route = Route.query.get(route_id)
                if not route or route.university_id != client["university_id"]:
                    return {"ok": False, "error": "route not found"}
            elif client["role"] == "student":
                user = User.query.get(client["user_id"])
                profile = user.student_profile if user else None
                if not profile or profile.active_route_id != route_id:
                    return {"ok": False, "error": "not your assigned route"}
            else:
                return {"ok": False, "error": "forbidden"}

            room = room_route(route_id)
            join_room(room)
            return {"ok": True, "room": room}

        return {"ok": False, "error": "unknown room (use university|route)"}


def broadcast_trip_location(
    *,
    university_id: int,
    trip_id: int,
    route_id: int,
    bus_id: int,
    latitude: float,
    longitude: float,
    speed_kmh: float | None,
    recorded_at: str | None,
) -> None:
    """Emit ``trip_location`` to university + route rooms."""
    payload = {
        "trip_id": trip_id,
        "route_id": route_id,
        "bus_id": bus_id,
        "latitude": latitude,
        "longitude": longitude,
        "speed_kmh": speed_kmh,
        "recorded_at": recorded_at,
    }
    socketio.emit(EVENT_TRIP_LOCATION, payload, room=room_route(route_id))
    socketio.emit(
        EVENT_TRIP_LOCATION, payload, room=room_university(university_id)
    )
