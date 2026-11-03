from datetime import datetime, timezone

from app.utils.extensions import db


class Complaint(db.Model):
    """Basic table for later admin dashboard — APIs deferred."""

    __tablename__ = "complaints"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("student_profiles.id"), nullable=False
    )
    driver_id = db.Column(
        db.Integer, db.ForeignKey("driver_profiles.id"), nullable=True
    )
    trip_id = db.Column(db.Integer, db.ForeignKey("trips.id"), nullable=True)
    subject = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    is_resolved = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "driver_id": self.driver_id,
            "trip_id": self.trip_id,
            "subject": self.subject,
            "body": self.body,
            "is_resolved": self.is_resolved,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
