const CUSTOM_MODEL = '__custom__';

type Props = {
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (model: string) => void;
};

export function AdminAssistantModelField({ value, options, disabled, onChange }: Props) {
  const hasList = options.length > 0;
  const inList = hasList && value && options.includes(value);
  const selectValue = inList ? value : hasList ? CUSTOM_MODEL : value;

  if (!hasList) {
    return (
      <input
        className="input input--mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="openai/gpt-4o-mini"
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
      />
    );
  }

  return (
    <div className="admin-assistant-model-field">
      <select
        className="input input--mono"
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM_MODEL) {
            if (inList) onChange('');
            return;
          }
          onChange(next);
        }}
        disabled={disabled}
      >
        <option value="">— выберите модель —</option>
        {options.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value={CUSTOM_MODEL}>Другая модель…</option>
      </select>
      {(selectValue === CUSTOM_MODEL || (value && !inList)) && (
        <input
          className="input input--mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="имя модели в провайдере"
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
      )}
    </div>
  );
}
