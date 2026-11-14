from datetime import datetime, timezone

from app.utils.extensions import db


class BusMaintenanceLog(db.Model):
    """Admin-entered maintenance / fuel notes (no IoT)."""

    __tablename__ = "bus_maintenance_logs"

    id = db.Column(db.Integer, primary_key=True)
    bus_id = db.Column(db.Integer, db.ForeignKey("buses.id"), nullable=False, index=True)
    note = db.Column(db.Text, nullable=False)
    liters_added = db.Column(db.Float, nullable=True)
    created_by_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True
    )
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    bus = db.relationship("Bus", backref=db.backref("maintenance_logs", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "bus_id": self.bus_id,
            "note": self.note,
            "liters_added": self.liters_added,
            "created_by_user_id": self.created_by_user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
