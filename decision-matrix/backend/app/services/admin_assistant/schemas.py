"""Admin assistant API schemas."""

from pydantic import BaseModel, Field


class AssistantLlmConfigUpdate(BaseModel):
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None
    max_tokens: int | None = None
    timeout_seconds: int | None = None
    embedding_base_url: str | None = None
    embedding_api_key: str | None = None
    embedding_model: str | None = None


class AssistantLlmEffectiveConfig(BaseModel):
    base_url: str | None = None
    model: str | None = None
    api_key_masked: str | None = None
    api_key_source: str = "none"
    max_tokens: int
    timeout_seconds: int


class AssistantLlmEmbeddingEffectiveConfig(BaseModel):
    base_url: str | None = None
    model: str | None = None
    api_key_masked: str | None = None
    uses_chat_config: bool = True


class AssistantLlmEnvConfig(BaseModel):
    base_url: str | None = None
    model: str | None = None
    max_tokens: int
    timeout_seconds: int
    api_key_configured: bool
    embedding_base_url: str | None = None
    embedding_model: str | None = None
    embedding_api_key_configured: bool = False


class AssistantLlmProbeSlice(BaseModel):
    ok: bool = False
    http_status: int | None = None
    hint_ru: str = ""


class AssistantLlmWikiRagStatus(BaseModel):
    enabled: bool = False
    embedding_ready: bool | None = None
    rag_mode: str | None = None
    embedding_model: str | None = None


class AssistantLlmConfigDetailResponse(BaseModel):
    provider_ready: bool = False
    chat_enabled: bool = False
    effective: AssistantLlmEffectiveConfig
    embedding_effective: AssistantLlmEmbeddingEffectiveConfig
    env: AssistantLlmEnvConfig
    runtime_override: dict[str, str | None] = Field(default_factory=dict)
    wiki_rag: AssistantLlmWikiRagStatus = Field(default_factory=AssistantLlmWikiRagStatus)
    probe_detail: dict[str, object] | None = None


class AssistantLlmConfigResponse(BaseModel):
    applied: dict[str, str | None] = Field(default_factory=dict)


class AssistantLlmProbeResponse(BaseModel):
    chat: dict[str, object]
    embeddings: AssistantLlmProbeSlice
    rag_mode: str
    provider_ready: bool


class AssistantLlmTestResponse(BaseModel):
    ok: bool
    latency_ms: int | None = None
    model: str | None = None
    reply: str | None = None
    error: str | None = None


class AssistantLlmModelsResponse(BaseModel):
    models: list[str] = Field(default_factory=list)
