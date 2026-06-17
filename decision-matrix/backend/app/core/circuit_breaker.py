"""Per-microservice circuit breakers (in-memory, per worker process)."""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable
from typing import TypeVar

from app.core.config import settings
from app.core.microservice_errors import MicroserviceError, MicroserviceUnavailableError

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitBreaker:
    """Minimal async circuit breaker: CLOSED → OPEN → HALF-OPEN."""

    def __init__(self, *, name: str) -> None:
        self.name = name
        self._failure_threshold = settings.MICROSERVICE_CIRCUIT_FAILURE_THRESHOLD
        self._reset_timeout = settings.MICROSERVICE_CIRCUIT_RESET_TIMEOUT_SECONDS
        self._failures = 0
        self._opened_at: float | None = None
        self._half_open = False

    @property
    def state(self) -> str:
        if self._opened_at is None:
            return "closed"
        if self._half_open:
            return "half_open"
        if time.monotonic() - self._opened_at >= self._reset_timeout:
            return "half_open"
        return "open"

    def _maybe_half_open(self) -> None:
        if self._opened_at is not None and time.monotonic() - self._opened_at >= self._reset_timeout:
            self._half_open = True

    def _record_success(self) -> None:
        self._failures = 0
        self._opened_at = None
        self._half_open = False

    def _record_failure(self) -> None:
        self._failures += 1
        if self._failures >= self._failure_threshold or self._half_open:
            if self._opened_at is None:
                logger.warning("circuit_opened microservice=%s failures=%s", self.name, self._failures)
            self._opened_at = time.monotonic()
            self._half_open = False

    async def call(self, fn: Callable[[], Awaitable[T]]) -> T:
        self._maybe_half_open()
        st = self.state
        if st == "open":
            raise MicroserviceUnavailableError(service_name=self.name)
        try:
            result = await fn()
        except MicroserviceError:
            self._record_failure()
            raise
        except Exception as exc:
            self._record_failure()
            raise exc
        self._record_success()
        return result


autoroad_breaker = CircuitBreaker(name="autoroad-network")
well_trajectory_breaker = CircuitBreaker(name="well-trajectory")
pad_earthwork_breaker = CircuitBreaker(name="pad-earthwork")
