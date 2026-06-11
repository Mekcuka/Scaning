# Frontend styles

Стили разбиты из монолитного `index.css`. **Порядок каскада** задан цепочкой `@import` в [`../index.css`](../index.css) — см. [cascade-order.md](./cascade-order.md).

## Куда добавлять новые стили

| Тип | Файл |
|-----|------|
| Токены / тема | `tokens.css` |
| Reset, body | `base.css` |
| Shell layout | `layout/` |
| Кнопки, формы, модалки | `components/` |
| Экран / фича | `features/<feature>.css` |
| Глобальный responsive | `responsive/` (осторожно с порядком) |

Правила именования: [ui-guidelines.md](../../../../docs/architecture/ui-guidelines.md) §6.

## Проверка после правок

```bash
npm run verify:css
npm run build
npm test
```
