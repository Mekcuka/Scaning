# Security Policy

## Supported versions

Security fixes are applied to the `main` branch and deployed from there (GitHub Pages frontend, Yandex Cloud backend).

## Reporting a vulnerability

Do **not** open public GitHub issues for security problems.

Contact the maintainers privately with:

- Description of the issue and impact
- Steps to reproduce
- Affected URLs or components (frontend / API)

## Secrets and production

- Never commit `.env`, deploy credentials, or API keys
- Production must set a unique `SECRET_KEY` and `DEMO_USERS_ENABLED=false`
- `ALLOW_REGISTRATION` is operator-controlled (currently `true` in deploy templates); set `false` to close open signup
- Rotate credentials if they were ever committed to git history

## Known hardening controls

- JWT in httpOnly cookies with CSRF double-submit
- SSRF protection on corporate import URLs (`app/core/url_validation.py`)
- Rate limiting on auth endpoints (`AUTH_RATE_LIMIT`)
- Dependency audits in CI (`npm audit`, `pip-audit`)
- Container image scanning with Trivy on backend deploy

See [docs/architecture/auth-rbac.md](docs/architecture/auth-rbac.md) for authentication details.
