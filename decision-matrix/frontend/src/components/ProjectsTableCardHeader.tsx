import type { ReactNode } from 'react';

type ProjectsTableCardHeaderProps = {
  title: string;
  search: string;
  onSearchChange: (value: string) => void;
  actions?: ReactNode;
};

export function ProjectsTableCardHeader({
  title,
  search,
  onSearchChange,
  actions,
}: ProjectsTableCardHeaderProps) {
  return (
    <div className="card-header projects-table-card__header">
      <h2 className="projects-table-card__title">{title}</h2>
      <input
        type="search"
        className="topbar-search projects-table-card__search"
        placeholder="Поиск проектов..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Поиск проектов"
      />
      {actions}
    </div>
  );
}
