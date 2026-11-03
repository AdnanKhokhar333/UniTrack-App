from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
jwt = JWTManager()
# threading mode — avoids eventlet (incompatible with newer Python on Windows)
socketio = SocketIO(cors_allowed_origins="*", async_mode="threading")
