from datetime import datetime, timedelta
from jose import jwt

SECRET_KEY = "CHANGE_THIS_LATER"
ALGORITHM = "HS256"


def create_access_token(email: str):
    payload = {
        "sub": email,
        "exp": datetime.utcnow() + timedelta(hours=8)
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )