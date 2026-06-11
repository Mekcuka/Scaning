import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, verify_csrf
from app.core.config import settings
from app.core.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from app.core.database import get_db
from app.core.rate_limit import get_client_ip, limiter
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models import User
from app.models.enums import UserRole
from app.schemas import (
    AuthMessageResponse,
    AuthSessionResponse,
    RefreshTokenBody,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services.auth_tokens import issue_refresh_token, revoke_refresh_token, rotate_refresh_token

auth_router = APIRouter(prefix="/auth", tags=["auth"])


def _validate_password(password: str) -> str:
    if len(password) < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Пароль: не менее 8 символов, буква и цифра",
        )
    return password


async def _issue_session(user: User, db: AsyncSession, response: Response) -> AuthSessionResponse:
    access = create_access_token(str(user.id), role=user.role)
    refresh = await issue_refresh_token(db, user.id)
    await db.commit()
    set_auth_cookies(response, access_token=access, refresh_token=refresh)
    base = UserResponse.model_validate(user)
    return AuthSessionResponse(
        **base.model_dump(),
        access_token=access,
        refresh_token=refresh,
    )


@auth_router.post("/register", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.AUTH_RATE_LIMIT, key_func=get_client_ip)
async def register(
    request: Request,
    data: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    if not settings.ALLOW_REGISTRATION:
        raise HTTPException(status_code=403, detail="Регистрация отключена")
    _validate_password(data.password)
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    user = User(
        email=data.email,
        username=data.username,
        password_hash=get_password_hash(data.password),
        role=UserRole.analyst.value,
    )
    db.add(user)
    await db.flush()
    return await _issue_session(user, db, response)


@auth_router.post("/login", response_model=AuthSessionResponse)
@limiter.limit(settings.AUTH_RATE_LIMIT, key_func=get_client_ip)
async def login(
    request: Request,
    data: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Учётная запись отключена")
    user.last_login_at = datetime.now(timezone.utc)
    return await _issue_session(user, db, response)


@auth_router.post("/refresh", response_model=AuthSessionResponse)
async def refresh_session(
    request: Request,
    response: Response,
    data: RefreshTokenBody | None = None,
    db: AsyncSession = Depends(get_db),
):
    raw_refresh = request.cookies.get(REFRESH_COOKIE)
    if not raw_refresh and data and data.refresh_token:
        raw_refresh = data.refresh_token
    if not raw_refresh:
        raise HTTPException(status_code=401, detail="Сессия не найдена. Войдите снова")
    rotated = await rotate_refresh_token(db, raw_refresh)
    if not rotated:
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Сессия истекла. Войдите снова")
    user, new_refresh = rotated
    access = create_access_token(str(user.id), role=user.role)
    await db.commit()
    set_auth_cookies(response, access_token=access, refresh_token=new_refresh)
    base = UserResponse.model_validate(user)
    return AuthSessionResponse(
        **base.model_dump(),
        access_token=access,
        refresh_token=new_refresh,
    )


@auth_router.post("/logout", response_model=AuthMessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_csrf),
):
    raw_refresh = request.cookies.get(REFRESH_COOKIE)
    if raw_refresh:
        await revoke_refresh_token(db, raw_refresh)
        await db.commit()
    clear_auth_cookies(response)
    return AuthMessageResponse(message="Вы вышли из системы")


@auth_router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user
