from datetime import datetime, timezone

from app.utils.extensions import db


class SpeedingLog(db.Model):
    """Logged when driver speed exceeds SPEEDING_THRESHOLD_KMH (default 70)."""

    __tablename__ = "speeding_logs"

    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey("trips.id"), nullable=False, index=True)
    driver_id = db.Column(
        db.Integer, db.ForeignKey("driver_profiles.id"), nullable=False
    )
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    speed_kmh = db.Column(db.Float, nullable=False)
    threshold_kmh = db.Column(db.Float, nullable=False, default=70.0)
    recorded_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "trip_id": self.trip_id,
            "driver_id": self.driver_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "speed_kmh": self.speed_kmh,
            "threshold_kmh": self.threshold_kmh,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }
