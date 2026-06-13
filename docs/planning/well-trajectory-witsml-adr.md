# WITSML import — architecture decision (draft)

**Status:** draft (phase 4b)  
**Phase 4a:** endpoints return HTTP 501 with a clear message.

## Context

Atlas Grid needs to import wellbore surveys from corporate WITSML stores (1.4 and 2.0).
Phase 4a delivers CSV and Landmark `.wbp`; WITSML is deferred until library choice is validated.

## Options

| Library | WITSML versions | Notes |
|---------|-----------------|-------|
| `witsml` (community) | 1.4.x | Mature Python bindings; XML-heavy |
| `energistics` / vendor SDK | 1.4 / 2.0 | Depends on corporate stack |
| Custom lxml + XSD | 1.4 / 2.0 | Full control, higher maintenance |

## Recommendation (TBD)

1. Prototype 1.4 `trajectory` / `log` objects with `witsml` or lxml against a sample server.
2. Map stations to planner `ImportParseResponse` (same shape as CSV / `.wbp`).
3. Reuse backend `import_service` merge path — no duplicate storage logic.

## Out of scope (4a)

- OAuth / SOAP client configuration
- Multi-well WITSML bulk import across pads
- Error ellipsoid export (phase 4c)
