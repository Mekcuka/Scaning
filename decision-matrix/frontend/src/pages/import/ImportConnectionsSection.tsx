import { Link as LinkIcon } from 'lucide-react';
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
      <div className="form-group">
        <label>Название</label>
        <input
          value={connForm.name}
          disabled={readOnly}
          onChange={(e) => setConnForm({ ...connForm, name: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>URL REST API</label>
        <input
          value={connForm.api_url}
          disabled={readOnly}
          onChange={(e) => setConnForm({ ...connForm, api_url: e.target.value })}
          placeholder="https://api.example.com/v1/infrastructure"
        />
      </div>
      <div className="form-group">
        <label>Тип аутентификации</label>
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
      </div>
      <div className="form-group">
        <label>Учётные данные</label>
        <input
          type="password"
          value={connForm.credentials}
          disabled={readOnly}
          onChange={(e) => setConnForm({ ...connForm, credentials: e.target.value })}
        />
      </div>
      {connections.length > 0 && (
        <div className="form-group">
          <label>Сохранённые подключения</label>
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
        </div>
      )}
    </>
  );

  const actions = (
    <>
      <button
        type="button"
        className="btn btn-primary text-sm export-option__btn"
        disabled={!projectId || readOnly}
        onClick={() => saveConnMut.mutate()}
      >
        Сохранить
      </button>
      <button
        type="button"
        className="btn btn-secondary text-sm export-option__btn"
        disabled={!projectId || !selectedConnId || readOnly}
        onClick={() => selectedConnId && testConnMut.mutate(selectedConnId)}
      >
        Тест
      </button>
      <button
        type="button"
        className="btn btn-secondary text-sm export-option__btn export-option__btn--wide"
        disabled={!projectId || !selectedConnId || readOnly}
        onClick={() => selectedConnId && syncConnMut.mutate(selectedConnId)}
      >
        Синхронизировать
      </button>
    </>
  );

  if (embedded) {
    return fields;
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <LinkIcon size={18} />
        <h2 className="font-semibold">Подключение API</h2>
      </div>
      {fields}
      <div className="flex flex-wrap gap-2 mt-2">{actions}</div>
    </div>
  );
}
