# Публикация на GitHub Pages

## Репозиторий

https://github.com/Mekcuka/Cursor_Scan

## Сайт

**https://mekcuka.github.io/Cursor_Scan/**

Деплой: workflow `Deploy frontend to GitHub Pages` при push в `main`.

## Включить Pages (один раз)

**Settings → Pages → Build and deployment → Source:** **GitHub Actions**

## 4. API (обязательно для входа и данных)

GitHub Pages отдаёт только статику. Backend нужно разместить отдельно (Render, Railway, VPS и т.д.).

После деплоя API укажите URL в репозитории:

**Settings → Secrets and variables → Actions → Variables**

| Имя | Пример |
|-----|--------|
| `VITE_API_URL` | `https://your-api.onrender.com/api/v1` |

Перезапустите workflow (**Actions → Deploy frontend → Run workflow**) или сделайте новый push.

Локально API по-прежнему: `python decision-matrix/backend/run_local.py` + `npm run dev` в `frontend`.

## 5. CORS на backend

В `.env` API добавьте origin Pages:

```env
CORS_ORIGINS=http://localhost:5173,https://<ВАШ_ЛОГИН>.github.io
```
