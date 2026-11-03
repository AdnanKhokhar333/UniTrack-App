import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=12)

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///unitrack.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SPEEDING_THRESHOLD_KMH = float(os.getenv("SPEEDING_THRESHOLD_KMH", "70"))

    UNIVERSITY_NAME = os.getenv("UNIVERSITY_NAME", "Demo University")
    UNIVERSITY_CODE = os.getenv("UNIVERSITY_CODE", "DEMO")

    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@university.edu")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@12345")
