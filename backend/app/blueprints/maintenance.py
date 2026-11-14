from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity

from app.models.bus import Bus
from app.models.maintenance import BusMaintenanceLog
from app.models.trip import Trip, TripLocation, TripStatus
from app.utils.decorators import role_required
from app.utils.extensions import db
from app.utils.geo import path_distance_km

maintenance_bp = Blueprint("maintenance", __name__, url_prefix="/api/maintenance")


def _trip_distance_km(trip: Trip) -> float:
    locs = (
        TripLocation.query.filter_by(trip_id=trip.id)
        .order_by(TripLocation.recorded_at.asc())
        .all()
    )
    points = [(loc.latitude, loc.longitude) for loc in locs]
    return path_distance_km(points)


def _bus_estimated_fuel(bus_id: int, km_per_liter: float) -> dict:
    trips = Trip.query.filter_by(bus_id=bus_id).all()
    total_km = 0.0
    completed = 0
    for t in trips:
        if t.status == TripStatus.CANCELLED:
            continue
        d = _trip_distance_km(t)
        total_km += d
        if t.status == TripStatus.COMPLETED:
            completed += 1

    estimated_liters = (total_km / km_per_liter) if km_per_liter > 0 else None
    return {
        "distance_km": round(total_km, 2),
        "estimated_liters": round(estimated_liters, 2)
        if estimated_liters is not None
        else None,
        "trip_count": len([t for t in trips if t.status != TripStatus.CANCELLED]),
        "completed_trips": completed,
        "km_per_liter": km_per_liter,
    }


@maintenance_bp.get("/buses")
@role_required("admin")
def list_bus_estimates():
    """
    Per-bus rough fuel estimate:
      estimated_liters = sum(Haversine trip path km) / FUEL_KM_PER_LITER
    Plus recent maintenance notes and admin-entered liters_added totals.
    """
    claims = get_jwt()
    km_per_liter = float(current_app.config.get("FUEL_KM_PER_LITER", 8.0))
    buses = Bus.query.filter_by(university_id=claims["university_id"]).all()

    results = []
    for bus in buses:
        fuel = _bus_estimated_fuel(bus.id, km_per_liter)
        logs = (
            BusMaintenanceLog.query.filter_by(bus_id=bus.id)
            .order_by(BusMaintenanceLog.created_at.desc())
            .limit(20)
            .all()
        )
        liters_logged = (
            db.session.query(db.func.coalesce(db.func.sum(BusMaintenanceLog.liters_added), 0.0))
            .filter(
                BusMaintenanceLog.bus_id == bus.id,
                BusMaintenanceLog.liters_added.isnot(None),
            )
            .scalar()
        )
        results.append(
            {
                "bus": bus.to_dict(),
                "fuel": fuel,
                "liters_logged": round(float(liters_logged or 0), 2),
                "recent_logs": [log.to_dict() for log in logs],
            }
        )

    return jsonify(
        {
            "buses": results,
            "formula": (
                "estimated_liters = sum(Haversine consecutive trip GPS points in km) "
                f"/ {km_per_liter} km/L (config FUEL_KM_PER_LITER). "
                "Admin may also log liters_added + notes without IoT."
            ),
        }
    ), 200


@maintenance_bp.post("/logs")
@role_required("admin")
def create_maintenance_log():
    data = request.get_json(silent=True) or {}
    bus_id = data.get("bus_id")
    note = (data.get("note") or "").strip()
    if not bus_id or not note:
        return jsonify({"error": "bus_id and note are required"}), 400

    bus = Bus.query.get(int(bus_id))
    if not bus:
        return jsonify({"error": "Bus not found"}), 404

    liters = data.get("liters_added")
    liters_added = float(liters) if liters is not None and liters != "" else None

    log = BusMaintenanceLog(
        bus_id=bus.id,
        note=note,
        liters_added=liters_added,
        created_by_user_id=int(get_jwt_identity()),
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({"log": log.to_dict()}), 201


@maintenance_bp.get("/logs")
@role_required("admin")
def list_maintenance_logs():
    bus_id = request.args.get("bus_id", type=int)
    q = BusMaintenanceLog.query
    if bus_id is not None:
        q = q.filter_by(bus_id=bus_id)
    logs = q.order_by(BusMaintenanceLog.created_at.desc()).limit(100).all()
    return jsonify({"logs": [log.to_dict() for log in logs]}), 200
