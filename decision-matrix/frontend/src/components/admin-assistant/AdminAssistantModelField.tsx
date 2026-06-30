import { Input } from 'antd';
import { AppSelect } from '../AppSelect';

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
      <Input
        className="input--mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="openai/gpt-4o-mini"
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
      />
    );
  }

  const selectOptions = [
    { value: '', label: '— выберите модель —' },
    ...options.map((m) => ({ value: m, label: m })),
    { value: CUSTOM_MODEL, label: 'Другая модель…' },
  ];

  return (
    <div className="admin-assistant-model-field">
      <AppSelect
        className="input--mono"
        value={selectValue}
        disabled={disabled}
        fullWidth
        onChange={(next) => {
          if (next === CUSTOM_MODEL) {
            if (inList) onChange('');
            return;
          }
          onChange(next);
        }}
        options={selectOptions}
      />
      {(selectValue === CUSTOM_MODEL || (value && !inList)) && (
        <Input
          className="input--mono"
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
