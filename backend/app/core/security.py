import random
import re
import secrets
import string

import bcrypt

PASSWORD_POLICY_MESSAGE = (
    "Password must have at least 12 characters, 1 uppercase, 1 lowercase, 1 digit and 1 special character."
)

_SPECIAL = "!@#$%^&*()-_=+[]{}<>?"


def validate_password_policy(password: str) -> bool:
    if len(password) < 12:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"[0-9]", password):
        return False
    if not re.search(r"[^A-Za-z0-9]", password):
        return False
    return True


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def generate_temporary_password(length: int = 16) -> str:
    final_length = max(length, 12)
    alphabet = string.ascii_letters + string.digits + _SPECIAL

    while True:
        chars = [
            secrets.choice(string.ascii_uppercase),
            secrets.choice(string.ascii_lowercase),
            secrets.choice(string.digits),
            secrets.choice(_SPECIAL),
        ]
        chars.extend(secrets.choice(alphabet) for _ in range(final_length - 4))
        random.SystemRandom().shuffle(chars)
        candidate = "".join(chars)
        if validate_password_policy(candidate):
            return candidate
