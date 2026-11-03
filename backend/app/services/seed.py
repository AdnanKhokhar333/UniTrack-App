from flask import current_app

from app.models.university import University
from app.models.user import User, UserRole
from app.services.auth_service import create_user
from app.utils.extensions import db


def seed_defaults() -> None:
    """Ensure single university + system admin exist (idempotent)."""
    code = current_app.config["UNIVERSITY_CODE"]
    uni = University.query.filter_by(code=code).first()
    if not uni:
        uni = University(
            name=current_app.config["UNIVERSITY_NAME"],
            code=code,
            is_active=True,
        )
        db.session.add(uni)
        db.session.flush()

    admin_email = current_app.config["ADMIN_EMAIL"].strip().lower()
    if not User.query.filter_by(email=admin_email).first():
        create_user(
            university_id=uni.id,
            email=admin_email,
            password=current_app.config["ADMIN_PASSWORD"],
            role=UserRole.ADMIN,
            is_approved=True,
        )

    db.session.commit()
