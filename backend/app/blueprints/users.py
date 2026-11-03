from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity

from app.models.alert import DeviceToken
from app.models.driver import DriverProfile
from app.models.student import StudentProfile
from app.models.user import User, UserRole
from app.services.auth_service import create_user
from app.utils.decorators import role_required
from app.utils.extensions import db

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.post("/students")
@role_required("admin")
def create_student():
    """Admin creates + approves a student (no public self-registration)."""
    data = request.get_json(silent=True) or {}
    required = ("email", "password", "full_name", "student_number")
    missing = [k for k in required if not data.get(k)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    if User.query.filter_by(email=data["email"].strip().lower()).first():
        return jsonify({"error": "Email already registered"}), 409
    if StudentProfile.query.filter_by(student_number=data["student_number"]).first():
        return jsonify({"error": "Student number already exists"}), 409

    claims = get_jwt()
    university_id = claims["university_id"]
    approve = bool(data.get("is_approved", True))

    user = create_user(
        university_id=university_id,
        email=data["email"],
        password=data["password"],
        role=UserRole.STUDENT,
        is_approved=approve,
    )
    db.session.flush()

    profile = StudentProfile(
        user_id=user.id,
        student_number=data["student_number"],
        full_name=data["full_name"],
        phone=data.get("phone"),
        active_route_id=data.get("active_route_id"),
        stop_id=data.get("stop_id"),
    )
    db.session.add(profile)
    db.session.commit()

    return jsonify({"user": user.to_dict(), "student_profile": profile.to_dict()}), 201


@users_bp.post("/students/<int:user_id>/approve")
@role_required("admin")
def approve_student(user_id: int):
    user = User.query.get(user_id)
    if not user or user.role != UserRole.STUDENT:
        return jsonify({"error": "Student not found"}), 404
    user.is_approved = True
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@users_bp.patch("/students/<int:student_profile_id>/route")
@role_required("admin")
def reassign_student_route(student_profile_id: int):
    """Only admin may change a student's active route."""
    data = request.get_json(silent=True) or {}
    profile = StudentProfile.query.get(student_profile_id)
    if not profile:
        return jsonify({"error": "Student profile not found"}), 404

    profile.active_route_id = data.get("active_route_id")
    if "stop_id" in data:
        profile.stop_id = data.get("stop_id")
    db.session.commit()
    return jsonify({"student_profile": profile.to_dict()}), 200


@users_bp.get("/students")
@role_required("admin")
def list_students():
    profiles = StudentProfile.query.all()
    return jsonify({"students": [p.to_dict() for p in profiles]}), 200


@users_bp.post("/drivers")
@role_required("admin")
def create_driver():
    """Admin creates driver credentials (+ optional bus assignment)."""
    data = request.get_json(silent=True) or {}
    required = ("email", "password", "full_name")
    missing = [k for k in required if not data.get(k)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    if User.query.filter_by(email=data["email"].strip().lower()).first():
        return jsonify({"error": "Email already registered"}), 409

    claims = get_jwt()
    user = create_user(
        university_id=claims["university_id"],
        email=data["email"],
        password=data["password"],
        role=UserRole.DRIVER,
        is_approved=True,
    )
    db.session.flush()

    profile = DriverProfile(
        user_id=user.id,
        full_name=data["full_name"],
        phone=data.get("phone"),
        license_number=data.get("license_number"),
        bus_id=data.get("bus_id"),
    )
    db.session.add(profile)
    db.session.commit()

    return jsonify({"user": user.to_dict(), "driver_profile": profile.to_dict()}), 201


@users_bp.get("/drivers")
@role_required("admin")
def list_drivers():
    profiles = DriverProfile.query.all()
    return jsonify({"drivers": [p.to_dict() for p in profiles]}), 200


@users_bp.post("/me/push-token")
@role_required("admin", "driver", "student")
def register_push_token():
    """Register or refresh an Expo push token for the logged-in user."""
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    if not token:
        return jsonify({"error": "token is required"}), 400

    user_id = int(get_jwt_identity())
    platform = (data.get("platform") or "").strip()[:40] or None

    existing = DeviceToken.query.filter_by(token=token).first()
    if existing:
        existing.user_id = user_id
        existing.platform = platform or existing.platform
        existing.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify({"device_token": existing.to_dict()}), 200

    row = DeviceToken(user_id=user_id, token=token, platform=platform)
    db.session.add(row)
    db.session.commit()
    return jsonify({"device_token": row.to_dict()}), 201
