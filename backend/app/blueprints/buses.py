from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt

from app.models.bus import Bus
from app.utils.decorators import role_required
from app.utils.extensions import db

buses_bp = Blueprint("buses", __name__, url_prefix="/api/buses")


@buses_bp.get("")
@role_required("admin", "driver")
def list_buses():
    claims = get_jwt()
    buses = Bus.query.filter_by(university_id=claims["university_id"]).all()
    return jsonify({"buses": [b.to_dict() for b in buses]}), 200


@buses_bp.post("")
@role_required("admin")
def create_bus():
    data = request.get_json(silent=True) or {}
    required = ("bus_number", "registration")
    missing = [k for k in required if not data.get(k)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    claims = get_jwt()
    bus = Bus(
        university_id=claims["university_id"],
        bus_number=data["bus_number"],
        registration=data["registration"],
        capacity=int(data.get("capacity", 40)),
        is_active=bool(data.get("is_active", True)),
    )
    db.session.add(bus)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Bus number or registration already exists"}), 409

    return jsonify({"bus": bus.to_dict()}), 201


@buses_bp.get("/<int:bus_id>")
@role_required("admin", "driver")
def get_bus(bus_id: int):
    bus = Bus.query.get(bus_id)
    if not bus:
        return jsonify({"error": "Bus not found"}), 404
    return jsonify({"bus": bus.to_dict()}), 200


@buses_bp.put("/<int:bus_id>")
@role_required("admin")
def update_bus(bus_id: int):
    bus = Bus.query.get(bus_id)
    if not bus:
        return jsonify({"error": "Bus not found"}), 404

    data = request.get_json(silent=True) or {}
    for field in ("bus_number", "registration", "capacity", "is_active"):
        if field in data:
            setattr(bus, field, data[field])

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Update conflict"}), 409

    return jsonify({"bus": bus.to_dict()}), 200


@buses_bp.delete("/<int:bus_id>")
@role_required("admin")
def delete_bus(bus_id: int):
    bus = Bus.query.get(bus_id)
    if not bus:
        return jsonify({"error": "Bus not found"}), 404
    bus.is_active = False
    db.session.commit()
    return jsonify({"message": "Bus deactivated", "bus": bus.to_dict()}), 200
