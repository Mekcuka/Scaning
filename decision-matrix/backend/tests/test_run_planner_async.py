"""Tests for CPU-bound planner async wrappers (phase 3a)."""

import asyncio

import pytest

from app.services.well_trajectory.api_common import run_planner_async


@pytest.mark.asyncio
async def test_run_planner_async_returns_result():
    """run_planner_async should forward args and return the result."""

    def add(a: int, b: int) -> int:
        return a + b

    result = await run_planner_async(add, 2, 3)
    assert result == 5


@pytest.mark.asyncio
async def test_run_planner_async_runs_in_worker_thread():
    """run_planner_async must offload to a thread (not block the event loop)."""
    main_thread = asyncio.get_running_loop().run_in_executor.__self__

    def get_thread_id():
        import threading

        return threading.get_ident()

    worker_id = await run_planner_async(get_thread_id)
    # The worker thread id must differ from the main thread running the loop.
    assert worker_id != threading_main_id()


def threading_main_id() -> int:
    import threading

    return threading.main_thread().ident


@pytest.mark.asyncio
async def test_run_planner_async_maps_runtime_error_to_http_503():
    """RuntimeError from planner should surface as HTTPException(503)."""
    from fastapi import HTTPException

    def boom():
        raise RuntimeError("well-trajectory-planner not installed")

    with pytest.raises(HTTPException) as exc_info:
        await run_planner_async(boom)
    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_run_planner_async_propagates_non_runtime_errors():
    """Non-RuntimeError exceptions should propagate unchanged (not converted)."""

    def boom():
        raise ValueError("bad input")

    with pytest.raises(ValueError, match="bad input"):
        await run_planner_async(boom)
