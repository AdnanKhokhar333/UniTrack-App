from datetime import datetime, timezone

from app.utils.extensions import db


class Route(db.Model):
    __tablename__ = "routes"

    id = db.Column(db.Integer, primary_key=True)
    university_id = db.Column(
        db.Integer, db.ForeignKey("universities.id"), nullable=False, index=True
    )
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    university = db.relationship("University", back_populates="routes")
    stops = db.relationship(
        "Stop",
        back_populates="route",
        order_by="Stop.sequence_order",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    students = db.relationship("StudentProfile", back_populates="active_route")
    trips = db.relationship("Trip", back_populates="route", lazy="dynamic")

    __table_args__ = (
        db.UniqueConstraint("university_id", "name", name="uq_route_name_per_uni"),
    )

    def to_dict(self, include_stops: bool = True):
        data = {
            "id": self.id,
            "university_id": self.university_id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
        }
        if include_stops:
            data["stops"] = [s.to_dict() for s in self.stops]
        return data


class Stop(db.Model):
    __tablename__ = "stops"

    id = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(
        db.Integer, db.ForeignKey("routes.id"), nullable=False, index=True
    )
    name = db.Column(db.String(150), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    sequence_order = db.Column(db.Integer, nullable=False, default=0)

    route = db.relationship("Route", back_populates="stops")
    students = db.relationship("StudentProfile", back_populates="stop")

    __table_args__ = (
        db.UniqueConstraint(
            "route_id", "sequence_order", name="uq_stop_sequence_per_route"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "route_id": self.route_id,
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "sequence_order": self.sequence_order,
        }
