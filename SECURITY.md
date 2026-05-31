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
- Production must set `SECRET_KEY`, `DEMO_USERS_ENABLED=false`, and `ALLOW_REGISTRATION=false`
- Rotate credentials if they were ever committed to git history

## Known hardening controls

- JWT in httpOnly cookies with CSRF double-submit
- SSRF protection on corporate import URLs (`app/core/url_validation.py`)
- Rate limiting on auth endpoints (`AUTH_RATE_LIMIT`)
- Dependency audits in CI (`npm audit`, `pip-audit`)
- Container image scanning with Trivy on backend deploy

See [docs/auth-rbac.md](docs/auth-rbac.md) for authentication details.
