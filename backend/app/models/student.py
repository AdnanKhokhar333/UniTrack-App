from datetime import datetime, timezone

from app.utils.extensions import db


class StudentProfile(db.Model):
    """One student has ONE active_route_id — change only via Admin reassignment."""

    __tablename__ = "student_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )
    student_number = db.Column(db.String(50), nullable=False)
    full_name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(30), nullable=True)
    active_route_id = db.Column(
        db.Integer, db.ForeignKey("routes.id"), nullable=True, index=True
    )
    stop_id = db.Column(db.Integer, db.ForeignKey("stops.id"), nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = db.relationship("User", back_populates="student_profile")
    active_route = db.relationship("Route", back_populates="students")
    stop = db.relationship("Stop", back_populates="students")
    attendance_records = db.relationship(
        "Attendance", back_populates="student", lazy="dynamic"
    )

    __table_args__ = (
        db.UniqueConstraint("student_number", name="uq_student_number"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "student_number": self.student_number,
            "full_name": self.full_name,
            "phone": self.phone,
            "active_route_id": self.active_route_id,
            "stop_id": self.stop_id,
            "email": self.user.email if self.user else None,
            "is_approved": self.user.is_approved if self.user else False,
        }
