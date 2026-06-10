"""LLM client helpers."""

import pytest

from app.assistant.chat.errors import ChatError
from app.assistant.chat.llm_client import (
    _message_text,
    _parse_assistant_message,
    is_content_safety_verdict,
)


def test_is_content_safety_verdict_detects_moderation_labels():
    assert is_content_safety_verdict("User Safety: safe\nResponse Safety: safe")
    assert is_content_safety_verdict("User Safety: safe")
    assert not is_content_safety_verdict("Привет! У вас 3 проекта.")
    assert not is_content_safety_verdict("Модель написала User Safety: safe в тексте ответа.")


def test_message_text_rejects_safety_verdict():
    with pytest.raises(ChatError) as exc:
        _message_text({"content": "User Safety: safe\nResponse Safety: safe"})
    assert exc.value.code == "llm_safety_router"


def test_message_text_does_not_use_reasoning_as_answer():
    answer, reasoning = _parse_assistant_message(
        {
            "content": "",
            "reasoning_content": "Внутренний ход мыслей.",
        }
    )
    assert answer is None
    assert reasoning == "Внутренний ход мыслей."
    assert _message_text({"reasoning_content": "только reasoning"}) is None
