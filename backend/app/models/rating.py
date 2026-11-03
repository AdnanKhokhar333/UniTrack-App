from datetime import datetime, timezone

from app.utils.extensions import db


class DriverRating(db.Model):
    """Post-trip 1–5 star rating — table ready; APIs can come later."""

    __tablename__ = "driver_ratings"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("student_profiles.id"), nullable=False
    )
    driver_id = db.Column(
        db.Integer, db.ForeignKey("driver_profiles.id"), nullable=False
    )
    trip_id = db.Column(db.Integer, db.ForeignKey("trips.id"), nullable=True)
    stars = db.Column(db.Integer, nullable=False)  # 1–5
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        db.CheckConstraint("stars >= 1 AND stars <= 5", name="ck_rating_stars"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "driver_id": self.driver_id,
            "trip_id": self.trip_id,
            "stars": self.stars,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
