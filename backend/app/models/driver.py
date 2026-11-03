from datetime import datetime, timezone

from app.utils.extensions import db


class DriverProfile(db.Model):
    __tablename__ = "driver_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )
    bus_id = db.Column(db.Integer, db.ForeignKey("buses.id"), unique=True, nullable=True)
    full_name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(30), nullable=True)
    license_number = db.Column(db.String(100), nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = db.relationship("User", back_populates="driver_profile")
    bus = db.relationship("Bus", back_populates="driver_profile")
    trips = db.relationship("Trip", back_populates="driver", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "bus_id": self.bus_id,
            "full_name": self.full_name,
            "phone": self.phone,
            "license_number": self.license_number,
            "email": self.user.email if self.user else None,
        }
