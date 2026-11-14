from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from app.models.complaint import Complaint
from app.models.driver import DriverProfile
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.utils.decorators import role_required
from app.utils.extensions import db

complaints_bp = Blueprint("complaints", __name__, url_prefix="/api/complaints")


def _student_profile():
    user = User.query.get(int(get_jwt_identity()))
    return user.student_profile if user else None


@complaints_bp.post("")
@role_required("student")
def create_complaint():
    student = _student_profile()
    if not student:
        return jsonify({"error": "Student profile not found"}), 404

    data = request.get_json(silent=True) or {}
    subject = (data.get("subject") or "").strip()
    body = (data.get("body") or "").strip()
    if not subject or not body:
        return jsonify({"error": "subject and body are required"}), 400
    if len(subject) > 200:
        subject = subject[:200]

    trip_id = data.get("trip_id")
    driver_id = data.get("driver_id")

    if trip_id is not None:
        trip = Trip.query.get(int(trip_id))
        if not trip:
            return jsonify({"error": "Trip not found"}), 404
        trip_id = trip.id
        if driver_id is None:
            driver_id = trip.driver_id
    elif driver_id is None and student.active_route_id:
        trip = (
            Trip.query.filter(
                Trip.route_id == student.active_route_id,
                Trip.status.in_([TripStatus.COMPLETED, TripStatus.ACTIVE]),
            )
            .order_by(Trip.started_at.desc())
            .first()
        )
        if trip:
            trip_id = trip.id
            driver_id = trip.driver_id

    if driver_id is not None:
        driver_id = int(driver_id)
        if not DriverProfile.query.get(driver_id):
            return jsonify({"error": "Driver not found"}), 404

    complaint = Complaint(
        student_id=student.id,
        driver_id=driver_id,
        trip_id=int(trip_id) if trip_id is not None else None,
        subject=subject,
        body=body,
        is_resolved=False,
    )
    db.session.add(complaint)
    db.session.commit()
    return jsonify({"complaint": complaint.to_dict()}), 201


@complaints_bp.get("")
@role_required("admin")
def list_complaints():
    resolved = request.args.get("resolved")
    q = Complaint.query
    if resolved is not None:
        flag = str(resolved).strip().lower() in ("1", "true", "yes")
        q = q.filter_by(is_resolved=flag)

    rows = q.order_by(Complaint.created_at.desc()).limit(200).all()
    return jsonify({"complaints": [c.to_dict() for c in rows]}), 200


@complaints_bp.patch("/<int:complaint_id>/resolve")
@role_required("admin")
def resolve_complaint(complaint_id: int):
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    data = request.get_json(silent=True) or {}
    # Default: mark resolved; allow reopening with is_resolved=false
    if "is_resolved" in data:
        complaint.is_resolved = bool(data["is_resolved"])
    else:
        complaint.is_resolved = True

    db.session.commit()
    return jsonify({"complaint": complaint.to_dict()}), 200


@complaints_bp.delete("/<int:complaint_id>")
@role_required("admin")
def delete_complaint(complaint_id: int):
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    db.session.delete(complaint)
    db.session.commit()
    return jsonify({"message": "Complaint deleted", "id": complaint_id}), 200
