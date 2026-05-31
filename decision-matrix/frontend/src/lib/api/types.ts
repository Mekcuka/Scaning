/** OpenAPI-derived API types. Regenerate: npm run codegen:api */
export type ApiHealthResponse = {
  status: 'ok' | 'degraded';
  database: 'ok' | 'error';
  environment?: string;
  alembic_head?: string | null;
};

export type ApiErrorBody = {
  detail: string | unknown[];
  request_id?: string | null;
};
