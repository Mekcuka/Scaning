# Отчёт ревью: Ant Design 6 — фазы B9–B15

**Дата:** 2026-06-30  
**Reviewer:** loop 2/2 (после Builder quick-fix)  
**Вердикт:** ✅ **ЗЕЛЁНЫЙ** — готов к Integrator / коммиту B9–B15

---

## Builder quick-fix (loop 1 → 2)

| # | Finding | Исправление | Статус |
|---|---------|-------------|--------|
| 1 | `AppModal` overlayClassName на wrong prop | `wrapClassName={['app-modal-overlay', overlayClassName].filter(Boolean).join(' ')}` | ✅ |
| 2 | Toast сверху вместо bottom-right | CSS `.ant-message` в `page-chrome.css` (legacy `toast-stack-bottom`) | ✅ |
| 3 | `<Link><Button>` в PadClusteringLayout | `navigate()` на Ant `Button` | ✅ |

---

## Сверка с контрактом (`contract.md`)

| Пункт | Статус |
|-------|--------|
| `.btn-*` → Ant `Button` | ✅ 0 `btn btn-*` |
| `.card` → Ant `Card` | ✅ |
| Legacy `.input` → Ant Input | ✅ (B16: PyWellGeo, sketch) |
| `AppModal` → Modal | ✅ wrapClassName bridge |
| `pushToast` → message | ✅ tone + bottom-right CSS |
| `AntThemeProvider` + ru_RU | ✅ |

---

## Bugbot loop 2

| Finding | Оценка |
|---------|--------|
| `AppSelect` `value || undefined` ломает `''` | ⚠️ pre-existing (B3), не блокер B9–B15 |

---

## Тесты

| Проверка | Результат |
|----------|-----------|
| `npm run lint` | ✅ 0 errors |
| `npm run test` | ✅ **1271 / 1271** |
| `npm run verify:css` | ✅ 37 сегментов |

---

## Handoff

> Фаза Reviewer завершена. Вердикт: **зелёный**.
> Отчёт: `docs/features/ant-design-migration/review-report.md`.
>
> **Переходим к фазе Integrator?** (коммит B9–B15 + CI)

---

## B16 — UI polish (2026-06-30)

| Область | Статус |
|---------|--------|
| Viewport scroll (`.app-route-host`, `.app-main`) | ✅ |
| Card CSS bridge (`.ant-card .card-header`) | ✅ |
| Subnav pills (`.dm-subnav-tabs`) | ✅ |
| AppModal CSS bridge (`.ant-modal-content`) | ✅ |
| `AppSelect` пустой `value` | ✅ |
| Legacy `.input` → Ant Input (PyWellGeo, sketch) | ✅ |
| `Link`+`Button` a11y (ProjectDetail, Import3D) | ✅ |
| `antTheme` Card/Tabs/Form | ✅ |
| E2E scroll smoke | ✅ |

**Вердикт B16:** ✅ **ЗЕЛЁНЫЙ**
