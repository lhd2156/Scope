# Pull request

## SDLC summary

- Change type:
- Scope / services:
- Requirement / issue:
- User or operator impact:

## Design / contract notes

<!-- API/schema/env/config/migration notes, or "None". -->

## Implementation checklist

- [ ] Change stays within documented service boundaries or explains cross-service impact.
- [ ] API contracts, env vars, migrations, and runbooks updated when behavior changed.
- [ ] No unrelated files staged.

## Security checklist

- [ ] No secrets, API keys, tokens, or customer data in the diff, commits, or CI logs.
- [ ] New/changed endpoints enforce authentication and per-resource authorization (no IDOR).
- [ ] Input is validated on the server side; output is escaped/encoded where it reaches a browser.
- [ ] Error responses do not leak stack traces, SQL, filesystem paths, or internal hostnames.
- [ ] New HTTP clients set explicit timeouts and obey the service's allow-list for outbound hosts.
- [ ] New dependencies pass `pip-audit` / `npm audit` / `dotnet list package --vulnerable` locally.
- [ ] Threat model impact considered (auth, trust boundary, PII, privileges). Describe below if yes.
- [ ] Data retention/privacy impact considered if user data, uploads, logs, or analytics changed.

## Verification plan

| Area | Command / evidence | Result |
|---|---|---|
| Unit/service |  |  |
| Integration/e2e |  |  |
| Coverage |  |  |
| Security/static scan |  |  |
| Manual/smoke |  |  |

## Release / rollback

- Rollout:
- Rollback:
- Migration/data impact:
- Observability:
