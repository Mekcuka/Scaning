# Модель данных: тема Ant Design

## Маппинг tokens.css → Ant Token

| CSS var | Ant Token (light) | Ant Token (dark) |
|---------|-------------------|------------------|
| `--primary` (#0b5cad) | `colorPrimary` | `colorPrimary` (#3d9cf5) |
| `--primary-hover` | `colorPrimaryHover` | `colorPrimaryHover` |
| `--bg` | `colorBgLayout` | `colorBgLayout` |
| `--surface` | `colorBgContainer` | `colorBgContainer` |
| `--surface-2` | `colorBgElevated` | `colorBgElevated` |
| `--border` | `colorBorder` | `colorBorder` |
| `--text` | `colorText` | `colorText` |
| `--text-muted` | `colorTextSecondary` | `colorTextSecondary` |
| `--radius` (10px) | `borderRadius` | `borderRadius` |
| `--sidebar-bg` | `Sider` token override | `Sider` token override |

## Runtime

- Source of truth: `useAppStore.theme` (`'light' | 'dark'`)
- `document.documentElement[data-theme]` сохраняется для canvas CSS
- Algorithm: `theme.defaultAlgorithm` / `theme.darkAlgorithm`
- Font: `Inter, system-ui, sans-serif`
- `zIndexPopupBase`: 1100 (выше map overlays)

## Миграция БД

Не требуется.
