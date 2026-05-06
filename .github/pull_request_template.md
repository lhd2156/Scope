# Pull request

## Summary

<!-- What changed and why. Link issues with `Fixes #123` or `Refs #123`. -->

## Security checklist

- [ ] No secrets, API keys, tokens, or customer data in the diff, commits, or CI logs.
- [ ] New/changed endpoints enforce authentication and per-resource authorization (no IDOR).
- [ ] Input is validated on the server side; output is escaped/encoded where it reaches a browser.
- [ ] Error responses do not leak stack traces, SQL, filesystem paths, or internal hostnames.
- [ ] New HTTP clients set explicit timeouts and obey the service's allow-list for outbound hosts.
- [ ] New dependencies pass `pip-audit` / `npm audit` / `dotnet list package --vulnerable` locally.
- [ ] Threat model impact considered (auth, trust boundary, PII, privileges). Describe below if yes.

## Test plan

- [ ] Unit / service tests added or updated.
- [ ] Manual verification steps documented here.
- [ ] CI green (`ci.yml`, CodeQL, gitleaks, Trivy).

## Rollout / rollback

<!-- Deployment notes, feature flags, data migrations, rollback steps. -->
