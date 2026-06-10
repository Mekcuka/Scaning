export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
  reasoning?: string | null;
};

export type AssistantMessage = ChatMessage & {
  tools?: ToolCallSummary[];
};

export type ToolCallSummary = {
  name: string;
  ok: boolean;
  code?: string | null;
};

export type PendingAction = {
  action_id: string;
  tool: string;
  arguments: Record<string, unknown>;
  description: string;
};

export type ChatResponse = {
  message: ChatMessage;
  tool_calls_made: ToolCallSummary[];
  pending_action: PendingAction | null;
  session_id?: string | null;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export type AssistantStatus = {
  enabled: boolean;
  model: string | null;
  provider_ready: boolean;
  base_url: string | null;
  mcp_url?: string | null;
  mcp_token_ttl_minutes?: number | null;
  mcp_setup_hint_ru?: string | null;
  llm_override?: Record<string, string> | null;
  chat_history_enabled?: boolean | null;
};

export type ChatRequest = {
  messages: ChatMessage[];
  project_id?: string | null;
  project_name?: string | null;
  selected_poi_id?: string | null;
  selected_poi_name?: string | null;
  active_tab?: string | null;
  confirm_action_id?: string | null;
  route_path?: string | null;
  session_id?: string | null;
};
