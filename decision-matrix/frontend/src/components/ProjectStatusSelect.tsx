import { AppSelect } from './AppSelect';
import {
  normalizeProjectStatus,
  PROJECT_STATUS_OPTIONS,
  type ProjectStatusValue,
} from '../lib/projectDisplay';

type Props = {
  value: string;
  onChange: (status: ProjectStatusValue) => void;
  disabled?: boolean;
};

export function ProjectStatusSelect({ value, onChange, disabled }: Props) {
  const normalized = normalizeProjectStatus(value);

  return (
    <AppSelect
      variant="compact"
      fullWidth={false}
      matchMenuWidth
      className={`project-status-select project-status-select--${normalized}`}
      value={normalized}
      disabled={disabled}
      onChange={(v) => onChange(v as ProjectStatusValue)}
      ariaLabel="Статус проекта"
      options={PROJECT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    />
  );
}
