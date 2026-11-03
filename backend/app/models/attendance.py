import enum
from datetime import date, datetime, timezone

from app.utils.extensions import db


class AttendanceStatus(str, enum.Enum):
    TAKING = "taking"  # "Will Take Bus"
    ABSENT = "absent"


class Attendance(db.Model):
    """Daily mandatory attendance — one record per student per date."""

    __tablename__ = "attendance"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    route_id = db.Column(db.Integer, db.ForeignKey("routes.id"), nullable=False)
    attendance_date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    status = db.Column(
        db.Enum(
            AttendanceStatus,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    student = db.relationship("StudentProfile", back_populates="attendance_records")
    route = db.relationship("Route")

    __table_args__ = (
        db.UniqueConstraint(
            "student_id", "attendance_date", name="uq_attendance_student_date"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "route_id": self.route_id,
            "attendance_date": self.attendance_date.isoformat()
            if self.attendance_date
            else None,
            "status": self.status.value
            if isinstance(self.status, AttendanceStatus)
            else self.status,
            "student_name": self.student.full_name if self.student else None,
            "stop_id": self.student.stop_id if self.student else None,
        }
