"""Tool execution errors for LLM-facing responses."""

from __future__ import annotations

from fastapi import HTTPException


class ToolError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def http_status_to_code(status: int) -> str:
    if status == 404:
        return "not_found"
    if status == 403:
        return "forbidden"
    if status == 409:
        return "conflict"
    if status == 400:
        return "validation"
    if status == 401:
        return "unauthorized"
    return "error"


def tool_error_from_http(exc: HTTPException) -> ToolError:
    detail = exc.detail
    if isinstance(detail, dict):
        message = str(detail.get("message") or detail)
    else:
        message = str(detail)
    return ToolError(http_status_to_code(exc.status_code), message)
