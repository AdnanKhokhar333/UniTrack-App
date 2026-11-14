import hashlib
import hmac
from datetime import date

from flask import Blueprint, current_app, jsonify
from flask_jwt_extended import get_jwt_identity

from app.models.user import User
from app.utils.decorators import role_required

students_bp = Blueprint("students", __name__, url_prefix="/api/students")


def _pass_token(student_id: int, student_number: str, valid_date: str) -> str:
    secret = current_app.config["SECRET_KEY"]
    msg = f"{student_id}:{student_number}:{valid_date}".encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()[:32]


@students_bp.get("/me/pass")
@role_required("student")
def my_bus_pass():
    """Digital QR bus pass for today. Revoke by setting user.is_approved=False."""
    user = User.query.get(int(get_jwt_identity()))
    profile = user.student_profile if user else None
    if not user or not profile:
        return jsonify({"error": "Student profile not found"}), 404

    if not user.is_active or not user.is_approved:
        return jsonify(
            {
                "error": "Pass revoked or account inactive",
                "is_approved": user.is_approved,
                "is_active": user.is_active,
            }
        ), 403

    valid_date = date.today().isoformat()
    route = profile.active_route
    stop = profile.stop
    university = user.university

    token = _pass_token(profile.id, profile.student_number, valid_date)

    return jsonify(
        {
            "pass": {
                "student_number": profile.student_number,
                "full_name": profile.full_name,
                "route_name": route.name if route else None,
                "stop_name": stop.name if stop else None,
                "university": university.name if university else None,
                "valid_date": valid_date,
                "token": token,
                "is_approved": user.is_approved,
                "is_active": user.is_active,
            }
        }
    ), 200
