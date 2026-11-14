import csv
import io
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity

from app.models.alert import DeviceToken
from app.models.driver import DriverProfile
from app.models.student import StudentProfile
from app.models.trip import Trip, TripStatus
from app.models.user import User, UserRole
from app.services.auth_service import create_user
from app.utils.decorators import role_required
from app.utils.extensions import db

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


def _create_student_row(university_id: int, data: dict) -> tuple[dict | None, str | None]:
    """Create one student. Returns (result_dict, error_message)."""
    required = ("email", "password", "full_name", "student_number")
    missing = [k for k in required if not (data.get(k) or "").strip()]
    if missing:
        return None, f"Missing fields: {', '.join(missing)}"

    email = data["email"].strip().lower()
    student_number = str(data["student_number"]).strip()
    if User.query.filter_by(email=email).first():
        return None, "Email already registered"
    if StudentProfile.query.filter_by(student_number=student_number).first():
        return None, "Student number already exists"

    approve = bool(data.get("is_approved", True))
    if isinstance(data.get("is_approved"), str):
        approve = data["is_approved"].strip().lower() in ("1", "true", "yes", "y")

    active_route_id = data.get("active_route_id")
    stop_id = data.get("stop_id")
    if active_route_id in ("", None):
        active_route_id = None
    else:
        active_route_id = int(active_route_id)
    if stop_id in ("", None):
        stop_id = None
    else:
        stop_id = int(stop_id)

    user = create_user(
        university_id=university_id,
        email=email,
        password=data["password"],
        role=UserRole.STUDENT,
        is_approved=approve,
    )
    db.session.flush()

    profile = StudentProfile(
        user_id=user.id,
        student_number=student_number,
        full_name=data["full_name"].strip(),
        phone=(data.get("phone") or "").strip() or None,
        active_route_id=active_route_id,
        stop_id=stop_id,
    )
    db.session.add(profile)
    db.session.flush()
    return {
        "user": user.to_dict(),
        "student_profile": profile.to_dict(),
    }, None


@users_bp.post("/students")
@role_required("admin")
def create_student():
    """Admin creates + approves a student (no public self-registration)."""
    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    result, err = _create_student_row(claims["university_id"], data)
    if err:
        status = 409 if "already" in err.lower() else 400
        return jsonify({"error": err}), status
    db.session.commit()
    return jsonify(result), 201


@users_bp.post("/students/bulk")
@role_required("admin")
def bulk_create_students():
    """
    Bulk create students from JSON `{students:[...]}` or multipart CSV file.
    CSV columns: email,password,full_name,student_number[,phone,active_route_id,stop_id]
    """
    claims = get_jwt()
    university_id = claims["university_id"]
    rows: list[dict] = []

    if request.content_type and "multipart/form-data" in request.content_type:
        upload = request.files.get("file") or request.files.get("csv")
        if not upload:
            return jsonify({"error": "CSV file field 'file' is required"}), 400
        text = upload.read().decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            return jsonify({"error": "CSV has no header row"}), 400
        for raw in reader:
            rows.append({(k or "").strip(): (v or "").strip() for k, v in raw.items()})
    else:
        data = request.get_json(silent=True) or {}
        rows = data.get("students") or []
        if not isinstance(rows, list):
            return jsonify({"error": "students must be a list"}), 400

    if not rows:
        return jsonify({"error": "No student rows provided"}), 400

    success = []
    errors = []
    seen_emails: set[str] = set()
    seen_numbers: set[str] = set()

    for idx, row in enumerate(rows):
        line = idx + 1
        email = (row.get("email") or "").strip().lower()
        number = str(row.get("student_number") or "").strip()
        if email and email in seen_emails:
            errors.append({"row": line, "error": "Duplicate email in upload", "email": email})
            continue
        if number and number in seen_numbers:
            errors.append(
                {
                    "row": line,
                    "error": "Duplicate student_number in upload",
                    "student_number": number,
                }
            )
            continue

        try:
            # Savepoint so one bad row does not wipe prior successes
            with db.session.begin_nested():
                result, err = _create_student_row(university_id, row)
                if err:
                    raise ValueError(err)
        except ValueError as ve:
            errors.append(
                {
                    "row": line,
                    "error": str(ve),
                    "email": email or None,
                    "student_number": number or None,
                }
            )
            continue
        except Exception as exc:
            errors.append(
                {
                    "row": line,
                    "error": str(exc) or "Create failed",
                    "email": email or None,
                    "student_number": number or None,
                }
            )
            continue

        if email:
            seen_emails.add(email)
        if number:
            seen_numbers.add(number)
        success.append({"row": line, **result})

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Bulk commit failed — check duplicates"}), 409

    return jsonify(
        {
            "created": len(success),
            "failed": len(errors),
            "success": success,
            "errors": errors,
        }
    ), 200


@users_bp.post("/students/<int:user_id>/approve")
@role_required("admin")
def approve_student(user_id: int):
    user = User.query.get(user_id)
    if not user or user.role != UserRole.STUDENT:
        return jsonify({"error": "Student not found"}), 404
    user.is_approved = True
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@users_bp.post("/students/<int:user_id>/revoke")
@role_required("admin")
def revoke_student(user_id: int):
    """Revoke digital bus pass / access by setting is_approved=False."""
    user = User.query.get(user_id)
    if not user or user.role != UserRole.STUDENT:
        return jsonify({"error": "Student not found"}), 404
    user.is_approved = False
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


@users_bp.delete("/students/<int:student_profile_id>")
@role_required("admin")
def delete_student(student_profile_id: int):
    """
    Soft-deactivate a student (User.is_active=false).
    Clears route assignment; keeps attendance/ratings history.
    Does not change is_approved — revoke-pass remains a separate action.
    """
    profile = StudentProfile.query.get(student_profile_id)
    if not profile or not profile.user or profile.user.role != UserRole.STUDENT:
        return jsonify({"error": "Student not found"}), 404

    if not profile.user.is_active:
        return jsonify({"error": "Student is already deactivated"}), 409

    profile.active_route_id = None
    profile.stop_id = None
    profile.user.is_active = False
    db.session.commit()

    return jsonify(
        {
            "message": "Student deactivated",
            "student_profile": profile.to_dict(),
        }
    ), 200


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


@users_bp.patch("/drivers/<int:driver_profile_id>")
@role_required("admin")
def update_driver(driver_profile_id: int):
    """Admin updates driver profile fields and optional password / bus assignment."""
    profile = DriverProfile.query.get(driver_profile_id)
    if not profile or not profile.user or profile.user.role != UserRole.DRIVER:
        return jsonify({"error": "Driver not found"}), 404

    data = request.get_json(silent=True) or {}

    if "full_name" in data:
        name = (data.get("full_name") or "").strip()
        if not name:
            return jsonify({"error": "full_name cannot be empty"}), 400
        profile.full_name = name

    if "phone" in data:
        phone = data.get("phone")
        profile.phone = (str(phone).strip() or None) if phone is not None else None

    if "license_number" in data:
        license_number = data.get("license_number")
        profile.license_number = (
            (str(license_number).strip() or None) if license_number is not None else None
        )

    if "bus_id" in data:
        bus_id = data.get("bus_id")
        if bus_id in ("", None):
            profile.bus_id = None
        else:
            bus_id = int(bus_id)
            taken = DriverProfile.query.filter(
                DriverProfile.bus_id == bus_id,
                DriverProfile.id != profile.id,
            ).first()
            if taken:
                return jsonify({"error": "Bus is already assigned to another driver"}), 409
            profile.bus_id = bus_id

    password = data.get("password")
    if password:
        if len(str(password)) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400
        profile.user.set_password(str(password))

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Update conflict"}), 409

    return jsonify({"driver_profile": profile.to_dict()}), 200


@users_bp.delete("/drivers/<int:driver_profile_id>")
@role_required("admin")
def delete_driver(driver_profile_id: int):
    """Deactivate a driver. Unassigns bus first; blocked if an active trip exists."""
    profile = DriverProfile.query.get(driver_profile_id)
    if not profile or not profile.user or profile.user.role != UserRole.DRIVER:
        return jsonify({"error": "Driver not found"}), 404

    active_trip = Trip.query.filter_by(
        driver_id=profile.id, status=TripStatus.ACTIVE
    ).first()
    if active_trip:
        return jsonify(
            {
                "error": (
                    "Driver has an active trip — end the trip before deactivating"
                )
            }
        ), 409

    profile.bus_id = None
    profile.user.is_active = False
    db.session.commit()

    return jsonify(
        {
            "message": "Driver deactivated",
            "driver_profile": profile.to_dict(),
        }
    ), 200


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
