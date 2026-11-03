from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt

from app.models.route import Route, Stop
from app.utils.decorators import role_required
from app.utils.extensions import db

routes_bp = Blueprint("routes", __name__, url_prefix="/api/routes")


@routes_bp.get("")
@role_required("admin", "driver", "student")
def list_routes():
    claims = get_jwt()
    routes = Route.query.filter_by(university_id=claims["university_id"]).all()
    return jsonify({"routes": [r.to_dict() for r in routes]}), 200


@routes_bp.post("")
@role_required("admin")
def create_route():
    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return jsonify({"error": "name is required"}), 400

    claims = get_jwt()
    route = Route(
        university_id=claims["university_id"],
        name=data["name"],
        description=data.get("description"),
        is_active=bool(data.get("is_active", True)),
    )
    db.session.add(route)
    db.session.flush()

    for stop_data in data.get("stops") or []:
        stop = Stop(
            route_id=route.id,
            name=stop_data["name"],
            latitude=float(stop_data["latitude"]),
            longitude=float(stop_data["longitude"]),
            sequence_order=int(stop_data["sequence_order"]),
        )
        db.session.add(stop)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Route name conflict or invalid stops"}), 409

    return jsonify({"route": route.to_dict()}), 201


@routes_bp.get("/<int:route_id>")
@role_required("admin", "driver", "student")
def get_route(route_id: int):
    route = Route.query.get(route_id)
    if not route:
        return jsonify({"error": "Route not found"}), 404
    return jsonify({"route": route.to_dict()}), 200


@routes_bp.put("/<int:route_id>")
@role_required("admin")
def update_route(route_id: int):
    route = Route.query.get(route_id)
    if not route:
        return jsonify({"error": "Route not found"}), 404

    data = request.get_json(silent=True) or {}
    for field in ("name", "description", "is_active"):
        if field in data:
            setattr(route, field, data[field])

    if "stops" in data:
        Stop.query.filter_by(route_id=route.id).delete()
        for stop_data in data["stops"]:
            db.session.add(
                Stop(
                    route_id=route.id,
                    name=stop_data["name"],
                    latitude=float(stop_data["latitude"]),
                    longitude=float(stop_data["longitude"]),
                    sequence_order=int(stop_data["sequence_order"]),
                )
            )

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Update conflict"}), 409

    return jsonify({"route": route.to_dict()}), 200


@routes_bp.post("/<int:route_id>/stops")
@role_required("admin")
def add_stop(route_id: int):
    route = Route.query.get(route_id)
    if not route:
        return jsonify({"error": "Route not found"}), 404

    data = request.get_json(silent=True) or {}
    required = ("name", "latitude", "longitude", "sequence_order")
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    stop = Stop(
        route_id=route.id,
        name=data["name"],
        latitude=float(data["latitude"]),
        longitude=float(data["longitude"]),
        sequence_order=int(data["sequence_order"]),
    )
    db.session.add(stop)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Sequence order conflict"}), 409

    return jsonify({"stop": stop.to_dict()}), 201


@routes_bp.delete("/<int:route_id>")
@role_required("admin")
def deactivate_route(route_id: int):
    route = Route.query.get(route_id)
    if not route:
        return jsonify({"error": "Route not found"}), 404
    route.is_active = False
    db.session.commit()
    return jsonify({"route": route.to_dict()}), 200
