"""Local authentication API for the Campus Customs Vite app."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "data" / "campus_customs.db"
COOKIE_NAME = "campus_customs_session"
SESSION_TTL_SECONDS = 60 * 60 * 24
MAX_BODY_BYTES = 16_384
PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_LENGTH = 256
SCRYPT_N = 1 << 15
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_MAX_MEMORY = 128 * 1024 * 1024
LEGACY_PBKDF2_ROUNDS = (100_000, 120_000, 260_000, 600_000)
EMAIL_PATTERN = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
ALLOWED_ORIGIN_HOSTS = {"localhost", "127.0.0.1", "::1"}

sessions: dict[str, tuple[int, float]] = {}
login_failures: dict[str, list[float]] = {}
state_lock = threading.Lock()


def database_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout = 10000")
    return connection


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=64,
        maxmem=SCRYPT_MAX_MEMORY,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


DUMMY_PASSWORD_HASH = hash_password("campus-customs-invalid-account-check")


def verify_password(password: str, encoded: str) -> tuple[bool, bool]:
    """Return (valid, needs_rehash), supporting existing PBKDF2 rows for migration."""
    try:
        parts = encoded.split("$")
        if len(parts) == 6 and parts[0] == "scrypt":
            n, r, p = (int(parts[index]) for index in (1, 2, 3))
            salt = bytes.fromhex(parts[4])
            expected = bytes.fromhex(parts[5])
            if n not in (1 << 14, 1 << 15, 1 << 16) or r not in (8, 16) or p not in (1, 2, 3):
                return False, False
            if not 16 <= len(salt) <= 64 or not 32 <= len(expected) <= 64:
                return False, False
            actual = hashlib.scrypt(
                password.encode("utf-8"),
                salt=salt,
                n=n,
                r=r,
                p=p,
                dklen=len(expected),
                maxmem=SCRYPT_MAX_MEMORY,
            )
            return hmac.compare_digest(actual, expected), False

        if len(parts) == 3 and parts[0] == "pbkdf2_sha256":
            salt = parts[1].encode("utf-8")
            expected = bytes.fromhex(parts[2])
            for rounds in LEGACY_PBKDF2_ROUNDS:
                actual = hashlib.pbkdf2_hmac(
                    "sha256", password.encode("utf-8"), salt, rounds, dklen=len(expected)
                )
                if hmac.compare_digest(actual, expected):
                    return True, True
    except (ValueError, OverflowError, MemoryError):
        return False, False
    return False, False


def public_user(row: sqlite3.Row) -> dict[str, int | str]:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "first_name": row["first_name"] or "",
        "last_name": row["last_name"] or "",
    }


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with state_lock:
        sessions[token] = (user_id, time.time() + SESSION_TTL_SECONDS)
    return token


def session_cookie(token: str | None = None) -> str:
    if token is None:
        return f"{COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
    cookie = f"{COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL_SECONDS}"
    if os.environ.get("AUTH_COOKIE_SECURE") == "1":
        cookie += "; Secure"
    return cookie


class AuthHandler(BaseHTTPRequestHandler):
    server_version = "CampusCustomsAuth/1.0"

    def send_json(
        self,
        payload: dict[str, object],
        status: int = 200,
        cookie: str | None = None,
    ) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def origin_is_allowed(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return True
        host = urlsplit(origin).hostname
        return host in ALLOWED_ORIGIN_HOSTS

    def read_json(self) -> dict[str, object] | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json({"error": "Invalid request."}, 400)
            return None
        if length < 0 or length > MAX_BODY_BYTES:
            self.send_json({"error": "Request is too large."}, 413)
            return None
        if self.headers.get_content_type() != "application/json":
            self.send_json({"error": "Send account details as JSON."}, 415)
            return None
        try:
            payload = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json({"error": "Invalid request."}, 400)
            return None
        if not isinstance(payload, dict):
            self.send_json({"error": "Invalid request."}, 400)
            return None
        return payload

    def client_session(self) -> tuple[str | None, int | None]:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return None, None
        morsel = cookie.get(COOKIE_NAME)
        if morsel is None:
            return None, None
        token = morsel.value
        with state_lock:
            session = sessions.get(token)
            if session is None:
                return token, None
            user_id, expires_at = session
            if expires_at < time.time():
                sessions.pop(token, None)
                return token, None
        return token, user_id

    def login_is_limited(self) -> bool:
        now = time.time()
        address = self.client_address[0]
        with state_lock:
            recent = [stamp for stamp in login_failures.get(address, []) if now - stamp < 900]
            login_failures[address] = recent
            return len(recent) >= 10

    def record_login_failure(self, failed: bool) -> None:
        address = self.client_address[0]
        now = time.time()
        with state_lock:
            if failed:
                login_failures.setdefault(address, []).append(now)
            else:
                login_failures.pop(address, None)

    def do_GET(self) -> None:
        if urlsplit(self.path).path != "/api/auth/me":
            self.send_json({"error": "Not found."}, 404)
            return
        token, user_id = self.client_session()
        if user_id is None:
            self.send_json(
                {"error": "Not signed in."},
                401,
                session_cookie() if token is not None else None,
            )
            return
        try:
            with database_connection() as connection:
                row = connection.execute(
                    "SELECT id, name, email, first_name, last_name FROM users WHERE id = ?",
                    (user_id,),
                ).fetchone()
        except sqlite3.Error:
            self.send_json({"error": "Could not read the account."}, 500)
            return
        if row is None:
            self.send_json({"error": "Not signed in."}, 401, session_cookie())
            return
        self.send_json({"user": public_user(row)})

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        if not self.origin_is_allowed():
            self.send_json({"error": "Request origin is not allowed."}, 403)
            return

        if path == "/api/auth/logout":
            token, _ = self.client_session()
            if token is not None:
                with state_lock:
                    sessions.pop(token, None)
            self.send_json({"ok": True}, cookie=session_cookie())
            return

        if path not in ("/api/auth/login", "/api/auth/register"):
            self.send_json({"error": "Not found."}, 404)
            return

        payload = self.read_json()
        if payload is None:
            return
        if path == "/api/auth/login":
            self.handle_login(payload)
        else:
            self.handle_registration(payload)

    def handle_login(self, payload: dict[str, object]) -> None:
        if self.login_is_limited():
            self.send_json({"error": "Too many attempts. Please wait a few minutes and try again."}, 429)
            return
        email = payload.get("email")
        password = payload.get("password")
        if not isinstance(email, str) or not isinstance(password, str):
            self.send_json({"error": "Enter your email and password."}, 400)
            return
        normalized_email = email.strip().lower()
        if not EMAIL_PATTERN.fullmatch(normalized_email) or len(password) > PASSWORD_MAX_LENGTH:
            self.record_login_failure(True)
            self.send_json({"error": "Invalid email or password."}, 401)
            return

        try:
            with database_connection() as connection:
                row = connection.execute(
                    "SELECT id, name, email, first_name, last_name, password_hash FROM users WHERE lower(email) = ?",
                    (normalized_email,),
                ).fetchone()
                if row is None:
                    verify_password(password, DUMMY_PASSWORD_HASH)
                    self.record_login_failure(True)
                    self.send_json({"error": "Invalid email or password."}, 401)
                    return

                valid, needs_rehash = verify_password(password, row["password_hash"])
                if not valid:
                    self.record_login_failure(True)
                    self.send_json({"error": "Invalid email or password."}, 401)
                    return

                if needs_rehash:
                    connection.execute(
                        "UPDATE users SET password_hash = ? WHERE id = ?",
                        (hash_password(password), row["id"]),
                    )
                connection.commit()
                user = public_user(row)
        except sqlite3.Error:
            self.send_json({"error": "Could not sign in right now."}, 500)
            return

        self.record_login_failure(False)
        token = create_session(user["id"])
        self.send_json({"user": user}, cookie=session_cookie(token))

    def handle_registration(self, payload: dict[str, object]) -> None:
        first_name = payload.get("firstName")
        last_name = payload.get("lastName")
        email = payload.get("email")
        password = payload.get("password")
        confirm_password = payload.get("confirmPassword")
        if not all(isinstance(value, str) for value in (first_name, last_name, email, password, confirm_password)):
            self.send_json({"error": "Complete all account fields."}, 400)
            return

        first_name = first_name.strip()
        last_name = last_name.strip()
        normalized_email = email.strip().lower()
        if not first_name or not last_name or len(first_name) > 80 or len(last_name) > 80:
            self.send_json({"error": "Enter a first and last name (80 characters or fewer each)."}, 400)
            return
        if len(normalized_email) > 254 or not EMAIL_PATTERN.fullmatch(normalized_email):
            self.send_json({"error": "Enter a valid email address."}, 400)
            return
        if len(password) < PASSWORD_MIN_LENGTH:
            self.send_json({"error": f"Use a password with at least {PASSWORD_MIN_LENGTH} characters."}, 400)
            return
        if len(password) > PASSWORD_MAX_LENGTH or len(password.encode("utf-8")) > 1024:
            self.send_json({"error": "Use a password with 256 characters or fewer."}, 400)
            return
        if password != confirm_password:
            self.send_json({"error": "The passwords do not match."}, 400)
            return

        name = f"{first_name} {last_name}"
        try:
            with database_connection() as connection:
                existing = connection.execute(
                    "SELECT 1 FROM users WHERE lower(email) = ? LIMIT 1",
                    (normalized_email,),
                ).fetchone()
                if existing is not None:
                    self.send_json({"error": "An account with this email already exists."}, 409)
                    return
                password_hash = hash_password(password)
                cursor = connection.execute(
                    "INSERT INTO users (name, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
                    (name, normalized_email, password_hash, first_name, last_name),
                )
                user_id = cursor.lastrowid
                connection.commit()
                row = connection.execute(
                    "SELECT id, name, email, first_name, last_name FROM users WHERE id = ?",
                    (user_id,),
                ).fetchone()
        except sqlite3.IntegrityError:
            self.send_json({"error": "An account with this email already exists."}, 409)
            return
        except sqlite3.Error:
            self.send_json({"error": "Could not create the account right now."}, 500)
            return

        if row is None:
            self.send_json({"error": "Could not create the account right now."}, 500)
            return
        user = public_user(row)
        token = create_session(user["id"])
        self.send_json({"user": user}, 201, session_cookie(token))


def main() -> None:
    port = int(os.environ.get("AUTH_PORT", "8001"))
    server = ThreadingHTTPServer(("127.0.0.1", port), AuthHandler)
    server.daemon_threads = True
    print(f"Campus Customs auth API listening on 127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
