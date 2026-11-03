from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.user import User
from app.services.auth_service import authenticate, issue_token

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/login")
def login():
    """Shared login for admin / driver / student — no public signup."""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    password = data.get("password", "")
    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user, err = authenticate(email, password)
    if err:
        return jsonify({"error": err}), 401

    token = issue_token(user)
    payload = {
        "access_token": token,
        "user": user.to_dict(),
    }
    if user.driver_profile:
        payload["driver_profile"] = user.driver_profile.to_dict()
    if user.student_profile:
        payload["student_profile"] = user.student_profile.to_dict()
    return jsonify(payload), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "User not found"}), 404
    payload = {"user": user.to_dict()}
    if user.driver_profile:
        payload["driver_profile"] = user.driver_profile.to_dict()
    if user.student_profile:
        payload["student_profile"] = user.student_profile.to_dict()
    return jsonify(payload), 200
