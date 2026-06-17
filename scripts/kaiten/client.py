"""Minimal Kaiten REST client (stdlib only)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


class KaitenError(RuntimeError):
    def __init__(self, message: str, *, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class KaitenClient:
    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    @classmethod
    def from_env(cls, config: dict[str, Any]) -> KaitenClient:
        token = os.environ.get("KAITEN_API_TOKEN", "").strip()
        if not token:
            raise KaitenError(
                "KAITEN_API_TOKEN не задан. См. scripts/setup-kaiten.ps1 или .env"
            )
        base_url = os.environ.get(
            "KAITEN_BASE_URL", str(config.get("base_url", ""))
        ).strip()
        if not base_url:
            raise KaitenError("KAITEN_BASE_URL не задан в .env или kaiten.config.json")
        return cls(base_url=base_url, token=token)

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        data = None
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.token}",
        }
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read().decode("utf-8")
                if not raw.strip():
                    return None
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            message = detail
            try:
                payload = json.loads(detail)
                message = str(payload.get("message") or payload)
            except json.JSONDecodeError:
                pass
            raise KaitenError(message or exc.reason, status=exc.code) from exc

    def get_board(self, board_id: int) -> dict[str, Any]:
        result = self._request("GET", f"/boards/{board_id}")
        assert isinstance(result, dict)
        return result

    def get_card(self, card_id: int) -> dict[str, Any]:
        result = self._request("GET", f"/cards/{card_id}")
        assert isinstance(result, dict)
        return result

    def create_card(
        self,
        *,
        title: str,
        board_id: int,
        column_id: int,
        lane_id: int,
        description: str | None = None,
        external_id: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "title": title,
            "board_id": board_id,
            "column_id": column_id,
            "lane_id": lane_id,
        }
        if description:
            payload["description"] = description
        if external_id:
            payload["external_id"] = external_id
        result = self._request("POST", "/cards", body=payload)
        assert isinstance(result, dict)
        return result

    def update_card(
        self,
        card_id: int,
        *,
        column_id: int | None = None,
        title: str | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if column_id is not None:
            payload["column_id"] = column_id
        if title is not None:
            payload["title"] = title
        if description is not None:
            payload["description"] = description
        result = self._request("PATCH", f"/cards/{card_id}", body=payload)
        assert isinstance(result, dict)
        return result

    def add_comment(self, card_id: int, text: str) -> dict[str, Any]:
        result = self._request(
            "POST",
            f"/cards/{card_id}/comments",
            body={"text": text},
        )
        assert isinstance(result, dict)
        return result
