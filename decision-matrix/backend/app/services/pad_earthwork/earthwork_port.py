"""Port for pad earthwork compute."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from pad_earthwork.schemas import ComputeRequest, ComputeResponse


class PadEarthworkPort(Protocol):
    def compute(self, request: ComputeRequest) -> ComputeResponse: ...
