"""Reasoning / think-block splitting for assistant chat."""

from app.assistant.chat.llm_client import _parse_assistant_message
from app.assistant.chat.reasoning_content import (
    ReasoningStreamSplitter,
    merge_reasoning_text,
    split_reasoning_answer,
)

_THINK_OPEN = "<" + "think" + ">"
_THINK_CLOSE = "</" + "think" + ">"


def test_split_reasoning_answer_think_tags():
    text = f"Сначала {_THINK_OPEN}посчитаю проекты.{_THINK_CLOSE} В системе 3 проекта."
    reasoning, answer = split_reasoning_answer(text)
    assert reasoning is not None
    assert "посчитаю" in reasoning
    assert answer == "Сначала  В системе 3 проекта."


def test_parse_assistant_message_keeps_reasoning_separate():
    answer, reasoning = _parse_assistant_message(
        {
            "content": "Итоговый ответ.",
            "reasoning_content": "Шаг 1: запросить список.",
        }
    )
    assert answer == "Итоговый ответ."
    assert reasoning is not None
    assert "Шаг 1" in reasoning


def test_parse_assistant_message_splits_embedded_think():
    inner = "внутренние рассуждения"
    text = f"Преамбула {_THINK_OPEN}{inner}{_THINK_CLOSE} Финал."
    answer, reasoning = _parse_assistant_message({"content": text})
    assert inner in (reasoning or "")
    assert "Финал" in (answer or "")


def test_reasoning_stream_splitter_incremental():
    splitter = ReasoningStreamSplitter()
    parts: list[tuple[str, str]] = []
    for chunk in (_THINK_OPEN, "думаю", _THINK_CLOSE, "ответ"):
        parts.extend(splitter.feed_chunk(content=chunk))
    parts.extend(splitter.flush())
    kinds = [k for k, _ in parts]
    assert "reasoning" in kinds
    assert "answer" in kinds
    assert "".join(v for k, v in parts if k == "answer") == "ответ"


def test_merge_reasoning_text():
    assert merge_reasoning_text("a", None, "b") == "a\n\nb"


def test_history_message_for_llm_strips_think_blocks():
    from app.assistant.chat.orchestrator import _history_message_for_llm
    from app.assistant.chat.schemas import ChatMessage

    msg = ChatMessage(
        role="assistant",
        content=f"Преамбула {_THINK_OPEN}скрытое{_THINK_CLOSE} Итог.",
    )
    item = _history_message_for_llm(msg)
    assert item is not None
    assert "скрытое" not in item["content"]
    assert "Итог" in item["content"]
