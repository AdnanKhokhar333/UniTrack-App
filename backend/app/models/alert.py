import enum
from datetime import datetime, timezone

from app.utils.extensions import db


class SosStatus(str, enum.Enum):
    OPEN = "open"
    RESOLVED = "resolved"


class MissedBusAlert(db.Model):
    """Student reports they missed the bus on their assigned route."""

    __tablename__ = "missed_bus_alerts"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    trip_id = db.Column(db.Integer, db.ForeignKey("trips.id"), nullable=True, index=True)
    route_id = db.Column(
        db.Integer, db.ForeignKey("routes.id"), nullable=False, index=True
    )
    stop_id = db.Column(db.Integer, db.ForeignKey("stops.id"), nullable=True)
    message = db.Column(db.String(500), nullable=True)
    acknowledged = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    student = db.relationship("StudentProfile")
    trip = db.relationship("Trip")
    route = db.relationship("Route")
    stop = db.relationship("Stop")

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "trip_id": self.trip_id,
            "route_id": self.route_id,
            "stop_id": self.stop_id,
            "message": self.message,
            "acknowledged": self.acknowledged,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "student_name": self.student.full_name if self.student else None,
            "stop_name": self.stop.name if self.stop else None,
        }


class SosAlert(db.Model):
    """Driver emergency SOS with optional GPS fix."""

    __tablename__ = "sos_alerts"

    id = db.Column(db.Integer, primary_key=True)
    driver_id = db.Column(
        db.Integer, db.ForeignKey("driver_profiles.id"), nullable=False, index=True
    )
    trip_id = db.Column(db.Integer, db.ForeignKey("trips.id"), nullable=True, index=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    status = db.Column(
        db.Enum(SosStatus, values_callable=lambda x: [e.value for e in x]),
        default=SosStatus.OPEN,
        nullable=False,
        index=True,
    )
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    resolved_at = db.Column(db.DateTime, nullable=True)

    driver = db.relationship("DriverProfile")
    trip = db.relationship("Trip")

    def to_dict(self):
        return {
            "id": self.id,
            "driver_id": self.driver_id,
            "trip_id": self.trip_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "status": self.status.value
            if isinstance(self.status, SosStatus)
            else self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "driver_name": self.driver.full_name if self.driver else None,
        }


class DeviceToken(db.Model):
    """Expo (or other) push token registered for a logged-in user."""

    __tablename__ = "device_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    token = db.Column(db.String(512), nullable=False, unique=True)
    platform = db.Column(db.String(40), nullable=True)
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "token": self.token,
            "platform": self.platform,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
