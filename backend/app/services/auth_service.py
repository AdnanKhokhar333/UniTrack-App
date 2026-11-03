from flask_jwt_extended import create_access_token

from app.models.user import User, UserRole
from app.utils.extensions import db


def authenticate(email: str, password: str) -> tuple[User | None, str | None]:
    """Return (user, error). Students/drivers must be approved before login."""
    user = User.query.filter_by(email=email.strip().lower()).first()
    if not user or not user.check_password(password):
        return None, "Invalid email or password"
    if not user.is_active:
        return None, "Account is deactivated"
    if user.role != UserRole.ADMIN and not user.is_approved:
        return None, "Account pending admin approval"
    return user, None


def issue_token(user: User) -> str:
    return create_access_token(
        identity=str(user.id),
        additional_claims={
            "role": user.role.value,
            "university_id": user.university_id,
            "email": user.email,
        },
    )


def create_user(
    *,
    university_id: int,
    email: str,
    password: str,
    role: UserRole,
    is_approved: bool = False,
) -> User:
    user = User(
        university_id=university_id,
        email=email.strip().lower(),
        role=role,
        is_approved=is_approved,
        is_active=True,
    )
    user.set_password(password)
    db.session.add(user)
    return user
