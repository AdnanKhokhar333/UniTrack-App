from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func

from app.models.driver import DriverProfile
from app.models.rating import DriverRating
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.utils.decorators import role_required
from app.utils.extensions import db

ratings_bp = Blueprint("ratings", __name__, url_prefix="/api/ratings")


def _student_profile():
    user = User.query.get(int(get_jwt_identity()))
    return user.student_profile if user else None


def _resolve_trip_and_driver(student, data: dict):
    """Prefer explicit trip_id / driver_id; else latest trip on student's route."""
    trip = None
    trip_id = data.get("trip_id")
    driver_id = data.get("driver_id")

    if trip_id is not None:
        trip = Trip.query.get(int(trip_id))
        if not trip:
            return None, None, (jsonify({"error": "Trip not found"}), 404)
        if student.active_route_id and trip.route_id != student.active_route_id:
            return None, None, (
                jsonify({"error": "Trip is not on your assigned route"}),
                403,
            )
        driver_id = trip.driver_id
    elif driver_id is not None:
        driver_id = int(driver_id)
        if not DriverProfile.query.get(driver_id):
            return None, None, (jsonify({"error": "Driver not found"}), 404)
    else:
        if not student.active_route_id:
            return None, None, (
                jsonify({"error": "No active route — provide trip_id or driver_id"}),
                400,
            )
        trip = (
            Trip.query.filter(
                Trip.route_id == student.active_route_id,
                Trip.status.in_([TripStatus.COMPLETED, TripStatus.ACTIVE]),
            )
            .order_by(Trip.started_at.desc())
            .first()
        )
        if not trip:
            return None, None, (
                jsonify({"error": "No recent trip on your route to rate"}),
                400,
            )
        driver_id = trip.driver_id

    return trip, driver_id, None


@ratings_bp.post("")
@role_required("student")
def create_rating():
    student = _student_profile()
    if not student:
        return jsonify({"error": "Student profile not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        stars = int(data.get("stars"))
    except (TypeError, ValueError):
        return jsonify({"error": "stars must be an integer 1–5"}), 400
    if stars < 1 or stars > 5:
        return jsonify({"error": "stars must be between 1 and 5"}), 400

    trip, driver_id, err = _resolve_trip_and_driver(student, data)
    if err:
        return err

    comment = (data.get("comment") or "").strip() or None
    if comment and len(comment) > 2000:
        comment = comment[:2000]

    rating = DriverRating(
        student_id=student.id,
        driver_id=driver_id,
        trip_id=trip.id if trip else (int(data["trip_id"]) if data.get("trip_id") else None),
        stars=stars,
        comment=comment,
    )
    db.session.add(rating)
    db.session.commit()
    return jsonify({"rating": rating.to_dict()}), 201


@ratings_bp.get("")
@role_required("admin")
def list_ratings():
    driver_id = request.args.get("driver_id", type=int)
    q = DriverRating.query
    if driver_id is not None:
        q = q.filter_by(driver_id=driver_id)

    ratings = q.order_by(DriverRating.created_at.desc()).limit(200).all()

    avg_rows = (
        db.session.query(
            DriverRating.driver_id,
            func.avg(DriverRating.stars).label("avg_stars"),
            func.count(DriverRating.id).label("count"),
        )
        .group_by(DriverRating.driver_id)
        .all()
    )
    averages = []
    for row in avg_rows:
        driver = DriverProfile.query.get(row.driver_id)
        averages.append(
            {
                "driver_id": row.driver_id,
                "driver_name": driver.full_name if driver else None,
                "avg_stars": round(float(row.avg_stars), 2),
                "count": int(row.count),
            }
        )

    return jsonify(
        {
            "ratings": [r.to_dict() for r in ratings],
            "averages": averages,
        }
    ), 200
