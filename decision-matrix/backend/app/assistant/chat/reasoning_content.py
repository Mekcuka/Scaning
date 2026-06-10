"""Split model chain-of-thought from user-visible answer text."""

from __future__ import annotations

import re
from typing import Literal

# Qwen / DeepSeek style: ...
_THINK_BLOCK = re.compile(
    r"<\s*think\s*>(.*?)<\s*/\s*think\s*>",
    re.DOTALL | re.IGNORECASE,
)
_REASONING_BLOCK = re.compile(
    r"<reasoning>(.*?)</reasoning>",
    re.DOTALL | re.IGNORECASE,
)
_REDACTED_BLOCK = re.compile(
    r"<\s*redacted_reasoning\s*>(.*?)<\s*/\s*redacted_reasoning\s*>",
    re.DOTALL | re.IGNORECASE,
)
_THINK_OPEN_RE = re.compile(r"<\s*think\s*>", re.IGNORECASE)
_THINK_CLOSE_RE = re.compile(r"<\s*/\s*think\s*>", re.IGNORECASE)

StreamKind = Literal["answer", "reasoning"]


def split_reasoning_answer(text: str) -> tuple[str | None, str | None]:
    """Extract think/reasoning blocks and return (reasoning, answer)."""
    if not text or not text.strip():
        return None, None

    reasoning_parts: list[str] = []
    answer = text

    for pattern in (_THINK_BLOCK, _REASONING_BLOCK, _REDACTED_BLOCK):
        for match in pattern.finditer(answer):
            chunk = match.group(1).strip()
            if chunk:
                reasoning_parts.append(chunk)
        answer = pattern.sub("", answer)

    reasoning = "\n\n".join(reasoning_parts).strip() or None
    answer_clean = answer.strip() or None
    return reasoning, answer_clean


def merge_reasoning_text(*parts: str | None) -> str | None:
    merged = "\n\n".join(p.strip() for p in parts if p and p.strip()).strip()
    return merged or None


class ReasoningStreamSplitter:
    """Incremental splitter for streamed content that may contain think blocks."""

    def __init__(self) -> None:
        self._pending = ""
        self._in_think = False

    def feed_chunk(
        self,
        *,
        content: str = "",
        reasoning: str = "",
    ) -> list[tuple[StreamKind, str]]:
        out: list[tuple[StreamKind, str]] = []
        if reasoning:
            out.append(("reasoning", reasoning))
        if content:
            out.extend(self._feed_content(content))
        return out

    def _feed_content(self, chunk: str) -> list[tuple[StreamKind, str]]:
        self._pending += chunk
        out: list[tuple[StreamKind, str]] = []

        while self._pending:
            if self._in_think:
                close = _THINK_CLOSE_RE.search(self._pending)
                if not close:
                    hold = 12
                    emit_len = max(0, len(self._pending) - hold)
                    if emit_len:
                        out.append(("reasoning", self._pending[:emit_len]))
                        self._pending = self._pending[emit_len:]
                    break
                segment = self._pending[: close.start()]
                if segment:
                    out.append(("reasoning", segment))
                self._pending = self._pending[close.end() :]
                self._in_think = False
                continue

            open_m = _THINK_OPEN_RE.search(self._pending)
            if not open_m:
                hold = 8
                emit_len = max(0, len(self._pending) - hold)
                if emit_len:
                    out.append(("answer", self._pending[:emit_len]))
                    self._pending = self._pending[emit_len:]
                break
            if open_m.start() > 0:
                out.append(("answer", self._pending[: open_m.start()]))
                self._pending = self._pending[open_m.start() :]
            open_m = _THINK_OPEN_RE.match(self._pending)
            if open_m:
                self._pending = self._pending[open_m.end() :]
                self._in_think = True
            else:
                break

        return out

    def flush(self) -> list[tuple[StreamKind, str]]:
        if not self._pending:
            return []
        kind: StreamKind = "reasoning" if self._in_think else "answer"
        out = [(kind, self._pending)]
        self._pending = ""
        self._in_think = False
        return out
