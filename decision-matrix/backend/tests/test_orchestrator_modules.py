"""Smoke tests for assistant chat orchestrator package (SOLID phase 7)."""

from __future__ import annotations

import importlib


def test_orchestrator_modules_import():
    modules = [
        "app.assistant.chat.events",
        "app.assistant.chat.prompt",
        "app.assistant.chat.message_history",
        "app.assistant.chat.tool_payload",
        "app.assistant.chat.tool_loop",
        "app.assistant.chat.ports.llm_port",
        "app.assistant.ports.tool_registry_port",
        "app.assistant.chat.orchestrator",
    ]
    for name in modules:
        mod = importlib.import_module(name)
        assert mod is not None


def test_orchestrator_barrel_reexports():
    from app.assistant.chat import orchestrator

    assert orchestrator.run_chat is not None
    assert orchestrator.run_chat_stream is not None
    assert orchestrator._user_wants_data is not None
    assert orchestrator._compact_tool_payload_for_llm is not None
