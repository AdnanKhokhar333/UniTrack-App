from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity

from app.models.speeding import SpeedingLog
from app.models.trip import Trip, TripLocation, TripStatus
from app.models.user import User
from app.utils.decorators import role_required
from app.utils.extensions import db

trips_bp = Blueprint("trips", __name__, url_prefix="/api/trips")


def _driver_profile():
    user = User.query.get(int(get_jwt_identity()))
    return user.driver_profile if user else None


@trips_bp.post("/start")
@role_required("driver")
def start_trip():
    data = request.get_json(silent=True) or {}
    route_id = data.get("route_id")
    if not route_id:
        return jsonify({"error": "route_id is required"}), 400

    driver = _driver_profile()
    if not driver:
        return jsonify({"error": "Driver profile not found"}), 404
    if not driver.bus_id:
        return jsonify({"error": "No bus assigned — contact admin"}), 400

    active = Trip.query.filter_by(
        driver_id=driver.id, status=TripStatus.ACTIVE
    ).first()
    if active:
        return jsonify(
            {
                "error": "Already have an active trip",
                "trip": active.to_dict(include_latest_location=True),
            }
        ), 409

    trip = Trip(
        bus_id=driver.bus_id,
        driver_id=driver.id,
        route_id=int(route_id),
        status=TripStatus.ACTIVE,
    )
    db.session.add(trip)
    db.session.commit()
    return jsonify({"trip": trip.to_dict(include_latest_location=True)}), 201


@trips_bp.post("/<int:trip_id>/end")
@role_required("driver")
def end_trip(trip_id: int):
    driver = _driver_profile()
    trip = Trip.query.get(trip_id)
    if not trip or trip.driver_id != driver.id:
        return jsonify({"error": "Trip not found"}), 404
    if trip.status != TripStatus.ACTIVE:
        return jsonify({"error": "Trip is not active"}), 400

    trip.status = TripStatus.COMPLETED
    trip.ended_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"trip": trip.to_dict()}), 200


@trips_bp.post("/<int:trip_id>/location")
@role_required("driver")
def post_location(trip_id: int):
    data = request.get_json(silent=True) or {}
    if "latitude" not in data or "longitude" not in data:
        return jsonify({"error": "latitude and longitude are required"}), 400

    driver = _driver_profile()
    trip = Trip.query.get(trip_id)
    if not trip or trip.driver_id != driver.id:
        return jsonify({"error": "Trip not found"}), 404
    if trip.status != TripStatus.ACTIVE:
        return jsonify({"error": "Trip is not active"}), 400

    speed = float(data.get("speed_kmh") or 0)
    loc = TripLocation(
        trip_id=trip.id,
        latitude=float(data["latitude"]),
        longitude=float(data["longitude"]),
        speed_kmh=speed,
    )
    db.session.add(loc)

    threshold = float(current_app.config["SPEEDING_THRESHOLD_KMH"])
    speeding_logged = False
    if speed > threshold:
        db.session.add(
            SpeedingLog(
                trip_id=trip.id,
                driver_id=driver.id,
                latitude=loc.latitude,
                longitude=loc.longitude,
                speed_kmh=speed,
                threshold_kmh=threshold,
            )
        )
        speeding_logged = True

    db.session.commit()
    return jsonify(
        {
            "location": loc.to_dict(),
            "speeding": speeding_logged,
            "threshold_kmh": threshold,
        }
    ), 201


@trips_bp.get("/active")
@role_required("admin", "driver", "student")
def list_active_trips():
    trips = Trip.query.filter_by(status=TripStatus.ACTIVE).all()
    return jsonify(
        {"trips": [t.to_dict(include_latest_location=True) for t in trips]}
    ), 200


@trips_bp.get("/mine/active")
@role_required("driver")
def my_active_trip():
    driver = _driver_profile()
    if not driver:
        return jsonify({"error": "Driver profile not found"}), 404
    trip = Trip.query.filter_by(driver_id=driver.id, status=TripStatus.ACTIVE).first()
    return jsonify(
        {"trip": trip.to_dict(include_latest_location=True) if trip else None}
    ), 200


@trips_bp.get("/<int:trip_id>")
@role_required("admin", "driver", "student")
def get_trip(trip_id: int):
    trip = Trip.query.get(trip_id)
    if not trip:
        return jsonify({"error": "Trip not found"}), 404
    return jsonify({"trip": trip.to_dict(include_latest_location=True)}), 200
