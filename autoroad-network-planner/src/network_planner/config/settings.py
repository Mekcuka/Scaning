"""Centralized service configuration via environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8080, alias="APP_PORT", ge=1, le=65535)
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")
    geosteiner_bin_dir: str = Field(
        default="vendor/geosteiner/bin",
        alias="GEOSTEINER_BIN_DIR",
    )
    geosteiner_timeout_sec: float = Field(default=300.0, alias="GEOSTEINER_TIMEOUT_SEC", ge=1.0)
    require_steinerpy: bool = Field(default=True, alias="REQUIRE_STEINERPY")
    msys2_root: str = Field(default=r"C:\msys64", alias="MSYS2_ROOT")

    @field_validator("log_level")
    @classmethod
    def _normalize_log_level(cls, value: str) -> str:
        return value.upper()

    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [part.strip() for part in raw.split(",") if part.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
