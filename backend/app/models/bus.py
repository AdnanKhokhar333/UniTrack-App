from datetime import datetime, timezone

from app.utils.extensions import db


class Bus(db.Model):
    __tablename__ = "buses"

    id = db.Column(db.Integer, primary_key=True)
    university_id = db.Column(
        db.Integer, db.ForeignKey("universities.id"), nullable=False, index=True
    )
    bus_number = db.Column(db.String(50), nullable=False)
    registration = db.Column(db.String(100), nullable=False)
    capacity = db.Column(db.Integer, nullable=False, default=40)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    university = db.relationship("University", back_populates="buses")
    driver_profile = db.relationship(
        "DriverProfile", back_populates="bus", uselist=False
    )
    trips = db.relationship("Trip", back_populates="bus", lazy="dynamic")

    __table_args__ = (
        db.UniqueConstraint(
            "university_id", "bus_number", name="uq_bus_number_per_uni"
        ),
        db.UniqueConstraint(
            "university_id", "registration", name="uq_registration_per_uni"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "university_id": self.university_id,
            "bus_number": self.bus_number,
            "registration": self.registration,
            "capacity": self.capacity,
            "is_active": self.is_active,
        }
