from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from app.models.attendance import Attendance, AttendanceStatus
from app.models.student import StudentProfile
from app.models.user import User
from app.utils.decorators import role_required
from app.utils.extensions import db

attendance_bp = Blueprint("attendance", __name__, url_prefix="/api/attendance")


@attendance_bp.post("")
@role_required("student")
def submit_attendance():
    """Mandatory daily toggle: taking | absent."""
    data = request.get_json(silent=True) or {}
    status_raw = (data.get("status") or "").lower()
    if status_raw not in (AttendanceStatus.TAKING.value, AttendanceStatus.ABSENT.value):
        return jsonify({"error": "status must be 'taking' or 'absent'"}), 400

    user = User.query.get(int(get_jwt_identity()))
    profile = user.student_profile if user else None
    if not profile:
        return jsonify({"error": "Student profile not found"}), 404
    if not profile.active_route_id:
        return jsonify({"error": "No active route assigned — contact admin"}), 400

    target_date = date.today()
    if data.get("date"):
        target_date = date.fromisoformat(data["date"])

    record = Attendance.query.filter_by(
        student_id=profile.id, attendance_date=target_date
    ).first()

    if record:
        record.status = AttendanceStatus(status_raw)
        record.route_id = profile.active_route_id
    else:
        record = Attendance(
            student_id=profile.id,
            route_id=profile.active_route_id,
            attendance_date=target_date,
            status=AttendanceStatus(status_raw),
        )
        db.session.add(record)

    db.session.commit()
    return jsonify({"attendance": record.to_dict()}), 200


@attendance_bp.get("/today")
@role_required("student")
def my_today():
    user = User.query.get(int(get_jwt_identity()))
    profile = user.student_profile if user else None
    if not profile:
        return jsonify({"error": "Student profile not found"}), 404

    record = Attendance.query.filter_by(
        student_id=profile.id, attendance_date=date.today()
    ).first()
    return jsonify({"attendance": record.to_dict() if record else None}), 200


@attendance_bp.get("/route/<int:route_id>")
@role_required("admin", "driver")
def route_attendance_today(route_id: int):
    """Stop-wise expected students for drivers (taking vs absent)."""
    records = Attendance.query.filter_by(
        route_id=route_id, attendance_date=date.today()
    ).all()

    taking = [r.to_dict() for r in records if r.status == AttendanceStatus.TAKING]
    absent = [r.to_dict() for r in records if r.status == AttendanceStatus.ABSENT]

    by_stop: dict = {}
    for r in records:
        stop_id = r.student.stop_id if r.student else None
        key = str(stop_id) if stop_id is not None else "unassigned"
        bucket = by_stop.setdefault(
            key, {"stop_id": stop_id, "taking": [], "absent": [], "taking_count": 0, "absent_count": 0}
        )
        entry = r.to_dict()
        if r.status == AttendanceStatus.TAKING:
            bucket["taking"].append(entry)
            bucket["taking_count"] += 1
        else:
            bucket["absent"].append(entry)
            bucket["absent_count"] += 1

    return jsonify(
        {
            "route_id": route_id,
            "date": date.today().isoformat(),
            "taking_count": len(taking),
            "absent_count": len(absent),
            "taking": taking,
            "absent": absent,
            "by_stop": list(by_stop.values()),
        }
    ), 200
