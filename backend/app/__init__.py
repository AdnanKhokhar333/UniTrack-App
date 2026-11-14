from flask import Flask
from flask_cors import CORS

from config import Config


def create_app(config_class=Config):
    flask_app = Flask(__name__)
    flask_app.config.from_object(config_class)

    # Allow all origins so USB adb-reverse (localhost) and LAN clients both work
    CORS(flask_app, resources={r"/*": {"origins": "*"}})

    from app.utils.extensions import db, jwt, socketio

    db.init_app(flask_app)
    jwt.init_app(flask_app)
    socketio.init_app(flask_app)

    # Register model metadata without shadowing the Flask instance name
    import importlib

    importlib.import_module("app.models")

    from app.sockets import register_socket_handlers

    register_socket_handlers()

    from app.blueprints.alerts import alerts_bp
    from app.blueprints.attendance import attendance_bp
    from app.blueprints.auth import auth_bp
    from app.blueprints.buses import buses_bp
    from app.blueprints.complaints import complaints_bp
    from app.blueprints.maintenance import maintenance_bp
    from app.blueprints.ratings import ratings_bp
    from app.blueprints.routes import routes_bp
    from app.blueprints.students import students_bp
    from app.blueprints.trips import trips_bp
    from app.blueprints.users import users_bp

    flask_app.register_blueprint(auth_bp)
    flask_app.register_blueprint(users_bp)
    flask_app.register_blueprint(students_bp)
    flask_app.register_blueprint(buses_bp)
    flask_app.register_blueprint(routes_bp)
    flask_app.register_blueprint(attendance_bp)
    flask_app.register_blueprint(trips_bp)
    flask_app.register_blueprint(alerts_bp)
    flask_app.register_blueprint(ratings_bp)
    flask_app.register_blueprint(complaints_bp)
    flask_app.register_blueprint(maintenance_bp)

    @flask_app.get("/api/health")
    def health():
        return {"status": "ok", "service": "unitrack-api"}

    with flask_app.app_context():
        db.create_all()
        from app.services.seed import seed_defaults

        seed_defaults()

    return flask_app
