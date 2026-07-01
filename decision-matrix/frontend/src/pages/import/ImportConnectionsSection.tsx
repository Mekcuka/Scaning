import { Link as LinkIcon } from 'lucide-react';
import { Button, Card, Form, Input } from 'antd';
import { AppSelect } from '../../components/AppSelect';
import type { ImportConnection, ImportConnectionCreate } from '../../lib/api';
import type { UseMutationResult } from '@tanstack/react-query';

type Props = {
  projectId: string | null | undefined;
  readOnly: boolean;
  connForm: ImportConnectionCreate;
  setConnForm: (v: ImportConnectionCreate) => void;
  connections: ImportConnection[];
  selectedConnId: string | null;
  setSelectedConnId: (id: string | null) => void;
  saveConnMut: UseMutationResult<unknown, Error, void, unknown>;
  testConnMut: UseMutationResult<
    { ok: boolean; status_code?: number; error?: string },
    Error,
    string,
    unknown
  >;
  syncConnMut: UseMutationResult<{ imported: number }, Error, string, unknown>;
  embedded?: boolean;
};

export function ImportConnectionsSection({
  projectId,
  readOnly,
  connForm,
  setConnForm,
  connections,
  selectedConnId,
  setSelectedConnId,
  saveConnMut,
  testConnMut,
  syncConnMut,
  embedded = false,
}: Props) {
  const fields = (
    <>
      <Form.Item label="Название" className="mb-3">
        <Input
          value={connForm.name}
          disabled={readOnly}
          onChange={(e) => setConnForm({ ...connForm, name: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="URL REST API" className="mb-3">
        <Input
          value={connForm.api_url}
          disabled={readOnly}
          onChange={(e) => setConnForm({ ...connForm, api_url: e.target.value })}
          placeholder="https://api.example.com/v1/infrastructure"
        />
      </Form.Item>
      <Form.Item label="Тип аутентификации" className="mb-3">
        <AppSelect
          value={connForm.auth_type || 'bearer'}
          readOnly={readOnly}
          onChange={(auth_type) => setConnForm({ ...connForm, auth_type })}
          options={[
            { value: 'bearer', label: 'Bearer Token' },
            { value: 'api_key', label: 'API Key' },
            { value: 'basic', label: 'Basic (user:password)' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Учётные данные" className="mb-3">
        <Input.Password
          value={connForm.credentials}
          disabled={readOnly}
          onChange={(e) => setConnForm({ ...connForm, credentials: e.target.value })}
        />
      </Form.Item>
      {connections.length > 0 && (
        <Form.Item label="Сохранённые подключения" className="mb-3">
          <AppSelect
            placeholder="— выберите —"
            value={selectedConnId ?? ''}
            readOnly={readOnly}
            onChange={(id) => setSelectedConnId(id || null)}
            options={[
              { value: '', label: '— выберите —' },
              ...connections.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </Form.Item>
      )}
    </>
  );

  const actions = (
    <>
      <Button
        type="primary"
        size="small"
        disabled={!projectId || readOnly}
        onClick={() => saveConnMut.mutate()}
      >
        Сохранить
      </Button>
      <Button
        size="small"
        disabled={!projectId || !selectedConnId || readOnly}
        onClick={() => selectedConnId && testConnMut.mutate(selectedConnId)}
      >
        Тест
      </Button>
      <Button
        size="small"
        className="export-option__btn--wide"
        disabled={!projectId || !selectedConnId || readOnly}
        onClick={() => selectedConnId && syncConnMut.mutate(selectedConnId)}
      >
        Синхронизировать
      </Button>
    </>
  );

  if (embedded) {
    return fields;
  }

  return (
    <Card size="small">
      <div className="flex items-center gap-2 mb-4">
        <LinkIcon size={18} />
        <h2 className="font-semibold">Подключение API</h2>
      </div>
      {fields}
      <div className="flex flex-wrap gap-2 mt-2">{actions}</div>
    </Card>
  );
}
