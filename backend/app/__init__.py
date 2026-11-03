from flask import Flask
from flask_cors import CORS

from config import Config


def create_app(config_class=Config):
    flask_app = Flask(__name__)
    flask_app.config.from_object(config_class)

    CORS(flask_app)

    from app.utils.extensions import db, jwt, socketio

    db.init_app(flask_app)
    jwt.init_app(flask_app)
    socketio.init_app(flask_app)

    # Register model metadata without shadowing the Flask instance name
    import importlib

    importlib.import_module("app.models")

    from app.blueprints.alerts import alerts_bp
    from app.blueprints.attendance import attendance_bp
    from app.blueprints.auth import auth_bp
    from app.blueprints.buses import buses_bp
    from app.blueprints.routes import routes_bp
    from app.blueprints.trips import trips_bp
    from app.blueprints.users import users_bp

    flask_app.register_blueprint(auth_bp)
    flask_app.register_blueprint(users_bp)
    flask_app.register_blueprint(buses_bp)
    flask_app.register_blueprint(routes_bp)
    flask_app.register_blueprint(attendance_bp)
    flask_app.register_blueprint(trips_bp)
    flask_app.register_blueprint(alerts_bp)

    @flask_app.get("/api/health")
    def health():
        return {"status": "ok", "service": "unitrack-api"}

    with flask_app.app_context():
        db.create_all()
        from app.services.seed import seed_defaults

        seed_defaults()

    return flask_app
