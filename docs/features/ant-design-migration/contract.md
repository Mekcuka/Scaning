# Контракт UI: Ant Design 6

## Примитивы

| Legacy | Ant Design 6 | Поведение |
|--------|--------------|-----------|
| `AppModal` | `Modal` | `subtitle` → `Typography.Text type="secondary"`; sm=480, md=640, lg=900; `destroyOnHidden`; `onCancel` → `onClose` |
| `AppSelect` | `Select` | `options`, `value`, `onChange`, `disabled`, `readOnly`; placeholder на русском |
| `.btn-primary` | `Button type="primary"` | — |
| `.btn-secondary` | `Button` | default type |
| `.btn-ghost` | `Button type="text"` | — |
| `ToastStack` / `pushToast` | `App.useApp().message` | tone: info→info, success→success, error→error |
| `PageSkeleton` | `Skeleton` + `Spin` | — |
| `.card` | `Card` | — |
| `.table` | `Table` | pagination через prop |
| Subnav | `Tabs` | RBAC сохраняется |

## Provider

- `AntThemeProvider`: `ConfigProvider` + `App` + `locale={ruRU}`
- `theme` синхронизирован с `useAppStore.theme`

## Иконки shell

- Sidebar/header: `@ant-design/icons` или Lucide (допустимо в карте)
