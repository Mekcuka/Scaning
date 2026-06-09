# Phase 3: in-process assistant chat

Add `POST /api/v1/assistant/chat` that orchestrates an LLM and calls `execute_tool()` from
[`registry.py`](../registry.py) directly (no MCP wire protocol).
