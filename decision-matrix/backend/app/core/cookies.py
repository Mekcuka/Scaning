"""HTTP cookie helpers for JWT auth."""

import secrets

from fastapi import Response

from app.core.config import settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"

# Path "/" so cookies work through Vite dev proxy (localhost:5173/5174 → :8000)
ACCESS_PATH = "/"
REFRESH_PATH = "/"


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str,
    csrf_token: str | None = None,
) -> str:
    csrf = csrf_token or new_csrf_token()
    secure = settings.use_secure_cookies
    # Cross-origin frontend (e.g. GitHub Pages) must use SameSite=None with Secure.
    samesite: str = "none" if secure else "lax"
    response.headers["X-CSRF-Token"] = csrf
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path=ACCESS_PATH,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path=REFRESH_PATH,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf,
        httponly=False,
        secure=secure,
        samesite=samesite,
        path="/",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    return csrf


def clear_auth_cookies(response: Response) -> None:
    secure = settings.use_secure_cookies
    samesite: str = "none" if secure else "lax"
    response.headers.pop("X-CSRF-Token", None)
    for key, path in (
        (ACCESS_COOKIE, ACCESS_PATH),
        (REFRESH_COOKIE, REFRESH_PATH),
        (CSRF_COOKIE, "/"),
    ):
        response.delete_cookie(key=key, path=path, secure=secure, samesite=samesite)
