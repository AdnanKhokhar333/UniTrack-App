from datetime import datetime, timezone

from app.utils.extensions import db


class University(db.Model):
    """Tenant root — Phase 1 seeds a single university; multi-tenant later."""

    __tablename__ = "universities"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    users = db.relationship("User", back_populates="university", lazy="dynamic")
    buses = db.relationship("Bus", back_populates="university", lazy="dynamic")
    routes = db.relationship("Route", back_populates="university", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "is_active": self.is_active,
        }
