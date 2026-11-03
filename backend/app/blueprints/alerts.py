from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import or_

from app.models.alert import MissedBusAlert, SosAlert, SosStatus
from app.models.speeding import SpeedingLog
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.utils.decorators import role_required
from app.utils.extensions import db

alerts_bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")


def _current_user() -> User | None:
    return User.query.get(int(get_jwt_identity()))


def _driver_profile():
    user = _current_user()
    return user.driver_profile if user else None


def _student_profile():
    user = _current_user()
    return user.student_profile if user else None


# ---- Missed Bus (student → driver) ----


@alerts_bp.post("/missed-bus")
@role_required("student")
def create_missed_bus():
    student = _student_profile()
    if not student:
        return jsonify({"error": "Student profile not found"}), 404
    if not student.active_route_id:
        return jsonify({"error": "No active route assigned"}), 400

    data = request.get_json(silent=True) or {}
    route_id = student.active_route_id

    active_trip = Trip.query.filter_by(
        route_id=route_id, status=TripStatus.ACTIVE
    ).first()

    alert = MissedBusAlert(
        student_id=student.id,
        trip_id=active_trip.id if active_trip else None,
        route_id=route_id,
        stop_id=student.stop_id,
        message=(data.get("message") or "Missed the bus").strip()[:500] or None,
        acknowledged=False,
    )
    db.session.add(alert)
    db.session.commit()
    return jsonify({"alert": alert.to_dict()}), 201


@alerts_bp.get("/missed-bus/active")
@role_required("driver")
def list_active_missed_bus():
    """Unacknowledged missed-bus alerts for the driver's active trip/route."""
    driver = _driver_profile()
    if not driver:
        return jsonify({"error": "Driver profile not found"}), 404

    trip = Trip.query.filter_by(driver_id=driver.id, status=TripStatus.ACTIVE).first()
    if not trip:
        return jsonify({"alerts": []}), 200

    alerts = (
        MissedBusAlert.query.filter(
            MissedBusAlert.acknowledged.is_(False),
            or_(
                MissedBusAlert.trip_id == trip.id,
                MissedBusAlert.route_id == trip.route_id,
            ),
        )
        .order_by(MissedBusAlert.created_at.desc())
        .all()
    )
    return jsonify({"alerts": [a.to_dict() for a in alerts]}), 200


@alerts_bp.patch("/missed-bus/<int:alert_id>/acknowledge")
@role_required("driver")
def acknowledge_missed_bus(alert_id: int):
    driver = _driver_profile()
    if not driver:
        return jsonify({"error": "Driver profile not found"}), 404

    alert = MissedBusAlert.query.get(alert_id)
    if not alert:
        return jsonify({"error": "Alert not found"}), 404

    trip = Trip.query.filter_by(driver_id=driver.id, status=TripStatus.ACTIVE).first()
    if not trip or (
        alert.trip_id != trip.id and alert.route_id != trip.route_id
    ):
        return jsonify({"error": "Alert not for your active trip"}), 403

    alert.acknowledged = True
    db.session.commit()
    return jsonify({"alert": alert.to_dict()}), 200


# ---- SOS (driver → admin) ----


@alerts_bp.post("/sos")
@role_required("driver")
def create_sos():
    driver = _driver_profile()
    if not driver:
        return jsonify({"error": "Driver profile not found"}), 404

    data = request.get_json(silent=True) or {}
    trip = Trip.query.filter_by(driver_id=driver.id, status=TripStatus.ACTIVE).first()

    lat = data.get("latitude")
    lng = data.get("longitude")
    latitude = float(lat) if lat is not None else None
    longitude = float(lng) if lng is not None else None

    alert = SosAlert(
        driver_id=driver.id,
        trip_id=trip.id if trip else None,
        latitude=latitude,
        longitude=longitude,
        status=SosStatus.OPEN,
    )
    db.session.add(alert)
    db.session.commit()
    return jsonify({"alert": alert.to_dict()}), 201


@alerts_bp.get("/sos")
@role_required("admin")
def list_sos():
    """Recent / open SOS alerts for admin dashboard."""
    status_filter = (request.args.get("status") or "").strip().lower()
    q = SosAlert.query
    if status_filter == "open":
        q = q.filter_by(status=SosStatus.OPEN)
    elif status_filter == "resolved":
        q = q.filter_by(status=SosStatus.RESOLVED)

    alerts = q.order_by(SosAlert.created_at.desc()).limit(100).all()
    return jsonify({"alerts": [a.to_dict() for a in alerts]}), 200


@alerts_bp.patch("/sos/<int:alert_id>/resolve")
@role_required("admin")
def resolve_sos(alert_id: int):
    alert = SosAlert.query.get(alert_id)
    if not alert:
        return jsonify({"error": "SOS alert not found"}), 404
    if alert.status == SosStatus.RESOLVED:
        return jsonify({"alert": alert.to_dict()}), 200

    alert.status = SosStatus.RESOLVED
    alert.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"alert": alert.to_dict()}), 200


# ---- Speeding logs (admin, optional Phase 4) ----


@alerts_bp.get("/speeding")
@role_required("admin")
def list_speeding():
    logs = (
        SpeedingLog.query.order_by(SpeedingLog.recorded_at.desc()).limit(100).all()
    )
    return jsonify({"logs": [log.to_dict() for log in logs]}), 200
