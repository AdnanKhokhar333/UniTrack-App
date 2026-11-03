import enum
from datetime import datetime, timezone

from app.utils.extensions import db


class TripStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Trip(db.Model):
    __tablename__ = "trips"

    id = db.Column(db.Integer, primary_key=True)
    bus_id = db.Column(db.Integer, db.ForeignKey("buses.id"), nullable=False, index=True)
    driver_id = db.Column(
        db.Integer, db.ForeignKey("driver_profiles.id"), nullable=False, index=True
    )
    route_id = db.Column(
        db.Integer, db.ForeignKey("routes.id"), nullable=False, index=True
    )
    status = db.Column(
        db.Enum(TripStatus, values_callable=lambda x: [e.value for e in x]),
        default=TripStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    started_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    ended_at = db.Column(db.DateTime, nullable=True)

    bus = db.relationship("Bus", back_populates="trips")
    driver = db.relationship("DriverProfile", back_populates="trips")
    route = db.relationship("Route", back_populates="trips")
    locations = db.relationship(
        "TripLocation",
        back_populates="trip",
        order_by="TripLocation.recorded_at",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def to_dict(self, include_latest_location: bool = False):
        data = {
            "id": self.id,
            "bus_id": self.bus_id,
            "driver_id": self.driver_id,
            "route_id": self.route_id,
            "status": self.status.value
            if isinstance(self.status, TripStatus)
            else self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
        }
        if include_latest_location:
            latest = (
                self.locations.order_by(TripLocation.recorded_at.desc()).first()
            )
            data["latest_location"] = latest.to_dict() if latest else None
        return data


class TripLocation(db.Model):
    __tablename__ = "trip_locations"

    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(
        db.Integer, db.ForeignKey("trips.id"), nullable=False, index=True
    )
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    speed_kmh = db.Column(db.Float, nullable=True, default=0.0)
    recorded_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    trip = db.relationship("Trip", back_populates="locations")

    def to_dict(self):
        return {
            "id": self.id,
            "trip_id": self.trip_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "speed_kmh": self.speed_kmh,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }
