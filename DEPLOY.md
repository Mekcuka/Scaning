# Публикация на GitHub Pages

## 1. Создайте репозиторий на GitHub

Пустой репозиторий (без README), например `sppr-mvp`.

## 2. Загрузите код

```powershell
cd C:\Users\user\Documents\Cursore
git init
git branch -M main
git add .
git commit -m "Initial commit: СППР MVP + GitHub Pages"
git remote add origin https://github.com/<ВАШ_ЛОГИН>/<ИМЯ_РЕПО>.git
git push -u origin main
```

## 3. Включите GitHub Pages

В репозитории: **Settings → Pages → Build and deployment**

- **Source:** GitHub Actions

После push workflow `Deploy frontend to GitHub Pages` соберёт фронтенд и опубликует его.

Сайт откроется по адресу:

`https://<ВАШ_ЛОГИН>.github.io/<ИМЯ_РЕПО>/`

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
